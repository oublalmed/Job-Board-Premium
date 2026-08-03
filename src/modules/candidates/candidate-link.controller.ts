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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateLinkService } from './candidate-link.service.js';
import { CreateProfileLinkDto } from './dto/create-profile-link.dto.js';

// Did not exist at all before Front 1 (EF-CAND-04) — same gap as
// experiences. See PROGRESS.md, Front 1 recon.
@Controller('candidates/links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateLinkController {
  constructor(private readonly linkService: CandidateLinkService) {}

  @Get()
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.linkService.listMine(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProfileLinkDto,
  ) {
    return this.linkService.create(user.sub, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.linkService.remove(user.sub, id);
    return { message: 'Link deleted' };
  }
}
