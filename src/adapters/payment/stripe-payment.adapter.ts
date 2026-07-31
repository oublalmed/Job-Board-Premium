import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CheckoutSessionResult,
  CreateCheckoutSessionParams,
  InvalidWebhookSignatureException,
  PaymentProvider,
  WebhookEvent,
} from '../../ports/payment.port.js';
import { SubscriptionPlan } from '../../modules/companies/entities/subscription.entity.js';

const ACTIVATING_EVENT_TYPES = new Set<string>(['checkout.session.completed']);
const FAILURE_EVENT_TYPES = new Set<string>([
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

// invoice.paid fires for every successful invoice — including the very
// first one from Checkout, which ACTIVATING_EVENT_TYPES above already
// handles. billing_reason is how Stripe tells these apart:
// 'subscription_create' is that same first payment (must be ignored here,
// or it would be double-processed under two different event types),
// 'subscription_cycle' is a genuine recurring renewal (Lot 6D commit 1).
// 'subscription_update' (proration) is handled separately — Lot 6D
// commit 4.
const RENEWAL_BILLING_REASON = 'subscription_cycle';
const INITIAL_PAYMENT_BILLING_REASON = 'subscription_create';

// The status Stripe sets on a Subscription once Smart Retries are
// exhausted with no successful payment — this is the ONLY status value
// on customer.subscription.updated we act on. That event fires for every
// field change on a subscription (plan changes, cancel_at_period_end
// toggles, etc. — Lot 6D commits 3/4), so anything else must map to
// 'ignored', never assumed to mean "cancel".
const RETRIES_EXHAUSTED_STATUS = 'unpaid';

// This Stripe API version nests the subscription reference under
// invoice.parent.subscription_details.subscription (the older flat
// invoice.subscription field doesn't exist on this SDK version's Invoice
// type — checked against node_modules/stripe's own .d.ts, not assumed).
function extractSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === 'string' ? subscription : subscription?.id;
}

// The only file in this codebase allowed to import the `stripe` package or
// reference a `Stripe.*` type — everything crossing the PaymentProvider
// port boundary is a domain type from src/ports/payment.port.ts.
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('payment.stripeSecretKey', '');
    this.webhookSecret = configService.get<string>(
      'payment.stripeWebhookSecret',
      '',
    );
    // A missing key still lets the adapter construct (so the app boots in
    // dev/test without Stripe configured) but any real API call will fail
    // fast against Stripe's servers with an auth error, not silently no-op.
    this.stripe = new Stripe(secretKey || 'sk_test_not_configured');
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amount,
            recurring: { interval: 'month' },
            product_data: { name: `Job Board Premium — ${params.plan}` },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // Read back out of session.metadata on checkout.session.completed —
      // this is how the webhook learns which company/plan to activate
      // without ever trusting anything the client sends directly.
      metadata: { companyId: params.companyId, plan: params.plan },
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a checkout URL',
      );
    }

    return { url: session.url, providerSessionId: session.id };
  }

  verifyAndParseWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      this.logger.warn(
        `Webhook signature verification failed: ${(error as Error).message}`,
      );
      throw new InvalidWebhookSignatureException();
    }

    return this.toDomainEvent(event);
  }

  private toDomainEvent(event: Stripe.Event): WebhookEvent {
    if (ACTIVATING_EVENT_TYPES.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.['companyId'];
      const plan = session.metadata?.['plan'] as SubscriptionPlan | undefined;

      // Every session we create sets both fields (see
      // createCheckoutSession above) — their absence means either a
      // session we didn't create, or a bug in that method. Throwing here
      // (not silently ignoring) is deliberate: swallowing this would mean
      // a customer who paid never gets activated, with nothing surfaced.
      if (!companyId || !plan) {
        throw new InternalServerErrorException(
          `Stripe event ${event.id} is missing companyId/plan metadata`,
        );
      }

      const providerSubscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (!providerSubscriptionId) {
        throw new InternalServerErrorException(
          `Stripe event ${event.id} completed a session with no subscription — expected mode: 'subscription'`,
        );
      }

      return {
        type: 'subscription.activated',
        providerEventId: event.id,
        providerSessionId: session.id,
        providerSubscriptionId,
        companyId,
        plan,
      };
    }

    if (event.type === 'invoice.paid') {
      return this.toInvoicePaidDomainEvent(event);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const providerSubscriptionId = extractSubscriptionId(invoice);

      // No subscription reference means this failed invoice belongs to
      // the initial Checkout flow, not a recurring subscription — nothing
      // for the dunning path to react to (Checkout's own failure/expiry
      // events already cover that case, see FAILURE_EVENT_TYPES below).
      if (!providerSubscriptionId) {
        return {
          type: 'ignored',
          providerEventId: event.id,
          reason: 'invoice.payment_failed with no subscription reference',
        };
      }

      return {
        type: 'subscription.past_due',
        providerEventId: event.id,
        providerSubscriptionId,
      };
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;

      if (
        event.type === 'customer.subscription.deleted' ||
        subscription.status === RETRIES_EXHAUSTED_STATUS
      ) {
        return {
          type: 'subscription.cancelled',
          providerEventId: event.id,
          providerSubscriptionId: subscription.id,
          reason:
            event.type === 'customer.subscription.deleted'
              ? 'subscription_deleted'
              : 'retries_exhausted',
        };
      }

      // customer.subscription.updated fires for every field change (plan
      // changes, cancel_at_period_end toggles — Lot 6D commits 3/4) —
      // only a status of 'unpaid' means anything here.
      return {
        type: 'ignored',
        providerEventId: event.id,
        reason: `customer.subscription.updated with status=${subscription.status}`,
      };
    }

    if (FAILURE_EVENT_TYPES.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.['companyId'];
      if (!companyId) {
        return {
          type: 'ignored',
          providerEventId: event.id,
          reason: `${event.type} without companyId metadata`,
        };
      }
      return {
        type: 'payment.failed',
        providerEventId: event.id,
        companyId,
        reason: event.type,
      };
    }

    return {
      type: 'ignored',
      providerEventId: event.id,
      reason: `unhandled event type ${event.type}`,
    };
  }

  private toInvoicePaidDomainEvent(event: Stripe.Event): WebhookEvent {
    const invoice = event.data.object as Stripe.Invoice;
    const billingReason = invoice.billing_reason;

    if (billingReason === INITIAL_PAYMENT_BILLING_REASON) {
      // Same underlying payment as the checkout.session.completed that
      // already activated this subscription — not a second event to act
      // on, just Stripe's other notification for the same charge.
      return {
        type: 'ignored',
        providerEventId: event.id,
        reason: 'invoice.paid for the initial subscription_create payment (already handled via checkout.session.completed)',
      };
    }

    if (billingReason === RENEWAL_BILLING_REASON) {
      const providerSubscriptionId = extractSubscriptionId(invoice);

      if (!providerSubscriptionId) {
        throw new InternalServerErrorException(
          `Stripe event ${event.id} is a subscription_cycle invoice with no subscription reference`,
        );
      }

      return {
        type: 'subscription.renewed',
        providerEventId: event.id,
        providerSubscriptionId,
      };
    }

    // Includes 'subscription_update' (proration, Lot 6D commit 4) and
    // 'manual' — not acted on by this commit.
    return {
      type: 'ignored',
      providerEventId: event.id,
      reason: `invoice.paid with billing_reason=${billingReason ?? 'unknown'}`,
    };
  }
}
