import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../ports/payment.port.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto.js';
import {
  CompanyAlreadySubscribedException,
  NoActiveSubscriptionToCancelException,
  NoActiveSubscriptionToChangePlanException,
  SamePlanException,
} from './billing.exceptions.js';
import {
  resolveContactQuotaForPlan,
  resolveMonthlyPriceHtInCentimes,
} from './plan-quota.js';
import { computeVat } from './tax.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

@Injectable()
export class SubscriptionCheckoutService {
  constructor(
    private readonly subscriptionGuard: SubscriptionGuardService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // Creates a Checkout Session and nothing else — no Subscription row is
  // created or touched here. Stripe is the source of truth for payment;
  // activation happens exclusively in PaymentWebhookService once Stripe
  // confirms the payment via a signed webhook, never from this endpoint's
  // return or the client's post-redirect callback.
  async createCheckoutSession(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<{ url: string }> {
    // Server-resolved from the JWT-authenticated caller (ADR-0001) — the
    // client never supplies companyId, so it can't create a checkout
    // session on another company's behalf.
    const companyId = await this.subscriptionGuard.resolveCompanyId(userId);

    const alreadyActive = await this.subscriptionRepo.findOne({
      where: { companyId, status: SubscriptionStatus.ACTIVE },
    });
    // TRIAL, PAST_DUE, CANCELLED and EXPIRED are all legitimate states to
    // checkout from (trial converting, reactivating, resubscribing) — only
    // an already-ACTIVE subscription blocks a new session, since a second
    // one could never activate anyway (UQ_subscriptions_company_active,
    // Lot 6A) and would just confuse the caller.
    if (alreadyActive) {
      throw new CompanyAlreadySubscribedException(companyId);
    }

    // Stripe charges the customer amountTTC (HT + VAT) — this endpoint
    // used to send the raw HT config price, under-charging by the VAT
    // amount. Fixed here rather than at the invoice, which must reflect
    // what was actually paid, not what should have been.
    const amountHT = resolveMonthlyPriceHtInCentimes(
      dto.plan,
      this.configService,
    );
    const { amountTTC } = computeVat(amountHT);
    const currency = this.configService.get<string>('business.currency', 'MAD');

    const session = await this.paymentProvider.createCheckoutSession({
      companyId,
      plan: dto.plan,
      amount: amountTTC,
      currency,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });

    return { url: session.url };
  }

  // Schedules cancellation at the end of the current paid period — never
  // an immediate cutoff (the company already paid for it). Status stays
  // whatever it currently is (ACTIVE or PAST_DUE); Stripe itself flips it
  // to CANCELLED once periodEnd is reached, via the same webhook path
  // dunning already uses (Lot 6D commit 2).
  async cancelSubscription(
    userId: string,
  ): Promise<{ cancelAtPeriodEnd: boolean; periodEnd: Date | null }> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(userId);

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        companyId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
      },
      order: { createdAt: 'DESC' },
    });

    if (!subscription || !subscription.externalSubscriptionId) {
      throw new NoActiveSubscriptionToCancelException(companyId);
    }

    // Idempotent: a second call is a no-op, not a second Stripe API call —
    // cancel_at_period_end is already true, there's nothing new to tell
    // Stripe.
    if (!subscription.cancelAtPeriodEnd) {
      await this.paymentProvider.cancelAtPeriodEnd(
        subscription.externalSubscriptionId,
      );
      subscription.cancelAtPeriodEnd = true;
      await this.subscriptionRepo.save(subscription);
    }

    return {
      cancelAtPeriodEnd: true,
      periodEnd: subscription.endsAt,
    };
  }

  // Upgrade or downgrade, applied immediately at Stripe (proration —
  // Stripe computes and invoices the prorated amount itself, never
  // recomputed by hand here). The resulting legal invoice is emitted
  // separately, asynchronously, once Stripe's invoice.paid webhook
  // arrives (PaymentWebhookService.handlePlanChangeInvoice) — Stripe's
  // API call succeeding is not proof the invoice was actually charged
  // yet.
  //
  // Quota, by contrast, is reajusted HERE, synchronously, the moment the
  // Stripe API call succeeds — domain logic, not Stripe's job (explicit
  // product decision): an upgrade's higher quota must be usable
  // immediately, not after an async webhook round-trip. contactsUsed is
  // deliberately left untouched (preserved across a plan change, reset
  // only on renewal — CDC §5.4). For a downgrade where the new quota is
  // below what's already been consumed: no special-casing needed —
  // ContactQuotaService's existing atomic consumption guard
  // (WHERE contacts_used < contact_quota) already naturally blocks
  // further consumption the moment contactsUsed reaches contactQuota, so
  // the company is capped, not retroactively penalized, and regains full
  // quota at the next renewal.
  async changePlan(
    userId: string,
    dto: ChangeSubscriptionPlanDto,
  ): Promise<{ plan: SubscriptionPlan; contactQuota: number; contactsUsed: number }> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(userId);

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        companyId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
      },
      order: { createdAt: 'DESC' },
    });

    if (!subscription || !subscription.externalSubscriptionId) {
      throw new NoActiveSubscriptionToChangePlanException(companyId);
    }

    if (subscription.plan === dto.plan) {
      throw new SamePlanException(dto.plan);
    }

    const newQuota = resolveContactQuotaForPlan(dto.plan, this.configService);
    const amountHT = resolveMonthlyPriceHtInCentimes(
      dto.plan,
      this.configService,
    );
    const { amountTTC } = computeVat(amountHT);
    const currency = this.configService.get<string>('business.currency', 'MAD');

    await this.paymentProvider.changeSubscriptionPlan({
      providerSubscriptionId: subscription.externalSubscriptionId,
      plan: dto.plan,
      amount: amountTTC,
      currency,
    });

    const previousPlan = subscription.plan;
    subscription.plan = dto.plan;
    subscription.contactQuota = newQuota;
    const saved = await this.subscriptionRepo.save(subscription);

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SUBSCRIPTION_PLAN_CHANGED,
      entityType: 'subscription',
      entityId: saved.id,
      metadata: {
        companyId,
        planChange: true,
        previousPlan,
        newPlan: dto.plan,
        newContactQuota: newQuota,
      },
    });

    return {
      plan: saved.plan,
      contactQuota: saved.contactQuota,
      contactsUsed: saved.contactsUsed,
    };
  }
}
