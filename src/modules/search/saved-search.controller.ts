import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SavedSearchService } from './saved-search.service.js';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto.js';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto.js';
import {
  SavedSearchResponse,
  toSavedSearchResponse,
} from './dto/saved-search-response.dto.js';

// EF-SRCH-04 — saved searches are a recruiter feature: RECRUITER and
// COMPANY_ADMIN only. The owner is always the authenticated user (user.sub),
// never a body value, and the service scopes every read/write by that owner.
@Controller('saved-searches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
export class SavedSearchController {
  constructor(private readonly savedSearchService: SavedSearchService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSavedSearchDto,
  ): Promise<SavedSearchResponse> {
    const created = await this.savedSearchService.create(user.sub, dto);
    return toSavedSearchResponse(created);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload): Promise<SavedSearchResponse[]> {
    const items = await this.savedSearchService.listOwn(user.sub);
    return items.map(toSavedSearchResponse);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
  ): Promise<SavedSearchResponse> {
    const updated = await this.savedSearchService.update(user.sub, id, dto);
    return toSavedSearchResponse(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.savedSearchService.remove(user.sub, id);
  }
}
