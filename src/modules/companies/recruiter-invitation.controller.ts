import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { RecruiterInvitationService } from './recruiter-invitation.service.js';
import { InviteRecruiterDto } from './dto/invite-recruiter.dto.js';

// Company-admin manages their team's seats: invite a teammate by email (the
// invitee sets their own password), list pending invitations, and revoke them.
@Controller('companies/recruiters/invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.COMPANY_ADMIN)
export class RecruiterInvitationController {
  constructor(private readonly service: RecruiterInvitationService) {}

  @Post()
  async invite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteRecruiterDto,
  ) {
    return this.service.invite(user.sub, dto);
  }

  @Get()
  async listPending(@CurrentUser() user: JwtPayload) {
    return this.service.listPending(user.sub);
  }

  @Delete(':id')
  async revoke(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.revoke(user.sub, id);
    return { message: 'Invitation révoquée' };
  }
}
