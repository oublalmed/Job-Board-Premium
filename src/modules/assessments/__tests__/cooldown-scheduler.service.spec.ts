import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CooldownSchedulerService } from '../cooldown-scheduler.service.js';
import {
  COOLDOWN_QUEUE,
  COOLDOWN_SWEEP_JOB_ID,
  COOLDOWN_SWEEP_JOB_NAME,
} from '../cooldown-queue.constants.js';

describe('CooldownSchedulerService', () => {
  let service: CooldownSchedulerService;
  let queue: { add: jest.Mock; on: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    queue = {
      add: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('0 3 * * *'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooldownSchedulerService,
        { provide: getQueueToken(COOLDOWN_QUEUE), useValue: queue },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(CooldownSchedulerService);
  });

  it('attaches an error listener to the queue in the constructor', () => {
    expect(queue.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('registers the repeatable job with a fixed jobId (idempotent registration) using the configured cron', async () => {
    await service.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      COOLDOWN_SWEEP_JOB_NAME,
      {},
      { repeat: { pattern: '0 3 * * *' }, jobId: COOLDOWN_SWEEP_JOB_ID },
    );
  });

  it('does not throw when registration fails (e.g. Redis unreachable) — app boot continues without it', async () => {
    queue.add.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('does not leave a dangling timer once registration resolves quickly (no lingering setTimeout after the race settles)', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await service.onModuleInit();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('falls back to the warning path when registration is too slow (bounded by the registration timeout)', async () => {
    jest.useFakeTimers();
    queue.add.mockReturnValue(new Promise(() => {})); // never resolves
    const loggerWarnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    const init = service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    await init;

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not register the cooldown sweep repeatable job'),
    );
    jest.useRealTimers();
  });
});
