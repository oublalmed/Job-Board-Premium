import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../common/guards/staff-mfa.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SettingsService } from './settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { UpdateSettingDto } from './dto/update-setting.dto.js';

// EF-ADM-02 — admin management of versioned reference data. Previously the
// settings store had no write endpoint at all (only internal services called
// .set()). ADMIN-only; every change is written to the audit trail (which
// serves as the change history until a dedicated version table exists).
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard, StaffMfaGuard)
@Roles(Role.ADMIN)
export class SettingsAdminController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list() {
    const settings = await this.settingsService.getAll();
    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      description: s.description,
      valueType: s.valueType,
      updatedAt: s.updatedAt,
    }));
  }

  @Put(':key')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    const setting = await this.settingsService.set(
      key,
      dto.value,
      dto.description,
      undefined,
      user.sub,
    );
    await this.auditService.log({
      actorId: user.sub,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: 'setting',
      entityId: key,
      metadata: { value: dto.value },
    });
    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updatedAt: setting.updatedAt,
    };
  }

  // EF-ADM-02 — the version history for one setting key (newest first).
  @Get(':key/history')
  async history(@Param('key') key: string) {
    const rows = await this.settingsService.getHistory(key);
    return rows.map((h) => ({
      id: h.id,
      key: h.key,
      value: h.value,
      description: h.description,
      valueType: h.valueType,
      changedById: h.changedById,
      createdAt: h.createdAt,
    }));
  }
}
