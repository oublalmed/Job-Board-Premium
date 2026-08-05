import { Controller, Get, Param } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ScoreBadgeService } from './score-badge.service.js';
import { PublicBadgeDto } from './dto/public-badge.dto.js';

// EF-GROW-01 (Lot 7) — the PUBLIC showcase page's data source. Intentionally
// unguarded (no JwtAuthGuard): the whole point is a shareable link (LinkedIn/
// public URL). Only opt-in, enabled badges resolve; the payload carries no
// sensitive data (see PublicBadgeDto).
@Controller('badges')
export class PublicBadgeController {
  constructor(private readonly service: ScoreBadgeService) {}

  @Get(':token')
  @ApiResponse({ status: 200, type: PublicBadgeDto })
  get(@Param('token') token: string) {
    return this.service.getPublic(token);
  }
}
