import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RecruiterInvitationService } from './recruiter-invitation.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

// Public (unauthenticated): the invitee opens the emailed link to view the
// invitation and set a password. Throttled like the other credential endpoints.
@Controller('recruiter-invitations')
export class RecruiterInvitationPublicController {
  constructor(private readonly service: RecruiterInvitationService) {}

  @Get(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async getByToken(@Param('token') token: string) {
    const details = await this.service.getByToken(token);
    if (!details) {
      throw new NotFoundException('Invitation invalide ou expirée.');
    }
    return details;
  }

  @Post('accept')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.service.accept(dto.token, dto.password);
  }
}
