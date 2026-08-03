import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfileWithCompletenessDto } from './dto/profile-with-completeness.dto.js';
import { CompletenessResultDto } from './dto/completeness-result.dto.js';

@Controller('candidates/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateProfileController {
  constructor(private readonly profileService: CandidateProfileService) {}

  @Get()
  @ApiResponse({ status: 200, type: ProfileWithCompletenessDto })
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    let profile = await this.profileService.findByUserId(user.sub);
    if (!profile) {
      profile = await this.profileService.createProfile(user.sub);
    }
    const completeness = await this.profileService.calculateCompleteness(
      profile.id,
    );
    return { profile, completeness };
  }

  @Put()
  @ApiResponse({ status: 200, type: ProfileWithCompletenessDto })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    let profile = await this.profileService.findByUserId(user.sub);
    if (!profile) {
      profile = await this.profileService.createProfile(user.sub);
    }
    const updated = await this.profileService.updateProfile(profile.id, dto);
    const completeness = await this.profileService.calculateCompleteness(
      updated.id,
    );
    return { profile: updated, completeness };
  }

  @Get('completeness')
  @ApiResponse({ status: 200, type: CompletenessResultDto })
  async getCompleteness(@CurrentUser() user: JwtPayload) {
    const profile = await this.profileService.findByUserId(user.sub);
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return this.profileService.calculateCompleteness(profile.id);
  }
}
