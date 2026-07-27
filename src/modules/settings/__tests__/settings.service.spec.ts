import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings.service.js';
import { Setting } from '../entities/setting.entity.js';

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: Record<string, jest.Mock>;
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

    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(Setting), useValue: repo },
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
  });
});
