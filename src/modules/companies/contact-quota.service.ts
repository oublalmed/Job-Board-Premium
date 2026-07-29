import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity.js';
import type { ContactQuotaPort } from '../../ports/contact-quota.port.js';
import {
  ContactQuotaExceededException,
  SubscriptionInactiveException,
} from './contact-quota.exceptions.js';

const ACTIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
];

@Injectable()
export class ContactQuotaService implements ContactQuotaPort {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async consumeOneContact(companyId: string): Promise<void> {
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
    // no window in which both can succeed.
    const result = await this.subscriptionRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({ contactsUsed: () => 'contacts_used + 1' })
      .where('company_id = :companyId', { companyId })
      .andWhere('status IN (:...statuses)', {
        statuses: ACTIVE_SUBSCRIPTION_STATUSES,
      })
      .andWhere('(ends_at IS NULL OR ends_at > :now)', { now: new Date() })
      .andWhere('contacts_used < contact_quota')
      .execute();

    if ((result.affected ?? 0) > 0) {
      return;
    }

    // The UPDATE matched no row. This read happens only on the failure
    // path, after the atomic write above has already failed — it cannot
    // reintroduce the race the UPDATE was written to avoid, it only picks
    // the right exception to throw.
    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });

    const isActive =
      !!subscription &&
      ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) &&
      (!subscription.endsAt || subscription.endsAt > new Date());

    if (!isActive) {
      throw new SubscriptionInactiveException(companyId);
    }

    throw new ContactQuotaExceededException(companyId);
  }
}
