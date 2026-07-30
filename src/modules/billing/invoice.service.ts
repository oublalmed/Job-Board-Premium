import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../ports/object-storage.port.js';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
  ) {}

  // companyId baked into the WHERE clause itself (ADR-0001) — a recruiter
  // from another company gets the same 404 as a nonexistent invoice,
  // never a look-then-check on a row already loaded into memory.
  async getSignedPdfUrl(
    userId: string,
    invoiceId: string,
  ): Promise<{ url: string }> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(userId);

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // The PDF stored at emission is the legal document — this returns a
    // link to that exact archived file, never a freshly regenerated one.
    const url = await this.objectStorage.getSignedUrl(invoice.pdfStorageKey);
    return { url };
  }
}
