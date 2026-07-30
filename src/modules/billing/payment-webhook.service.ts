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
  type WebhookEvent,
} from '../../ports/payment.port.js';
import { resolveContactQuotaForPlan } from './plan-quota.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { InvoiceEmissionService } from './invoice-emission.service.js';
import { addDays } from './date-utils.js';

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
      case 'subscription.cancelled':
      case 'ignored':
        // subscription.cancelled becomes real in Lot 6D commit 2 (dunning
        // exhausted / cancel_at_period_end fulfilled). Recorded in
        // processed_webhook_events for idempotence/audit either way.
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
  // subscription_cycle) — not a status change (stays ACTIVE), so this
  // deliberately does NOT call assertValidSubscriptionTransition: the
  // guard rejects same-status "transitions" by design (see
  // subscription-lifecycle.ts), and a renewal is exactly that — a
  // same-status data update (extend the period, reset the monthly quota),
  // not a transition.
  private async renewSubscription(
    event: SubscriptionRenewedEvent,
    manager: EntityManager,
  ): Promise<void> {
    const subRepo = manager.getRepository(Subscription);

    const subscription = await subRepo.findOne({
      where: {
        externalSubscriptionId: event.providerSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // No ACTIVE row for this Stripe subscription is a genuine anomaly —
    // e.g. Stripe renewed a subscription we don't have a record of, or one
    // we already consider PAST_DUE/CANCELLED. Throwing (not silently
    // ignoring) surfaces it as a real error rather than a payment Stripe
    // collected with no corresponding effect on our side.
    if (!subscription) {
      throw new InternalServerErrorException(
        `subscription.renewed for unknown or non-ACTIVE Stripe subscription ${event.providerSubscriptionId}`,
      );
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
        newPeriodEnd: saved.endsAt,
        providerEventId: event.providerEventId,
      },
    });

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
}
