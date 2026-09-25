import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { GrowthNotificationService } from './growth-notification.service.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  // User is registered here so the email channel (EF-MSG-02) can resolve a
  // recipient's address; the mailer itself comes from the global PortsModule.
  imports: [TypeOrmModule.forFeature([Notification, User])],
  controllers: [NotificationController],
  providers: [NotificationService, GrowthNotificationService],
  exports: [NotificationService, GrowthNotificationService],
})
export class NotificationsModule {}
