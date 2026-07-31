import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceSequence } from './entities/invoice-sequence.entity.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { SubscriptionCheckoutService } from './subscription-checkout.service.js';
import { SubscriptionCheckoutController } from './subscription-checkout.controller.js';
import { InvoiceEmissionService } from './invoice-emission.service.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceController } from './invoice.controller.js';
import { DunningNotificationService } from './dunning-notification.service.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedWebhookEvent, Invoice, InvoiceSequence]),
    CompaniesModule,
  ],
  controllers: [
    PaymentWebhookController,
    SubscriptionCheckoutController,
    InvoiceController,
  ],
  providers: [
    PaymentWebhookService,
    SubscriptionCheckoutService,
    InvoiceEmissionService,
    InvoiceService,
    DunningNotificationService,
  ],
})
export class BillingModule {}
