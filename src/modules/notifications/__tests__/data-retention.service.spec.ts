import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataRetentionService } from '../data-retention.service.js';
import { Notification } from '../entities/notification.entity.js';
import { RefreshToken } from '../../users/entities/refresh-token.entity.js';
import { ProfileViewCooldown } from '../../search/entities/profile-view-cooldown.entity.js';
import { ProcessedWebhookEvent } from '../../billing/entities/processed-webhook-event.entity.js';

// A delete query-builder mock that records the where/andWhere clauses and
// returns a configurable affected count. Supports both the one-clause
// (.where().execute()) and two-clause (.where().andWhere().execute()) shapes.
interface DeleteQbMock {
  createQueryBuilder: jest.Mock;
  whereCalls: unknown[][];
  andWhereCalls: unknown[][];
  setAffected: (n: number | null) => void;
  fail: (message: string) => void;
}

function makeDeleteRepo(affected: number): DeleteQbMock {
  const whereCalls: unknown[][] = [];
  const andWhereCalls: unknown[][] = [];
  let affectedValue: number | null = affected;
  let error: Error | null = null;

  const execute = jest.fn(() =>
    error
      ? Promise.reject(error)
      : Promise.resolve({ affected: affectedValue }),
  );
  const chain = {
    where: jest.fn((...args: unknown[]) => {
      whereCalls.push(args);
      return chain;
    }),
    andWhere: jest.fn((...args: unknown[]) => {
      andWhereCalls.push(args);
      return chain;
    }),
    execute,
  };
  const qb = { delete: jest.fn().mockReturnValue(chain) };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    whereCalls,
    andWhereCalls,
    setAffected: (n) => {
      affectedValue = n;
    },
    fail: (message) => {
      error = new Error(message);
    },
  };
}

describe('DataRetentionService (ENF-12)', () => {
  let service: DataRetentionService;
  let notifications: DeleteQbMock;
  let refreshTokens: DeleteQbMock;
  let cooldowns: DeleteQbMock;
  let webhookEvents: DeleteQbMock;
  let configService: { get: jest.Mock };

  const windows: Record<string, number> = {
    'business.notificationRetentionDays': 90,
    'business.refreshTokenRetentionDays': 30,
    'business.profileViewCooldownRetentionDays': 30,
    'business.webhookEventRetentionDays': 90,
  };

  beforeEach(async () => {
    notifications = makeDeleteRepo(7);
    refreshTokens = makeDeleteRepo(4);
    cooldowns = makeDeleteRepo(3);
    webhookEvents = makeDeleteRepo(2);
    configService = {
      get: jest.fn(
        (key: string, fallback?: number) => windows[key] ?? fallback,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        { provide: getRepositoryToken(Notification), useValue: notifications },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokens },
        {
          provide: getRepositoryToken(ProfileViewCooldown),
          useValue: cooldowns,
        },
        {
          provide: getRepositoryToken(ProcessedWebhookEvent),
          useValue: webhookEvents,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DataRetentionService);
  });

  it('purges only READ notifications older than the retention window', async () => {
    const before = Date.now();
    const result = await service.sweep();

    expect(notifications.whereCalls[0][0]).toBe('read_at IS NOT NULL');
    const [clause, params] = notifications.andWhereCalls[0] as [
      string,
      { cutoff: Date },
    ];
    expect(clause).toContain('created_at <');
    const expected = before - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(params.cutoff.getTime() - expected)).toBeLessThan(5000);
    expect(result.deletedNotifications).toBe(7);
  });

  it('purges dead (revoked or expired) refresh tokens older than the window, sparing live sessions', async () => {
    const before = Date.now();
    const result = await service.sweep();

    const [ageClause, ageParams] = refreshTokens.whereCalls[0] as [
      string,
      { cutoff: Date },
    ];
    expect(ageClause).toContain('created_at <');
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ageParams.cutoff.getTime() - expected)).toBeLessThan(5000);
    // Dead-token predicate: revoked OR past expiry.
    const [deadClause] = refreshTokens.andWhereCalls[0] as [string];
    expect(deadClause).toContain('revoked = true');
    expect(deadClause).toContain('expires_at <');
    expect(result.deletedRefreshTokens).toBe(4);
  });

  it('purges stale profile-view cooldown rows past the window', async () => {
    const result = await service.sweep();
    const [clause, params] = cooldowns.whereCalls[0] as [
      string,
      { cutoff: Date },
    ];
    expect(clause).toContain('last_notified_at <');
    expect(params.cutoff).toBeInstanceOf(Date);
    expect(result.deletedProfileViewCooldowns).toBe(3);
  });

  it('purges processed-webhook idempotency markers past the window', async () => {
    const result = await service.sweep();
    const [clause] = webhookEvents.whereCalls[0] as [string];
    expect(clause).toContain('processed_at <');
    expect(result.deletedWebhookEvents).toBe(2);
  });

  it('honours a configured retention window per type', async () => {
    windows['business.refreshTokenRetentionDays'] = 7;
    const before = Date.now();
    await service.sweep();
    const params = refreshTokens.whereCalls[0][1] as { cutoff: Date };
    const expected = before - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(params.cutoff.getTime() - expected)).toBeLessThan(5000);
  });

  it('reports zero when nothing matched (affected null)', async () => {
    notifications.setAffected(null);
    const result = await service.sweep();
    expect(result.deletedNotifications).toBe(0);
  });

  it('is resilient: one failing purge does not strand the others', async () => {
    cooldowns.fail('connection reset');
    const result = await service.sweep();
    // The failing table reports 0, the others still run.
    expect(result.deletedProfileViewCooldowns).toBe(0);
    expect(result.deletedNotifications).toBe(7);
    expect(result.deletedRefreshTokens).toBe(4);
    expect(result.deletedWebhookEvents).toBe(2);
  });
});
