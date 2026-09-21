import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from './entities/saved-search.entity.js';
import { SearchService } from './search.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

// EF-SRCH-04 — the daily saved-search alert sweep. For each saved search with
// alerts enabled, it counts profiles that became visible in the CVthèque since
// the last alert and, if any, emits ONE in-app notification to the owner and
// advances lastNotifiedAt.
//
// Idempotence is NOT "trust the repeatable job fires once a day" — it is the
// atomic advance of lastNotifiedAt (see claimAdvance below). The sweep reads
// lastNotifiedAt, counts matches newer than it, then conditionally advances it
// to now() only if it has not moved in the meantime. A retried or concurrent
// sweep that read the same value loses that race and emits nothing — so an
// owner is notified at most once per window even under retries/concurrency.
@Injectable()
export class SavedSearchAlertService {
  private readonly logger = new Logger(SavedSearchAlertService.name);

  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepo: Repository<SavedSearch>,
    private readonly searchService: SearchService,
    private readonly notificationService: NotificationService,
  ) {}

  async runAlertSweep(): Promise<{ notifiedCount: number }> {
    const searches = await this.savedSearchRepo.find({
      where: { alertEnabled: true },
    });

    let notifiedCount = 0;

    for (const search of searches) {
      const since = search.lastNotifiedAt;

      const count = await this.searchService.countNewMatches(
        search.criteria,
        since,
      );
      if (count <= 0) {
        // No new matching profiles since the last alert — nothing to notify,
        // and (deliberately) lastNotifiedAt is left untouched so it keeps
        // meaning "the last time we actually told the owner something".
        continue;
      }

      const claimed = await this.claimAdvance(search.id, since);
      if (!claimed) {
        // A concurrent run / retry already advanced this search's window —
        // it (not us) is responsible for its notification. Skip to avoid a
        // duplicate.
        continue;
      }

      await this.notificationService.create({
        recipientUserId: search.ownerUserId,
        type: NotificationType.SAVED_SEARCH_ALERT,
        title: 'Nouveaux candidats pour votre recherche',
        body: `${count} nouveau(x) candidat(s) correspondent à votre recherche « ${search.name} ».`,
      });
      notifiedCount++;
    }

    this.logger.log(
      `Saved-search alert sweep: ${searches.length} enabled search(es), ${notifiedCount} owner(s) notified`,
    );

    return { notifiedCount };
  }

  // Atomic conditional UPDATE, not a read-then-write — same family as the
  // cooldown-notification claim. Advances lastNotifiedAt to now() only when it
  // still equals the value this run read (the `since` guard), so exactly one
  // of any racing runs wins. Returns true only for that winner.
  private async claimAdvance(id: string, since: Date | null): Promise<boolean> {
    const qb = this.savedSearchRepo
      .createQueryBuilder()
      .update(SavedSearch)
      .set({ lastNotifiedAt: () => 'now()' })
      .where('id = :id', { id });

    if (since === null) {
      qb.andWhere('last_notified_at IS NULL');
    } else {
      qb.andWhere('last_notified_at = :since', { since });
    }

    const result = await qb.execute();
    return (result.affected ?? 0) > 0;
  }
}
