import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Setting } from './entities/setting.entity.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

  async get(key: string, fallbackEnvKey?: string): Promise<string | null> {
    const dbSetting = await this.settingRepository.findOne({ where: { key } });
    if (dbSetting) {
      return dbSetting.value;
    }

    if (fallbackEnvKey) {
      return this.configService.get<string>(fallbackEnvKey) ?? null;
    }

    return null;
  }

  async getNumber(
    key: string,
    fallbackEnvKey?: string,
  ): Promise<number | null> {
    const value = await this.get(key, fallbackEnvKey);
    if (value === null) return null;
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  async set(
    key: string,
    value: string,
    description?: string,
    valueType = 'string',
  ): Promise<Setting> {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (description !== undefined) setting.description = description;
      setting.valueType = valueType;
    } else {
      setting = this.settingRepository.create({
        key,
        value,
        description: description ?? null,
        valueType,
      });
    }

    const saved = await this.settingRepository.save(setting);
    this.logger.log(`Setting updated: ${key}=${value}`);
    return saved;
  }

  async getAll(): Promise<Setting[]> {
    return this.settingRepository.find({ order: { key: 'ASC' } });
  }
}
