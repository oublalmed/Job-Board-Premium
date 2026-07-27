import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  PaymentProvider,
  CreateCheckoutRequest,
  CheckoutSession,
  PaymentEvent,
} from '../../ports/payment.port.js';

@Injectable()
export class StubPaymentAdapter implements PaymentProvider {
  private readonly logger = new Logger(StubPaymentAdapter.name);

  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutSession> {
    const sessionId = uuidv4();
    this.logger.log(
      `[STUB] Checkout created for company ${request.companyId}, plan=${request.planId}, amount=${request.amount} ${request.currency}`,
    );
    return Promise.resolve({
      sessionId,
      checkoutUrl: `https://stub-psp.local/checkout/${sessionId}`,
    });
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    this.logger.log('[STUB] Webhook signature verification (always true)');
    return true;
  }

  parseWebhookEvent(payload: string): PaymentEvent {
    this.logger.log('[STUB] Parsing webhook event');
    return {
      eventType: 'payment.success',
      externalId: uuidv4(),
      metadata: { raw: payload, stub: true },
    };
  }

  cancelSubscription(externalSubscriptionId: string): Promise<void> {
    this.logger.log(`[STUB] Subscription ${externalSubscriptionId} cancelled`);
    return Promise.resolve();
  }
}
