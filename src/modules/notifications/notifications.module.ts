import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { GrowthNotificationService } from './growth-notification.service.js';
import { DataRetentionService } from './data-retention.service.js';
import { DataRetentionProcessor } from './data-retention.processor.js';
import { DataRetentionSchedulerService } from './data-retention-scheduler.service.js';
import { DATA_RETENTION_QUEUE } from './data-retention.constants.js';
import { User } from '../users/entities/user.entity.js';
import { RefreshToken } from '../users/entities/refresh-token.entity.js';
import { ProfileViewCooldown } from '../search/entities/profile-view-cooldown.entity.js';
import { ProcessedWebhookEvent } from '../billing/entities/processed-webhook-event.entity.js';

@Module({
  // User is registered here so the email channel (EF-MSG-02) can resolve a
  // recipient's address; the mailer itself comes from the global PortsModule.
  imports: [
    // ENF-12 — the retention sweep purges these transient tables; each repo is
    // registered here so DataRetentionService can inject it. User backs the
    // email channel (EF-MSG-02).
    TypeOrmModule.forFeature([
      Notification,
      User,
      RefreshToken,
      ProfileViewCooldown,
      ProcessedWebhookEvent,
    ]),
    // ENF-12 — the repeatable data-retention sweep runs on its own queue.
    BullModule.registerQueue({ name: DATA_RETENTION_QUEUE }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    GrowthNotificationService,
    DataRetentionService,
    DataRetentionProcessor,
    DataRetentionSchedulerService,
  ],
  exports: [
    NotificationService,
    GrowthNotificationService,
    DataRetentionService,
  ],
})
export class NotificationsModule {}
