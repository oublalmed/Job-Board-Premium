import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings.service.js';
import { Setting } from '../entities/setting.entity.js';
import { SettingHistory } from '../entities/setting-history.entity.js';

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: Record<string, jest.Mock>;
  let historyRepo: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((entity: any) => entity),
      save: jest.fn().mockImplementation((entity: any) =>
        Promise.resolve({
          id: 'setting-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...entity,
        }),
      ),
    };

    historyRepo = {
      create: jest.fn().mockImplementation((entity: unknown) => entity),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(Setting), useValue: repo },
        { provide: getRepositoryToken(SettingHistory), useValue: historyRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('get', () => {
    it('should return value from DB if exists', async () => {
      repo['findOne'].mockResolvedValue({
        id: '1',
        key: 'indexation_score_threshold',
        value: '50',
      });

      const result = await service.get('indexation_score_threshold');
      expect(result).toBe('50');
    });

    it('should fall back to env var if not in DB', async () => {
      repo['findOne'].mockResolvedValue(null);
      configService['get'].mockReturnValue('40');

      const result = await service.get(
        'indexation_score_threshold',
        'INDEXATION_SCORE_THRESHOLD',
      );
      expect(result).toBe('40');
    });

    it('should return null if not found anywhere', async () => {
      repo['findOne'].mockResolvedValue(null);
      const result = await service.get('nonexistent_key');
      expect(result).toBeNull();
    });
  });

  describe('getNumber', () => {
    it('should return a number from DB', async () => {
      repo['findOne'].mockResolvedValue({
        id: '1',
        key: 'threshold',
        value: '75',
      });

      const result = await service.getNumber('threshold');
      expect(result).toBe(75);
    });

    it('should return null for non-numeric value', async () => {
      repo['findOne'].mockResolvedValue({
        id: '1',
        key: 'bad',
        value: 'not-a-number',
      });

      const result = await service.getNumber('bad');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should create a new setting', async () => {
      repo['findOne'].mockResolvedValue(null);

      const result = await service.set(
        'new_key',
        '100',
        'A new setting',
        'number',
      );
      expect(repo['save']).toHaveBeenCalled();
      expect(result.key).toBe('new_key');
      expect(result.value).toBe('100');
    });

    it('should update an existing setting', async () => {
      repo['findOne'].mockResolvedValue({
        id: '1',
        key: 'existing_key',
        value: 'old',
        description: 'old desc',
        valueType: 'string',
      });

      await service.set('existing_key', 'new_value');
      expect(repo['save']).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'new_value' }),
      );
    });

    it('records a version-history row on every change (EF-ADM-02)', async () => {
      repo['findOne'].mockResolvedValue(null);
      await service.set('k', 'v', 'desc', 'string', 'admin-user-1');
      expect(historyRepo['save']).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'k',
          value: 'v',
          changedById: 'admin-user-1',
        }),
      );
    });

    it('does not fail the write if history persistence throws', async () => {
      repo['findOne'].mockResolvedValue(null);
      historyRepo['save'].mockRejectedValueOnce(new Error('db down'));
      const result = await service.set('k', 'v');
      expect(result.value).toBe('v'); // the setting write still succeeds
    });
  });

  describe('getHistory (EF-ADM-02)', () => {
    it('returns history for a key, newest first', async () => {
      const rows = [{ id: 'h1', key: 'k', value: 'v2' }];
      historyRepo['find'].mockResolvedValue(rows);
      const result = await service.getHistory('k');
      expect(historyRepo['find']).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'k' },
          order: { createdAt: 'DESC' },
        }),
      );
      expect(result).toBe(rows);
    });
  });
});
