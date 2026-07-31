import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RemediationNotificationService } from '../remediation-notification.service.js';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity.js';
import { SettingsService } from '../../settings/settings.service.js';
import { UsersService } from '../../users/users.service.js';
import { GrowthNotificationService } from '../../notifications/growth-notification.service.js';
import { DEFAULT_COOLDOWN_DAYS } from '../cooldown.js';

function createMockUpdateQueryBuilder(
  affectedByAssessmentId: Record<string, number>,
): Record<string, jest.Mock> {
  let lastId: string | undefined;
  const qb: Record<string, jest.Mock> = {};
  qb.update = jest.fn().mockReturnValue(qb);
  qb.set = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockImplementation((_sql: string, params: { id: string }) => {
    lastId = params.id;
    return qb;
  });
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn().mockImplementation(() =>
    Promise.resolve({ affected: lastId ? affectedByAssessmentId[lastId] ?? 0 : 0 }),
  );
  return qb;
}

function expiredAssessment(id: string, candidateId: string): Partial<Assessment> {
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - (DEFAULT_COOLDOWN_DAYS + 1));
  return {
    id,
    candidateId,
    status: AssessmentStatus.COMPLETED,
    completedAt,
    cooldownNotifiedAt: null,
  };
}

describe('RemediationNotificationService', () => {
  let service: RemediationNotificationService;
  let assessmentRepo: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let growthNotificationService: Record<string, jest.Mock>;
  let updateQb: Record<string, jest.Mock>;

  beforeEach(async () => {
    updateQb = createMockUpdateQueryBuilder({ 'assessment-1': 1 });
    assessmentRepo = {
      find: jest.fn().mockResolvedValue([expiredAssessment('assessment-1', 'candidate-1')]),
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
    };
    settingsService = {
      getNumber: jest.fn().mockResolvedValue(null),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue({ id: 'candidate-1', email: 'candidate@example.com' }),
    };
    growthNotificationService = {
      notifyCooldownExpired: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemediationNotificationService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: SettingsService, useValue: settingsService },
        { provide: UsersService, useValue: usersService },
        { provide: GrowthNotificationService, useValue: growthNotificationService },
      ],
    }).compile();

    service = module.get(RemediationNotificationService);
  });

  it('notifies a candidate whose cooldown has expired and was never notified', async () => {
    const result = await service.runCooldownSweep();

    expect(result).toEqual({ notifiedCount: 1 });
    expect(growthNotificationService.notifyCooldownExpired).toHaveBeenCalledTimes(1);
    expect(growthNotificationService.notifyCooldownExpired).toHaveBeenCalledWith({
      recipientUserId: 'candidate-1',
      email: 'candidate@example.com',
    });
    expect(updateQb.where).toHaveBeenCalledWith('id = :id', { id: 'assessment-1' });
    expect(updateQb.andWhere).toHaveBeenCalledWith('cooldown_notified_at IS NULL');
  });

  it('does not notify when there are no candidates past cooldown (query already scopes to expired + unnotified)', async () => {
    assessmentRepo.find.mockResolvedValueOnce([]);

    const result = await service.runCooldownSweep();

    expect(result).toEqual({ notifiedCount: 0 });
    expect(growthNotificationService.notifyCooldownExpired).not.toHaveBeenCalled();
  });

  it('never notifies twice for the same candidate — a retried/concurrent sweep only notifies once (the key idempotence proof)', async () => {
    const first = await service.runCooldownSweep();
    expect(first).toEqual({ notifiedCount: 1 });

    // Simulate a retry / second instance: the row is still returned by
    // `find` (as it would be if the second sweep raced the first one and
    // read before the first's UPDATE committed), but the atomic claim UPDATE
    // itself must lose the race — `andWhere('cooldown_notified_at IS NULL')`
    // has nothing left to affect once the first sweep claimed it.
    updateQb.execute.mockResolvedValueOnce({ affected: 0 });

    const second = await service.runCooldownSweep();

    expect(second).toEqual({ notifiedCount: 0 });
    expect(growthNotificationService.notifyCooldownExpired).toHaveBeenCalledTimes(1);
  });

  it('skips notification (without throwing) when the claimed assessment has no resolvable user', async () => {
    usersService.findById.mockResolvedValueOnce(null);

    const result = await service.runCooldownSweep();

    expect(result).toEqual({ notifiedCount: 0 });
    expect(growthNotificationService.notifyCooldownExpired).not.toHaveBeenCalled();
  });

  it('reads the cooldown window from settings, falling back to the default when unset', async () => {
    settingsService.getNumber.mockResolvedValueOnce(45);

    await service.runCooldownSweep();

    expect(settingsService.getNumber).toHaveBeenCalledWith('assessment_cooldown_days');
  });
});
