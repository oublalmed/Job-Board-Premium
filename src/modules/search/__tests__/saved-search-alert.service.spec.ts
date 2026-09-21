import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavedSearchAlertService } from '../saved-search-alert.service.js';
import { SavedSearch } from '../entities/saved-search.entity.js';
import { SearchService } from '../search.service.js';
import { NotificationService } from '../../notifications/notification.service.js';
import { NotificationType } from '../../notifications/entities/notification.entity.js';

function makeSaved(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    ownerUserId: 'owner-1',
    name: 'Backend devs Casa',
    criteria: { q: 'node', location: 'Casablanca' },
    alertEnabled: true,
    lastNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: undefined as never,
    ...overrides,
  };
}

// A minimal UPDATE query-builder that reports the claim's affected rows.
function createMockUpdateQueryBuilder(affected: number): {
  qb: Record<string, jest.Mock>;
  setAffected: (n: number) => void;
} {
  let currentAffected = affected;
  const qb: Record<string, jest.Mock> = {};
  qb.update = jest.fn().mockReturnValue(qb);
  qb.set = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.execute = jest
    .fn()
    .mockImplementation(() => Promise.resolve({ affected: currentAffected }));
  return { qb, setAffected: (n: number) => (currentAffected = n) };
}

describe('SavedSearchAlertService', () => {
  let service: SavedSearchAlertService;
  let repo: Record<string, jest.Mock>;
  let searchService: Record<string, jest.Mock>;
  let notificationService: Record<string, jest.Mock>;
  let updateQb: ReturnType<typeof createMockUpdateQueryBuilder>;

  beforeEach(async () => {
    updateQb = createMockUpdateQueryBuilder(1);
    repo = {
      find: jest.fn().mockResolvedValue([makeSaved()]),
      createQueryBuilder: jest.fn().mockReturnValue(updateQb.qb),
    };
    searchService = {
      countNewMatches: jest.fn().mockResolvedValue(3),
    };
    notificationService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedSearchAlertService,
        { provide: getRepositoryToken(SavedSearch), useValue: repo },
        { provide: SearchService, useValue: searchService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(SavedSearchAlertService);
  });

  it('only ever considers alert-enabled searches', async () => {
    await service.runAlertSweep();
    expect(repo.find).toHaveBeenCalledWith({ where: { alertEnabled: true } });
  });

  it('emits ONE in-app notification to the owner when new matches exist', async () => {
    const result = await service.runAlertSweep();

    expect(result).toEqual({ notifiedCount: 1 });
    expect(notificationService.create).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'owner-1',
        type: NotificationType.SAVED_SEARCH_ALERT,
      }),
    );
    // The body carries the count and the saved search's name.
    const arg = notificationService.create.mock.calls[0][0] as {
      body: string;
    };
    expect(arg.body).toContain('3');
    expect(arg.body).toContain('Backend devs Casa');
  });

  it('counts only matches newer than lastNotifiedAt (freshness window)', async () => {
    const since = new Date('2026-01-01T00:00:00Z');
    repo.find.mockResolvedValueOnce([makeSaved({ lastNotifiedAt: since })]);

    await service.runAlertSweep();

    expect(searchService.countNewMatches).toHaveBeenCalledWith(
      { q: 'node', location: 'Casablanca' },
      since,
    );
  });

  it('advances lastNotifiedAt atomically, guarded by the value it read (null)', async () => {
    await service.runAlertSweep();

    expect(updateQb.qb.set).toHaveBeenCalledWith({
      lastNotifiedAt: expect.any(Function),
    });
    expect(updateQb.qb.where).toHaveBeenCalledWith('id = :id', {
      id: 'search-1',
    });
    // A never-notified search claims on `last_notified_at IS NULL`.
    expect(updateQb.qb.andWhere).toHaveBeenCalledWith(
      'last_notified_at IS NULL',
    );
  });

  it('advances against the previous timestamp when one exists', async () => {
    const since = new Date('2026-01-01T00:00:00Z');
    repo.find.mockResolvedValueOnce([makeSaved({ lastNotifiedAt: since })]);

    await service.runAlertSweep();

    expect(updateQb.qb.andWhere).toHaveBeenCalledWith(
      'last_notified_at = :since',
      {
        since,
      },
    );
  });

  it('is a no-op (no notification, no claim) when there are no new matches', async () => {
    searchService.countNewMatches.mockResolvedValueOnce(0);

    const result = await service.runAlertSweep();

    expect(result).toEqual({ notifiedCount: 0 });
    expect(notificationService.create).not.toHaveBeenCalled();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('never notifies twice — a retried/concurrent sweep that loses the claim emits nothing', async () => {
    // Matches still counted, but the atomic advance affects 0 rows because a
    // concurrent run already advanced the window — the claim is what enforces
    // exactly-once, not the count.
    updateQb.setAffected(0);

    const result = await service.runAlertSweep();

    expect(result).toEqual({ notifiedCount: 0 });
    expect(notificationService.create).not.toHaveBeenCalled();
  });
});
