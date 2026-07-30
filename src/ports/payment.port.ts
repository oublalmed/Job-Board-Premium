import { BadRequestException } from '@nestjs/common';
import type { SubscriptionPlan } from '../modules/companies/entities/subscription.entity.js';

export class InvalidWebhookSignatureException extends BadRequestException {
  constructor() {
    super('Invalid payment webhook signature');
  }
}

export interface CreateCheckoutSessionParams {
  companyId: string;
  plan: SubscriptionPlan;
  // Smallest currency unit (centimes for MAD), never a float amount —
  // avoids floating-point rounding errors reaching the PSP.
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  url: string;
  providerSessionId: string;
}

// Business-meaning events, never a provider SDK type. Each variant carries
// exactly what its handler needs — no caller ever has to know Stripe (or
// whatever PSP is behind the port) shaped the underlying payload.
export interface SubscriptionActivatedEvent {
  type: 'subscription.activated';
  providerEventId: string;
  providerSessionId: string;
  // The Stripe Subscription id (sub_...), distinct from the Checkout
  // Session id above (cs_...). Every recurring event (renewal, dunning,
  // cancellation, proration) references the subscription, never the
  // session that created it — this is what gets stored in
  // Subscription.externalSubscriptionId so those events can find their
  // row.
  providerSubscriptionId: string;
  companyId: string;
  plan: SubscriptionPlan;
}

// A recurring-cycle invoice paid — distinct from the first payment
// (SubscriptionActivatedEvent already covers that; the adapter
// discriminates using Stripe's invoice.billing_reason so the same
// underlying first payment is never processed twice under two different
// event types). Deliberately carries no companyId/plan: the handler looks
// up the Subscription row by providerSubscriptionId and reads both from
// there, since a renewal doesn't change either.
export interface SubscriptionRenewedEvent {
  type: 'subscription.renewed';
  providerEventId: string;
  providerSubscriptionId: string;
}

export interface PaymentFailedEvent {
  type: 'payment.failed';
  providerEventId: string;
  companyId: string;
  reason: string;
}

export interface SubscriptionCancelledEvent {
  type: 'subscription.cancelled';
  providerEventId: string;
  companyId: string;
  reason: string;
}

// A provider sends many event types we don't act on. Rather than throwing
// on anything unrecognized (which would make the webhook endpoint 5xx and
// the provider retry forever), the adapter maps those to this variant so
// the caller can acknowledge (200) without a business effect — while still
// recording the event for idempotence/audit.
export interface IgnoredWebhookEvent {
  type: 'ignored';
  providerEventId: string;
  reason: string;
}

export type WebhookEvent =
  | SubscriptionActivatedEvent
  | SubscriptionRenewedEvent
  | PaymentFailedEvent
  | SubscriptionCancelledEvent
  | IgnoredWebhookEvent;

export interface PaymentProvider {
  createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult>;

  // Verifies the raw payload against the signature and translates the
  // result into a domain event in the same call — there is no way to get a
  // parsed event out of this port without the signature having already
  // been checked. Throws InvalidWebhookSignatureException on failure.
  verifyAndParseWebhook(rawBody: Buffer, signature: string): WebhookEvent;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
