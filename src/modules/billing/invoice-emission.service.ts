import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { Subscription } from '../companies/entities/subscription.entity.js';
import { allocateInvoiceNumber } from './invoice-numbering.js';
import { resolveMonthlyPriceHtInCentimes } from './plan-quota.js';
import { computeVat, computeVatFromTtc, VAT_RATE_PERCENT } from './tax.js';
import { generateInvoicePdf } from './invoice-pdf.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../ports/object-storage.port.js';

@Injectable()
export class InvoiceEmissionService {
  constructor(
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly configService: ConfigService,
  ) {}

  // Must run inside the caller's transaction (PaymentWebhookService,
  // right after activating the subscription) — allocateInvoiceNumber's
  // gap-free guarantee depends on it: if anything below fails (PDF
  // generation, S3 upload, the Invoice insert itself), the whole
  // transaction rolls back, including the counter increment and the
  // subscription activation. Either the payment's full effect — activation
  // AND invoice — lands together, or none of it does, and Stripe's retry
  // naturally reprocesses everything as a fresh attempt (the dedup marker
  // rolled back too).
  async emit(
    params: {
      subscription: Subscription;
      company: Company;
      stripeEventId: string;
      // Proration invoices (Lot 6D commit 4): Stripe already computed and
      // charged this exact TTC amount — the legal invoice must reflect
      // what was actually charged, never the full monthly price
      // recomputed from plan config. Omit for the normal case
      // (activation/renewal), where the full monthly price IS what's
      // owed.
      amountTTCOverride?: number;
    },
    manager: EntityManager,
  ): Promise<Invoice> {
    const { subscription, company, stripeEventId, amountTTCOverride } =
      params;

    const { amountHT, vatAmount, amountTTC } =
      amountTTCOverride !== undefined
        ? computeVatFromTtc(amountTTCOverride)
        : computeVat(
            resolveMonthlyPriceHtInCentimes(
              subscription.plan,
              this.configService,
            ),
          );

    const issuedAt = new Date();
    const invoiceNumber = await allocateInvoiceNumber(
      issuedAt.getFullYear(),
      manager,
    );

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber,
      issuedAt,
      issuerName: this.configService.get<string>('legal.issuerName', ''),
      issuerIce: this.configService.get<string>('legal.issuerIce', ''),
      issuerAddress: this.configService.get<string>('legal.issuerAddress', ''),
      companyName: company.name,
      companyIce: company.ice ?? '',
      planLabel: subscription.plan,
      amountHT,
      vatRate: VAT_RATE_PERCENT,
      vatAmount,
      amountTTC,
      currency: 'MAD',
    });

    const pdfStorageKey = `invoices/${company.id}/${invoiceNumber}.pdf`;
    await this.objectStorage.upload({
      key: pdfStorageKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });

    const invoiceData = {
      subscriptionId: subscription.id,
      companyId: company.id,
      invoiceNumber,
      amountHT,
      vatRate: VAT_RATE_PERCENT,
      vatAmount,
      amountTTC,
      currency: 'MAD',
      companyIce: company.ice ?? '',
      issuedAt,
      pdfStorageKey,
      stripeInvoiceId: stripeEventId,
    };

    // .insert(), never .save() on an existing row — this entity has no
    // update path anywhere in this codebase (immutable once emitted).
    const invoiceRepo = manager.getRepository(Invoice);
    const insertResult = await invoiceRepo.insert(invoiceData);

    return invoiceRepo.create({
      id: insertResult.identifiers[0]?.['id'] as string,
      ...invoiceData,
    });
  }
}
