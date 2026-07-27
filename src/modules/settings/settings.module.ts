import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
