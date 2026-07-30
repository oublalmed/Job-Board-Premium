import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../companies/entities/subscription.entity.js';
import { assertValidSubscriptionTransition } from '../companies/subscription-lifecycle.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentFailedEvent,
  type SubscriptionActivatedEvent,
  type WebhookEvent,
} from '../../ports/payment.port.js';
import { resolveContactQuotaForPlan } from './plan-quota.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

const PROVIDER_NAME = 'stripe';

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
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
      if (isUniqueViolation(error)) {
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
      case 'payment.failed':
        await this.markPastDue(event, manager);
        return;
      case 'subscription.cancelled':
      case 'ignored':
        // Recorded in processed_webhook_events for idempotence/audit;
        // no further business effect in Lot 6B.
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

    let subscriptionId: string;

    if (eligible) {
      assertValidSubscriptionTransition(
        eligible.status,
        SubscriptionStatus.ACTIVE,
      );
      eligible.status = SubscriptionStatus.ACTIVE;
      eligible.plan = event.plan;
      eligible.contactQuota = quota;
      eligible.contactsUsed = 0;
      eligible.externalSubscriptionId = event.providerSessionId;
      eligible.endsAt = null;
      const saved = await subRepo.save(eligible);
      subscriptionId = saved.id;
    } else {
      const created = await subRepo.save(
        subRepo.create({
          companyId: event.companyId,
          plan: event.plan,
          status: SubscriptionStatus.ACTIVE,
          contactQuota: quota,
          contactsUsed: 0,
          externalSubscriptionId: event.providerSessionId,
          startsAt: new Date(),
          endsAt: null,
        }),
      );
      // UQ_subscriptions_company_active (Lot 6A) is the structural
      // backstop if this "no eligible row" read raced a concurrent
      // activation for the same company — a genuine race here surfaces as
      // a 23505 on this insert, caught by the same idempotence handling
      // as the dedup marker above, one transaction up the call stack.
      subscriptionId = created.id;
    }

    await this.auditService.log({
      actorId: null,
      action: AuditAction.PAYMENT_RECEIVED,
      entityType: 'subscription',
      entityId: subscriptionId,
      metadata: {
        companyId: event.companyId,
        plan: event.plan,
        contactQuota: quota,
        providerEventId: event.providerEventId,
      },
    });
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
