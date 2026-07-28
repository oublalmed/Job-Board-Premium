import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { JobOfferService } from './job-offer.service.js';
import { CreateJobOfferDto } from './dto/create-job-offer.dto.js';
import { ModerateJobOfferDto } from './dto/moderate-job-offer.dto.js';

@Controller('companies/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobOfferController {
  constructor(private readonly jobOfferService: JobOfferService) {}

  @Post()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async createOffer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJobOfferDto,
  ) {
    return this.jobOfferService.createOffer(user.sub, dto);
  }

  @Get()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async listOffers(@CurrentUser() user: JwtPayload) {
    return this.jobOfferService.listOffers(user.sub);
  }

  @Patch(':id/close')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async closeOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) offerId: string,
  ) {
    return this.jobOfferService.closeOffer(user.sub, offerId);
  }

  @Patch(':id/moderate')
  @Roles(Role.ADMIN, Role.MODERATOR)
  async moderateOffer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) offerId: string,
    @Body() dto: ModerateJobOfferDto,
  ) {
    return this.jobOfferService.moderateOffer(user.sub, offerId, dto);
  }
}
