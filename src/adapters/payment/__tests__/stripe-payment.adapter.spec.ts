import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripePaymentProvider } from '../stripe-payment.adapter.js';
import { InvalidWebhookSignatureException } from '../../../ports/payment.port.js';
import { SubscriptionPlan } from '../../../modules/companies/entities/subscription.entity.js';

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';

function makeConfigService(
  overrides: Record<string, string> = {},
): ConfigService {
  const values: Record<string, string> = {
    'payment.stripeSecretKey': 'sk_test_dummy',
    'payment.stripeWebhookSecret': WEBHOOK_SECRET,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

// Real HMAC computed by the Stripe SDK's own test-header helper, not
// hand-rolled — exercises the exact algorithm stripe.webhooks.constructEvent
// verifies against, so these tests prove the real verification code path.
function signPayload(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
}

function checkoutSessionCompletedPayload(
  companyId: string,
  plan: SubscriptionPlan,
  eventId = 'evt_test_1',
): string {
  return JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        subscription: 'sub_test_1',
        metadata: { companyId, plan },
      },
    },
  });
}

// This SDK's Invoice shape nests the subscription reference under
// invoice.parent.subscription_details.subscription — see
// stripe-payment.adapter.ts's extractSubscriptionId comment.
function invoicePaidPayload(
  billingReason: string,
  eventId: string,
  subscriptionId = 'sub_test_1',
): string {
  return JSON.stringify({
    id: eventId,
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_1',
        billing_reason: billingReason,
        parent: {
          subscription_details: { subscription: subscriptionId },
        },
      },
    },
  });
}

function invoicePaymentFailedPayload(
  eventId: string,
  subscriptionId: string | null = 'sub_test_1',
): string {
  return JSON.stringify({
    id: eventId,
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_failed_1',
        parent: subscriptionId
          ? { subscription_details: { subscription: subscriptionId } }
          : null,
      },
    },
  });
}

function subscriptionUpdatedPayload(
  eventId: string,
  status: string,
  subscriptionId = 'sub_test_1',
): string {
  return JSON.stringify({
    id: eventId,
    type: 'customer.subscription.updated',
    data: { object: { id: subscriptionId, status } },
  });
}

