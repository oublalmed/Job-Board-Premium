import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity.js';
import { SettingHistory } from './entities/setting-history.entity.js';
import { SettingsService } from './settings.service.js';
import { SettingsAdminController } from './settings-admin.controller.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting, SettingHistory])],
  controllers: [SettingsAdminController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
