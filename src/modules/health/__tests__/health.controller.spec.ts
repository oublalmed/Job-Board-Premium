import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from '../health.controller.js';

describe('HealthController (ENF-09 — liveness/readiness probes)', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: TypeOrmHealthIndicator, useValue: db },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('liveness checks no external dependency (never restarts on a DB blip)', async () => {
    await controller.live();

    expect(health.check).toHaveBeenCalledWith([]);
    expect(db.pingCheck).not.toHaveBeenCalled();
  });

  it('readiness checks the database (the "can I serve" signal)', async () => {
    const result = await controller.ready();

    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(result).toEqual({ status: 'ok', checked: 1 });
  });

  it('the aggregate check pings the database', async () => {
    await controller.check();

    expect(db.pingCheck).toHaveBeenCalledWith('database');
  });
});
