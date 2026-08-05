import { Controller, Get, Param } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ReferralService } from './referral.service.js';
import { ReferralValidityDto } from './dto/referral-validity.dto.js';

// EF-GROW-02 (Lot 7) — PUBLIC probe so the registration page can confirm an
// invite code is valid. Returns only a boolean; never who referred you.
@Controller('referrals')
export class PublicReferralController {
  constructor(private readonly service: ReferralService) {}

  @Get(':code')
  @ApiResponse({ status: 200, type: ReferralValidityDto })
  async validate(@Param('code') code: string): Promise<ReferralValidityDto> {
    return { valid: await this.service.validateCode(code) };
  }
}
