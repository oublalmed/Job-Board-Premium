import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavedSearchService } from '../saved-search.service.js';
import { SavedSearch } from '../entities/saved-search.entity.js';

const OWNER = 'owner-1';
const OTHER = 'owner-2';

function makeSaved(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    ownerUserId: OWNER,
    name: 'Backend devs Casa',
    criteria: { q: 'node', skills: ['React'], location: 'Casablanca' },
    alertEnabled: false,
    lastNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: undefined as never,
    ...overrides,
  };
}

describe('SavedSearchService', () => {
  let service: SavedSearchService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((v: object) => v),
      save: jest.fn().mockImplementation((v: object) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedSearchService,
        { provide: getRepositoryToken(SavedSearch), useValue: repo },
      ],
    }).compile();

    service = module.get(SavedSearchService);
  });

  describe('create', () => {
    it('stamps the owner from the authenticated user, never the body', async () => {
      await service.create(OWNER, {
        name: 'My search',
        criteria: { q: 'node' },
        alertEnabled: true,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: OWNER,
          name: 'My search',
          criteria: { q: 'node' },
          alertEnabled: true,
        }),
      );
    });

    it('defaults alertEnabled to false when omitted', async () => {
      await service.create(OWNER, {
        name: 'My search',
        criteria: { q: 'node' },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ alertEnabled: false }),
      );
    });
  });

  describe('listOwn', () => {
    it('scopes the list to the owner only', async () => {
      repo.find.mockResolvedValueOnce([makeSaved()]);

      const result = await service.listOwn(OWNER);

      expect(repo.find).toHaveBeenCalledWith({
        where: { ownerUserId: OWNER },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates only the provided fields of an owned search', async () => {
      repo.findOne.mockResolvedValueOnce(makeSaved());

      await service.update(OWNER, 'search-1', { alertEnabled: true });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'search-1', ownerUserId: OWNER },
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'search-1', alertEnabled: true }),
      );
    });

    it("cannot touch another owner's saved search (404, no write)", async () => {
      // findOne is scoped by owner, so another owner's id resolves to null.
      repo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(OTHER, 'search-1', { name: 'hijack' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'search-1', ownerUserId: OTHER },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an owned search (owner-scoped DELETE)', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 1 });

      await service.remove(OWNER, 'search-1');

      expect(repo.delete).toHaveBeenCalledWith({
        id: 'search-1',
        ownerUserId: OWNER,
      });
    });

    it("cannot delete another owner's saved search (affects 0 rows -> 404)", async () => {
      repo.delete.mockResolvedValueOnce({ affected: 0 });

      await expect(service.remove(OTHER, 'search-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.delete).toHaveBeenCalledWith({
        id: 'search-1',
        ownerUserId: OTHER,
      });
    });
  });
});
