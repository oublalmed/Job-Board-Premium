import {
  Controller,
  Post,
  Get,
  Delete,
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
import { ShortlistService } from './shortlist.service.js';
import { AddShortlistEntryDto } from './dto/add-shortlist-entry.dto.js';

@Controller('companies/shortlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
export class ShortlistController {
  constructor(private readonly shortlistService: ShortlistService) {}

  @Post()
  async addEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddShortlistEntryDto,
  ) {
    return this.shortlistService.addEntry(user.sub, dto);
  }

  @Get()
  async listEntries(@CurrentUser() user: JwtPayload) {
    return this.shortlistService.listEntries(user.sub);
  }

  @Delete(':id')
  async removeEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) entryId: string,
  ) {
    await this.shortlistService.removeEntry(user.sub, entryId);
    return { removed: true };
  }
}
