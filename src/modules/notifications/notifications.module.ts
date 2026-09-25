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

@Module({
  // User is registered here so the email channel (EF-MSG-02) can resolve a
  // recipient's address; the mailer itself comes from the global PortsModule.
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
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