function subscriptionDeletedPayload(
  eventId: string,
  subscriptionId = 'sub_test_1',
): string {
  return JSON.stringify({
    id: eventId,
    type: 'customer.subscription.deleted',
    data: { object: { id: subscriptionId, status: 'canceled' } },
  });
}

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(() => {
    provider = new StripePaymentProvider(makeConfigService());
  });

  describe('verifyAndParseWebhook — real signature verification, not mocked', () => {
    it('rejects an empty signature header', () => {
      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from('{}'), ''),
      ).toThrow(InvalidWebhookSignatureException);
    });

    it('rejects a garbage signature header', () => {
      expect(() =>
        provider.verifyAndParseWebhook(
          Buffer.from('{}'),
          't=1700000000,v1=not-a-real-signature',
        ),
      ).toThrow(InvalidWebhookSignatureException);
    });

    it('rejects a genuinely signed payload if the secret does not match', () => {
      const payload = checkoutSessionCompletedPayload(
        'company-1',
        SubscriptionPlan.STARTER,
      );
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_a_different_secret',
      });

      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from(payload), signature),
      ).toThrow(InvalidWebhookSignatureException);
    });

    it('rejects a genuinely signed payload whose body was tampered with after signing', () => {
      const payload = checkoutSessionCompletedPayload(
        'company-1',
        SubscriptionPlan.STARTER,
      );
      const signature = signPayload(payload);
      const tampered = payload.replace('company-1', 'company-2');

      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from(tampered), signature),
      ).toThrow(InvalidWebhookSignatureException);
    });

    it('accepts a genuinely signed checkout.session.completed and maps it to subscription.activated', () => {
      const payload = checkoutSessionCompletedPayload(
        'company-1',
        SubscriptionPlan.GROWTH,
        'evt_abc',
      );
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'subscription.activated',
        providerEventId: 'evt_abc',
        providerSessionId: 'cs_test_1',
        providerSubscriptionId: 'sub_test_1',
        companyId: 'company-1',
        plan: SubscriptionPlan.GROWTH,
      });
    });

    it('throws — does not silently ignore — a checkout.session.completed with no subscription reference', () => {
      const payload = JSON.stringify({
        id: 'evt_no_sub',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_no_sub',
            metadata: { companyId: 'company-1', plan: SubscriptionPlan.GROWTH },
          },
        },
      });
      const signature = signPayload(payload);

      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from(payload), signature),
      ).toThrow(/no subscription/);
    });

    it('maps an event type this adapter does not act on to "ignored"', () => {
      const payload = JSON.stringify({
        id: 'evt_x',
        type: 'customer.created',
        data: { object: {} },
      });
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });

    it('throws — does not silently ignore — a checkout.session.completed missing companyId/plan metadata', () => {
      const payload = JSON.stringify({
        id: 'evt_y',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_2', metadata: {} } },
      });
      const signature = signPayload(payload);

      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from(payload), signature),
      ).toThrow();
    });

    it('maps checkout.session.expired with companyId metadata to payment.failed', () => {
      const payload = JSON.stringify({
        id: 'evt_z',
        type: 'checkout.session.expired',
        data: {
          object: { id: 'cs_3', metadata: { companyId: 'company-9' } },
        },
      });
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'payment.failed',
        providerEventId: 'evt_z',
        companyId: 'company-9',
        reason: 'checkout.session.expired',
      });
    });
  });

  describe('invoice.paid — billing_reason discrimination', () => {
    it('maps billing_reason=subscription_cycle to subscription.renewed', () => {
      const payload = invoicePaidPayload(
        'subscription_cycle',
        'evt_renew_1',
        'sub_renew_1',
      );
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'subscription.renewed',
        providerEventId: 'evt_renew_1',
        providerSubscriptionId: 'sub_renew_1',
      });
    });

    it('maps billing_reason=subscription_create to "ignored" — already handled via checkout.session.completed', () => {
      const payload = invoicePaidPayload('subscription_create', 'evt_first_1');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });

    it('maps billing_reason=subscription_update (proration) to "ignored" — not acted on by this commit', () => {
      const payload = invoicePaidPayload('subscription_update', 'evt_proration_1');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });

    it('throws — does not silently ignore — a subscription_cycle invoice with no subscription reference', () => {
      const payload = JSON.stringify({
        id: 'evt_renew_bad',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_bad',
            billing_reason: 'subscription_cycle',
            parent: null,
          },
        },
      });
      const signature = signPayload(payload);

      expect(() =>
        provider.verifyAndParseWebhook(Buffer.from(payload), signature),
      ).toThrow(/subscription_cycle invoice with no subscription/);
    });
  });

  describe('invoice.payment_failed — dunning', () => {
    it('maps a failed recurring invoice to subscription.past_due, keyed by providerSubscriptionId', () => {
      const payload = invoicePaymentFailedPayload('evt_fail_1', 'sub_dunning_1');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'subscription.past_due',
        providerEventId: 'evt_fail_1',
        providerSubscriptionId: 'sub_dunning_1',
      });
    });

    it('maps a failed invoice with no subscription reference to "ignored"', () => {
      const payload = invoicePaymentFailedPayload('evt_fail_2', null);
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });
  });

  describe('customer.subscription.updated / deleted — dunning exhausted', () => {
    it('maps status=unpaid to subscription.cancelled with reason retries_exhausted', () => {
      const payload = subscriptionUpdatedPayload(
        'evt_unpaid_1',
        'unpaid',
        'sub_exhausted_1',
      );
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'subscription.cancelled',
        providerEventId: 'evt_unpaid_1',
        providerSubscriptionId: 'sub_exhausted_1',
        reason: 'retries_exhausted',
      });
    });

    it('maps customer.subscription.deleted to subscription.cancelled with reason subscription_deleted', () => {
      const payload = subscriptionDeletedPayload('evt_deleted_1', 'sub_deleted_1');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event).toEqual({
        type: 'subscription.cancelled',
        providerEventId: 'evt_deleted_1',
        providerSubscriptionId: 'sub_deleted_1',
        reason: 'subscription_deleted',
      });
    });

    it('maps any other customer.subscription.updated status to "ignored" — e.g. active (plan change, Lot 6D commit 4)', () => {
      const payload = subscriptionUpdatedPayload('evt_active_1', 'active');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });

    it('maps status=past_due on customer.subscription.updated to "ignored" — invoice.payment_failed already covers this transition', () => {
      const payload = subscriptionUpdatedPayload('evt_pd_1', 'past_due');
      const signature = signPayload(payload);

      const event = provider.verifyAndParseWebhook(
        Buffer.from(payload),
        signature,
      );

      expect(event.type).toBe('ignored');
    });
  });

  describe('createCheckoutSession', () => {
    it('calls the Stripe SDK with the right shape and returns url/providerSessionId', async () => {
      const stripeClient = (provider as unknown as { stripe: Stripe }).stripe;
      const createSpy = jest
        .spyOn(stripeClient.checkout.sessions, 'create')
        .mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test/cs_test_123',
          lastResponse: {
            headers: {},
            requestId: 'req_test',
            statusCode: 200,
          },
        } as Stripe.Response<Stripe.Checkout.Session>);

      const result = await provider.createCheckoutSession({
        companyId: 'company-1',
        plan: SubscriptionPlan.SCALE,
        amount: 690000,
        currency: 'MAD',
        successUrl: 'https://app.local/billing/success',
        cancelUrl: 'https://app.local/billing/cancel',
      });

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/test/cs_test_123',
        providerSessionId: 'cs_test_123',
      });
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          success_url: 'https://app.local/billing/success',
          cancel_url: 'https://app.local/billing/cancel',
          metadata: { companyId: 'company-1', plan: SubscriptionPlan.SCALE },
        }),
      );
    });
  });
});
