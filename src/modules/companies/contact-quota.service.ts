import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, MoreThan, Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from './entities/subscription.entity.js';
import type { ContactQuotaPort } from '../../ports/contact-quota.port.js';
import {
  ContactQuotaExceededException,
  MultipleActiveSubscriptionsException,
  SubscriptionInactiveException,
} from './contact-quota.exceptions.js';

const ACTIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
];

// EF-RECR-05 — a recruiter-facing snapshot of the monthly contact quota, so
// the UI can show "X contacts restants" before the limit is hit. `active` is
// false when there is no single active subscription (also the signal the UI
// uses to explain restricted access, EF-BILL-04) rather than throwing.
export interface ContactQuotaStatus {
  active: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  contactQuota: number | null;
  contactsUsed: number | null;
  contactsRemaining: number | null;
  quotaResetAt: Date | null;
}

@Injectable()
export class ContactQuotaService implements ContactQuotaPort {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  // EF-RECR-05 — read-only quota snapshot. Non-throwing: an inactive or
  // ambiguous subscription state resolves to `active: false` so the caller
  // can render a restricted-access message rather than surface a 4xx.
  async getQuotaStatus(companyId: string): Promise<ContactQuotaStatus> {
    const now = new Date();
    const subscriptions = await this.subscriptionRepo.find({
      where: [
        {
          companyId,
          status: In(ACTIVE_SUBSCRIPTION_STATUSES),
          endsAt: IsNull(),
        },
        {
          companyId,
          status: In(ACTIVE_SUBSCRIPTION_STATUSES),
          endsAt: MoreThan(now),
        },
      ],
    });

    if (subscriptions.length !== 1) {
      return {
        active: false,
        plan: null,
        status: null,
        contactQuota: null,
        contactsUsed: null,
        contactsRemaining: null,
        quotaResetAt: null,
      };
    }

    const subscription = subscriptions[0];
    return {
      active: true,
      plan: subscription.plan,
      status: subscription.status,
      contactQuota: subscription.contactQuota,
      contactsUsed: subscription.contactsUsed,
      contactsRemaining: Math.max(
        0,
        subscription.contactQuota - subscription.contactsUsed,
      ),
      quotaResetAt: subscription.quotaResetAt,
    };
  }

  // manager is optional and defaults to this.subscriptionRepo's own
  // connection (Lot 5A behavior, unchanged). Callers that must decrement
  // the quota atomically alongside other writes — e.g. ConversationService
  // opening a thread — pass the EntityManager of their own
  // dataSource.transaction() so this UPDATE (and the resolve SELECT before
  // it) run inside that same transaction and roll back together with it.
  async consumeOneContact(
    companyId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(Subscription)
      : this.subscriptionRepo;
    const subscriptionId = await this.resolveActiveSubscriptionId(
      companyId,
      repo,
    );

    // A "read quota_used, check in JS, then write" is NOT safe here: two
    // concurrent requests can both read quota_used=4/quota=5, both decide
    // "there's room", and both write quota_used=5 — the quota silently goes
    // one contact over, because the read-decide-write sequence isn't a
    // single operation and Postgres can interleave two connections between
    // the read and the write.
    //
    // A single conditional UPDATE is atomic because Postgres takes a
    // row-level lock for the duration of the UPDATE itself: a second
    // concurrent UPDATE targeting the same row blocks until the first one
    // commits, then evaluates its OWN WHERE clause against the row as the
    // first UPDATE left it. If the first UPDATE already pushed
    // contacts_used to the limit, the second UPDATE's
    // "contacts_used < contact_quota" condition matches zero rows — there is
    // no window in which both can succeed. Targeting the subscription's
    // primary key (rather than company_id, which is NOT unique — see
    // resolveActiveSubscriptionId below) guarantees the lock, and the WHERE,
    // apply to exactly the one row resolved above and never to a sibling row
    // for the same company.
    const result = await repo
      .createQueryBuilder()
      .update(Subscription)
      .set({ contactsUsed: () => 'contacts_used + 1' })
      .where('id = :id', { id: subscriptionId })
      .andWhere('contacts_used < contact_quota')
      .execute();

    if ((result.affected ?? 0) > 0) {
      return;
    }

    // resolveActiveSubscriptionId already guarantees this specific row is
    // active, so an unmatched UPDATE here can only mean the quota guard
    // failed — no ambiguity to resolve with a follow-up read.
    throw new ContactQuotaExceededException(companyId);
  }

  // Subscription.companyId carries no unique constraint in the database
  // (defense-in-depth via a Postgres partial unique index is deferred to
  // Lot 6, see PROGRESS.md), so "the" active subscription for a company is
  // an invariant enforced here, in application code: at most one row with
  // status IN (trial, active) and not expired. Zero or more than one is a
  // failure, not a value to guess from — resolving to a specific id up front
  // (rather than filtering the UPDATE on company_id) is what keeps the
  // atomic UPDATE above from ever touching more than one row.
  private async resolveActiveSubscriptionId(
    companyId: string,
    repo: Repository<Subscription>,
  ): Promise<string> {
    const now = new Date();
    const activeSubscriptions = await repo.find({
      where: [
        {
          companyId,
          status: In(ACTIVE_SUBSCRIPTION_STATUSES),
          endsAt: IsNull(),
        },
        {
          companyId,
          status: In(ACTIVE_SUBSCRIPTION_STATUSES),
          endsAt: MoreThan(now),
        },
      ],
    });

    if (activeSubscriptions.length === 0) {
      throw new SubscriptionInactiveException(companyId);
    }

    if (activeSubscriptions.length > 1) {
      throw new MultipleActiveSubscriptionsException(
        companyId,
        activeSubscriptions.length,
      );
    }

    return activeSubscriptions[0].id;
  }
}
