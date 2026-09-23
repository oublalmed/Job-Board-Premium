import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from '../health.controller.js';

describe('HealthController (ENF-09 — liveness/readiness probes)', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };
  let memory: { checkHeap: jest.Mock };

  beforeEach(async () => {
    // health.check runs the indicator thunks it is given and echoes a marker so
    // each test can assert *which* indicators an endpoint composed.
    health = {
      check: jest.fn(async (indicators: Array<() => unknown>) => {
        await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', checked: indicators.length };
      }),
    };
    db = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    memory = {
      checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: TypeOrmHealthIndicator, useValue: db },
        { provide: MemoryHealthIndicator, useValue: memory },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('liveness checks no external dependency (never restarts on a DB blip)', async () => {
    await controller.live();

    expect(health.check).toHaveBeenCalledWith([]);
    expect(db.pingCheck).not.toHaveBeenCalled();
    expect(memory.checkHeap).not.toHaveBeenCalled();
  });

  it('readiness checks the database and heap budget', async () => {
    const result = await controller.ready();

    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(memory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      512 * 1024 * 1024,
    );
    expect(result).toEqual({ status: 'ok', checked: 2 });
  });

  it('the aggregate check composes database + heap', async () => {
    await controller.check();

    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(memory.checkHeap).toHaveBeenCalled();
  });
});
