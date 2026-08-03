import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogService } from '../catalog.service.js';
import { Specialty } from '../entities/specialty.entity.js';
import { Test as TestEntity } from '../entities/test.entity.js';

describe('CatalogService', () => {
  let service: CatalogService;
  let specialtyRepo: Record<string, jest.Mock>;
  let testRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    specialtyRepo = { find: jest.fn() };
    testRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Specialty), useValue: specialtyRepo },
        { provide: getRepositoryToken(TestEntity), useValue: testRepo },
      ],
    }).compile();

    service = module.get(CatalogService);
  });

  describe('listSpecialties', () => {
    it('returns only active specialties, mapped to a summary shape', async () => {
      specialtyRepo.find.mockResolvedValue([
        { id: 's1', name: 'Backend', description: 'desc', active: true },
      ]);

      const result = await service.listSpecialties();

      expect(specialtyRepo.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual([
        { id: 's1', name: 'Backend', description: 'desc' },
      ]);
    });
  });

  describe('listTests', () => {
    it('returns active tests without leaking vendor fields (provider, externalTestId)', async () => {
      testRepo.find.mockResolvedValue([
        {
          id: 't1',
          specialtyId: 's1',
          durationMinutes: 60,
          provider: 'acme-vendor',
          externalTestId: 'ext-secret-123',
          active: true,
        },
      ]);

      const result = await service.listTests();

      expect(result).toEqual([
        { id: 't1', specialtyId: 's1', durationMinutes: 60 },
      ]);
      expect(result[0]).not.toHaveProperty('provider');
      expect(result[0]).not.toHaveProperty('externalTestId');
    });

    it('filters by specialtyId when provided', async () => {
      testRepo.find.mockResolvedValue([]);

      await service.listTests('s1');

      expect(testRepo.find).toHaveBeenCalledWith({
        where: { active: true, specialtyId: 's1' },
        order: { createdAt: 'ASC' },
      });
    });
  });
});
