import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { SubscriptionCheckoutService } from './subscription-checkout.service.js';
import { SubscriptionCheckoutController } from './subscription-checkout.controller.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedWebhookEvent]),
    CompaniesModule,
  ],
  controllers: [PaymentWebhookController, SubscriptionCheckoutController],
  providers: [PaymentWebhookService, SubscriptionCheckoutService],
})
export class BillingModule {}
