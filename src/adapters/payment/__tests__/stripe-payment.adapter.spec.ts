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
    data: { object: { id: 'cs_test_1', metadata: { companyId, plan } } },
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
        companyId: 'company-1',
        plan: SubscriptionPlan.GROWTH,
      });
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
