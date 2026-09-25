import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Setting } from './entities/setting.entity.js';
import { SettingHistory } from './entities/setting-history.entity.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(SettingHistory)
    private readonly historyRepository: Repository<SettingHistory>,
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
    // EF-ADM-02 — the staff user making the change (null for automated/system
    // writes). Recorded on the version-history row.
    changedById: string | null = null,
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

    // EF-ADM-02 — append a version-history row capturing the value as of this
    // change. Best-effort: history is an audit aid, never a reason to fail the
    // write the caller asked for.
    try {
      await this.historyRepository.save(
        this.historyRepository.create({
          key: saved.key,
          value: saved.value,
          description: saved.description,
          valueType: saved.valueType,
          changedById,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record setting history for ${key}: ${(error as Error).message}`,
      );
    }

    this.logger.log(`Setting updated: ${key}=${value}`);
    return saved;
  }

  async getAll(): Promise<Setting[]> {
    return this.settingRepository.find({ order: { key: 'ASC' } });
  }

  // EF-ADM-02 — the change history for one setting key, newest first.
  async getHistory(key: string, limit = 50): Promise<SettingHistory[]> {
    return this.historyRepository.find({
      where: { key },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
