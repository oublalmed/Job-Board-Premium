import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { NotificationService } from './notification.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.notificationService.listForUser(user.sub);
  }

  // Mark every unread notification of the caller as read. Declared before the
  // parametrized route so 'read-all' is never captured as an :id.
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationService.markAllRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notificationService.markRead(user.sub, id);
  }
}
