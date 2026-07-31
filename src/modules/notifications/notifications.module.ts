import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { GrowthNotificationService } from './growth-notification.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [NotificationService, GrowthNotificationService],
  exports: [NotificationService, GrowthNotificationService],
})
export class NotificationsModule {}
