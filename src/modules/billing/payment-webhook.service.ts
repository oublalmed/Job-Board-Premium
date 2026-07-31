import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  ProcessedWebhookEvent,
  PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT,
} from './entities/processed-webhook-event.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { assertValidSubscriptionTransition } from '../companies/subscription-lifecycle.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentFailedEvent,
  type SubscriptionActivatedEvent,
  type SubscriptionRenewedEvent,
  type SubscriptionPastDueEvent,
  type SubscriptionPlanChangedEvent,
  type SubscriptionCancelledEvent,
  type WebhookEvent,
} from '../../ports/payment.port.js';
import { resolveContactQuotaForPlan } from './plan-quota.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { InvoiceEmissionService } from './invoice-emission.service.js';
import { DunningNotificationService } from './dunning-notification.service.js';
import { TrialConversionService } from './trial-conversion.service.js';
import { addDays } from '../../common/date-utils.js';

const PROVIDER_NAME = 'stripe';
const BILLING_PERIOD_DAYS = 30;

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly invoiceEmissionService: InvoiceEmissionService,
    private readonly dunningNotificationService: DunningNotificationService,
    private readonly trialConversionService: TrialConversionService,
  ) {}

  // Order matters and is deliberate:
  //  1. Verify + parse (throws InvalidWebhookSignatureException — no DB
  //     write happens at all for a bad signature).
  //  2. One transaction: insert the dedup marker first, business effect
  //     second. If the marker insert violates the unique constraint, the
  //     whole transaction aborts before any business effect runs, and we
  //     catch that outside the transaction to report "already processed"
  //     without redoing work — same idempotence pattern as
  //     ConversationService.openConversation in Lot 5B.
  //
  // The catch below discriminates WHICH constraint raised 23505 — it does
  // NOT treat every unique violation as "already processed". Two different
  // unique constraints are reachable inside this transaction: the dedup
  // marker itself, and (via activateSubscription's "no eligible row"
  // branch) Lot 6A's UQ_subscriptions_company_active, if a race let two
  // events try to activate two subscriptions for the same company. Only a
  // violation of the dedup marker's constraint means "this is a replay" —
  // any other 23505 is a genuine data-invariant conflict and must surface
  // as a real error (non-2xx, Stripe retries, the incident is visible),
  // never be swallowed into a silent 200.
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ alreadyProcessed: boolean }> {
    const event = this.paymentProvider.verifyAndParseWebhook(
      rawBody,
      signature,
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(ProcessedWebhookEvent).insert({
          providerEventId: event.providerEventId,
          provider: PROVIDER_NAME,
          eventType: event.type,
        });

        await this.applyEffect(event, manager);
      });
    } catch (error) {
      if (
        isUniqueViolation(error, PROCESSED_WEBHOOK_EVENT_UNIQUE_CONSTRAINT)
      ) {
        this.logger.debug(
          `Webhook event ${event.providerEventId} already processed, skipping`,
        );
        return { alreadyProcessed: true };
      }
      throw error;
    }

    return { alreadyProcessed: false };
  }

  private async applyEffect(
    event: WebhookEvent,
    manager: EntityManager,
  ): Promise<void> {
    switch (event.type) {
      case 'subscription.activated':
        await this.activateSubscription(event, manager);
        return;
      case 'subscription.renewed':
        await this.renewSubscription(event, manager);
        return;
      case 'payment.failed':
        await this.markPastDue(event, manager);
        return;
      case 'subscription.past_due':
        await this.markSubscriptionPastDue(event, manager);
        return;
      case 'subscription.plan_changed':
        await this.handlePlanChangeInvoice(event, manager);
        return;
      case 'subscription.cancelled':
        await this.cancelSubscription(event, manager);
        return;
      case 'ignored':
        // Recorded in processed_webhook_events for idempotence/audit, no
        // business effect — see the adapter for why each case ends up here
        // (unhandled event type, or a field change we don't act on).
        return;
    }
  }

  private async activateSubscription(
    event: SubscriptionActivatedEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);
    const quota = resolveContactQuotaForPlan(event.plan, this.configService);

    // Reuses an existing TRIAL/PAST_DUE row when one exists (the common
    // case: a company converting its trial, or reactivating after a
    // payment failure) rather than always inserting — a company with no
    // eligible row (first-ever paid subscription, or resubscribing after
    // CANCELLED/EXPIRED) gets a fresh row instead, consistent with Lot 6A:
    // terminal rows accumulate, they are never resurrected.
    const eligible = await subRepo.findOne({
      where: {
        companyId: event.companyId,
        status: In([SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE]),
      },
      order: { createdAt: 'DESC' },
    });

    let subscription: Subscription;
    const now = new Date();
    // The first paid period end — extended by BILLING_PERIOD_DAYS on each
    // subscription.renewed (renewSubscription below). This does NOT gate
    // access on its own for an ACTIVE row (see
    // SubscriptionGuardService.assertActiveSubscription) — only the
    // status itself does, driven by Stripe webhooks — so imprecision here
    // is informational, not a correctness risk.
    const periodEnd = addDays(now, BILLING_PERIOD_DAYS);

    if (eligible) {
      assertValidSubscriptionTransition(
        eligible.status,
        SubscriptionStatus.ACTIVE,
      );
      eligible.status = SubscriptionStatus.ACTIVE;
      eligible.plan = event.plan;
      eligible.contactQuota = quota;
      eligible.contactsUsed = 0;
      // The Stripe Subscription id, not the Checkout Session id — every
      // recurring event (renewal, dunning, cancellation) references this.
      eligible.externalSubscriptionId = event.providerSubscriptionId;
      eligible.endsAt = periodEnd;
      subscription = await subRepo.save(eligible);
    } else {
      subscription = await subRepo.save(
        subRepo.create({
          companyId: event.companyId,
          plan: event.plan,
          status: SubscriptionStatus.ACTIVE,
          contactQuota: quota,
          contactsUsed: 0,
          externalSubscriptionId: event.providerSubscriptionId,
          startsAt: now,
          endsAt: periodEnd,
        }),
      );
      // UQ_subscriptions_company_active (Lot 6A) is the structural
      // backstop if this "no eligible row" read raced a concurrent
      // activation for the same company — a genuine race here surfaces as
      // a 23505 on THIS constraint, not the dedup marker's, so
      // handleWebhook's catch does not treat it as "already processed": it
      // propagates as a real error, on purpose (see handleWebhook above).
    }

    await this.auditService.log({
      actorId: null,
      action: AuditAction.PAYMENT_RECEIVED,
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: {
        companyId: event.companyId,
        plan: event.plan,
        contactQuota: quota,
        providerEventId: event.providerEventId,
      },
    });

    // Lot 7 (EF-GROW-03) — a company whose trial (possibly extended via a
    // trial code) just converted to a real paid subscription. Same
    // transaction as the activation above, same reasoning as the invoice
    // emission below: a no-op for a company with no trial-code redemption
    // at all, never a separate write that could land without the
    // activation it depends on.
    await this.trialConversionService.markConvertedIfApplicable(
      event.companyId,
      manager,
    );

    // Invoice emission (Lot 6C) — same transaction as the activation
    // above, on purpose: Stripe is the source of truth for the payment,
    // we are the source of truth for the legal invoice, and both must
    // land together or not at all (see invoice-emission.service.ts).
    const company = await manager
      .getRepository(Company)
      .findOneByOrFail({ id: event.companyId });

    await this.invoiceEmissionService.emit(
      { subscription, company, stripeEventId: event.providerEventId },
      manager,
    );
  }

  // A recurring cycle payment (Stripe invoice.paid, billing_reason
  // subscription_cycle). Covers two cases with the same underlying event:
  //  - ACTIVE -> stays ACTIVE: not a status change, so this deliberately
  //    does NOT call assertValidSubscriptionTransition for that case — the
  //    guard rejects same-status "transitions" by design (see
  //    subscription-lifecycle.ts), and this is exactly that: a same-status
  //    data update (extend the period, reset the monthly quota).
  //  - PAST_DUE -> ACTIVE: a Stripe Smart Retry succeeded — the "resumed
  //    payment" path. This DOES go through the guard (a genuine
  //    transition) and clears pastDueSince.
  private async renewSubscription(
    event: SubscriptionRenewedEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);

    const subscription = await subRepo.findOne({
      where: {
        externalSubscriptionId: event.providerSubscriptionId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]),
      },
    });

    // No ACTIVE/PAST_DUE row for this Stripe subscription is a genuine
    // anomaly — e.g. Stripe renewed a subscription we don't have a record
    // of, or one we already consider CANCELLED. Throwing (not silently
    // ignoring) surfaces it as a real error rather than a payment Stripe
    // collected with no corresponding effect on our side.
    if (!subscription) {
      throw new InternalServerErrorException(
        `subscription.renewed for unknown or non-ACTIVE/PAST_DUE Stripe subscription ${event.providerSubscriptionId}`,
      );
    }

    const wasResumedFromPastDue =
      subscription.status === SubscriptionStatus.PAST_DUE;
    if (wasResumedFromPastDue) {
      assertValidSubscriptionTransition(
        subscription.status,
        SubscriptionStatus.ACTIVE,
      );
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.pastDueSince = null;
    }

    subscription.endsAt = addDays(
      subscription.endsAt ?? new Date(),
      BILLING_PERIOD_DAYS,
    );
    // Monthly quota, not reportable across periods (CDC §5.4) — every
    // renewal resets consumption, contactQuota itself is unchanged (same
    // plan; a plan change is Lot 6D commit 4, handled separately).
    subscription.contactsUsed = 0;
    const saved = await subRepo.save(subscription);

    await this.auditService.log({
      actorId: null,
      action: AuditAction.PAYMENT_RECEIVED,
      entityType: 'subscription',
      entityId: saved.id,
      metadata: {
        companyId: saved.companyId,
        renewal: true,
        resumedFromPastDue: wasResumedFromPastDue,
        newPeriodEnd: saved.endsAt,
        providerEventId: event.providerEventId,
      },
    });

    if (wasResumedFromPastDue) {
      await this.dunningNotificationService.notifySubscriptionReactivated(
        saved.companyId,
        manager,
      );
    }

    const company = await manager
      .getRepository(Company)
      .findOneByOrFail({ id: saved.companyId });

    await this.invoiceEmissionService.emit(
      { subscription: saved, company, stripeEventId: event.providerEventId },
      manager,
    );
  }

  private async markPastDue(
    event: PaymentFailedEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);

    const active = await subRepo.findOne({
      where: { companyId: event.companyId, status: SubscriptionStatus.ACTIVE },
    });

    // No ACTIVE row to demote — e.g. a first-time Checkout whose async
    // payment method failed before ever activating anything. Nothing to
    // transition; still recorded via processed_webhook_events above.
    if (!active) {
      await this.auditService.log({
        actorId: null,
        action: AuditAction.PAYMENT_FAILED,
        entityType: 'company',
        entityId: event.companyId,
        metadata: {
          reason: event.reason,
          providerEventId: event.providerEventId,
        },
      });
      return;
    }

    assertValidSubscriptionTransition(
      active.status,
      SubscriptionStatus.PAST_DUE,
    );
    active.status = SubscriptionStatus.PAST_DUE;
    const saved = await subRepo.save(active);

    await this.auditService.log({
      actorId: null,
      action: AuditAction.PAYMENT_FAILED,
      entityType: 'subscription',
      entityId: saved.id,
      metadata: { reason: event.reason, providerEventId: event.providerEventId },
    });
  }

  // invoice.payment_failed on an EXISTING subscription — one of Stripe
  // Smart Retries' attempts (~4 over ~2 weeks per the dashboard config we
  // never reimplement here). No access cut at this point: only the
  // status moves to PAST_DUE, on the FIRST failure only (subsequent
  // retries against an already-PAST_DUE subscription are recorded and
  // still notified, but don't re-attempt a transition or overwrite
  // pastDueSince — the grace-period deadline, Lot 6D commit 3, is
  // measured from the first failure).
  private async markSubscriptionPastDue(
    event: SubscriptionPastDueEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);

    const subscription = await subRepo.findOne({
      where: { externalSubscriptionId: event.providerSubscriptionId },
    });

    if (!subscription) {
      throw new InternalServerErrorException(
        `invoice.payment_failed for unknown Stripe subscription ${event.providerSubscriptionId}`,
      );
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      assertValidSubscriptionTransition(
        subscription.status,
        SubscriptionStatus.PAST_DUE,
      );
      subscription.status = SubscriptionStatus.PAST_DUE;
      subscription.pastDueSince = new Date();
      await subRepo.save(subscription);
    }

    await this.auditService.log({
      actorId: null,
      action: AuditAction.SUBSCRIPTION_PAST_DUE,
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: {
        companyId: subscription.companyId,
        providerEventId: event.providerEventId,
      },
    });

    await this.dunningNotificationService.notifyPaymentFailed(
      subscription.companyId,
      manager,
    );
  }

  // invoice.paid (billing_reason=subscription_update) — the proration
  // invoice for a plan change. Plan and quota are NOT touched here: they
  // were already updated synchronously by
  // SubscriptionCheckoutService.changePlan at the moment the Stripe API
  // call succeeded (immediate quota reajustment is domain logic, not
  // something that should wait on an async webhook). This handler's only
  // job is to emit the legal invoice for the amount Stripe actually
  // charged — never recomputed by hand (see tax.ts computeVatFromTtc).
  private async handlePlanChangeInvoice(
    event: SubscriptionPlanChangedEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subscription = await manager.getRepository(Subscription).findOne({
      where: { externalSubscriptionId: event.providerSubscriptionId },
    });

    if (!subscription) {
      throw new InternalServerErrorException(
        `invoice.paid (subscription_update) for unknown Stripe subscription ${event.providerSubscriptionId}`,
      );
    }

    const company = await manager
      .getRepository(Company)
      .findOneByOrFail({ id: subscription.companyId });

    await this.invoiceEmissionService.emit(
      {
        subscription,
        company,
        stripeEventId: event.providerEventId,
        amountTTCOverride: event.amountTTC,
      },
      manager,
    );

    await this.auditService.log({
      actorId: null,
      action: AuditAction.PAYMENT_RECEIVED,
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: {
        companyId: subscription.companyId,
        proration: true,
        amountTTC: event.amountTTC,
        providerEventId: event.providerEventId,
      },
    });
  }

  // Stripe has given up on this subscription — either
  // customer.subscription.updated flipped it to 'unpaid' (retries
  // exhausted) or customer.subscription.deleted removed it outright.
  // Idempotent against Stripe sending BOTH for the same outcome: a
  // subscription already CANCELLED is a no-op, not a re-thrown guard
  // rejection (CANCELLED -> CANCELLED isn't a valid transition by
  // design — see subscription-lifecycle.ts).
  private async cancelSubscription(
    event: SubscriptionCancelledEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);

    const subscription = await subRepo.findOne({
      where: { externalSubscriptionId: event.providerSubscriptionId },
    });

    if (!subscription) {
      throw new InternalServerErrorException(
        `${event.reason} for unknown Stripe subscription ${event.providerSubscriptionId}`,
      );
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      return;
    }

    assertValidSubscriptionTransition(
      subscription.status,
      SubscriptionStatus.CANCELLED,
    );
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.pastDueSince = null;
    await subRepo.save(subscription);

    await this.auditService.log({
      actorId: null,
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: {
        companyId: subscription.companyId,
        reason: event.reason,
        providerEventId: event.providerEventId,
      },
    });

    await this.dunningNotificationService.notifySubscriptionCancelled(
      subscription.companyId,
      manager,
    );
  }
}
