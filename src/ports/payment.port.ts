export interface CreateCheckoutRequest {
  companyId: string;
  planId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentEvent {
  eventType: 'payment.success' | 'payment.failed' | 'subscription.cancelled';
  externalId: string;
  metadata: Record<string, unknown>;
}

export interface PaymentProvider {
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutSession>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string): PaymentEvent;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
