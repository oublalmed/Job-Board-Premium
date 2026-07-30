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

// The only Stripe event types this adapter acts on for Lot 6B. Renewal
// (invoice.paid) and cancellation (customer.subscription.deleted) are
// deliberately not handled here — see PROGRESS.md, that's Lot 6D
// (dunning/lifecycle) territory, not initial activation.
const ACTIVATING_EVENT_TYPES = new Set<string>(['checkout.session.completed']);
const FAILURE_EVENT_TYPES = new Set<string>([
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

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

      return {
        type: 'subscription.activated',
        providerEventId: event.id,
        providerSessionId: session.id,
        companyId,
        plan,
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
}
