import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceSequence } from './entities/invoice-sequence.entity.js';
import { TrialCode } from './entities/trial-code.entity.js';
import { TrialCodeRedemption } from './entities/trial-code-redemption.entity.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { SubscriptionCheckoutService } from './subscription-checkout.service.js';
import { SubscriptionCheckoutController } from './subscription-checkout.controller.js';
import { InvoiceEmissionService } from './invoice-emission.service.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceController } from './invoice.controller.js';
import { DunningNotificationService } from './dunning-notification.service.js';
import { TrialCodeAdminService } from './trial-code-admin.service.js';
import { TrialCodeAdminController } from './trial-code-admin.controller.js';
import { TrialCodeRedemptionService } from './trial-code-redemption.service.js';
import { TrialConversionService } from './trial-conversion.service.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessedWebhookEvent,
      Invoice,
      InvoiceSequence,
      TrialCode,
      TrialCodeRedemption,
    ]),
    CompaniesModule,
  ],
  controllers: [
    PaymentWebhookController,
    SubscriptionCheckoutController,
    InvoiceController,
    TrialCodeAdminController,
  ],
  providers: [
    PaymentWebhookService,
    SubscriptionCheckoutService,
    InvoiceEmissionService,
    InvoiceService,
    DunningNotificationService,
    TrialCodeAdminService,
    TrialCodeRedemptionService,
    TrialConversionService,
  ],
})
export class BillingModule {}
