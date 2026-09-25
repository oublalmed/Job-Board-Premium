import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity.js';

export interface RetentionSweepResult {
  deletedNotifications: number;
  cutoff: string;
}

// ENF-12 — enforce the data-retention policy for transient records. Read
// notifications are UX ephemera: once acknowledged and past the retention
// window they carry no legal or product value, so they are purged. Records
// with their own regulatory retention (audit log, invoices, data-requests)
// are deliberately NOT touched here — deleting them would breach, not honour,
// the retention obligation.
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly configService: ConfigService,
  ) {}

  async sweep(): Promise<RetentionSweepResult> {
    const days = this.configService.get<number>(
      'business.notificationRetentionDays',
      90,
    );
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Only READ notifications older than the window — an unread notification is
    // still actionable and is never purged regardless of age.
    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .where('read_at IS NOT NULL')
      .andWhere('created_at < :cutoff', { cutoff })
      .execute();

    const deletedNotifications = result.affected ?? 0;
    this.logger.log(
      `Retention sweep: purged ${deletedNotifications} read notification(s) older than ${days}d (before ${cutoff.toISOString()})`,
    );
    return { deletedNotifications, cutoff: cutoff.toISOString() };
  }
}
