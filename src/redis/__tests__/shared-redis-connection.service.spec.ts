import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SharedRedisConnectionService } from '../shared-redis-connection.service.js';

const mockClientInstances: MockIORedisClient[] = [];

interface MockIORedisClient {
  status: string;
  on: jest.Mock;
  connect: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
}

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      const client = {
        status: 'wait',
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn(),
      };
      mockClientInstances.push(client);
      return client;
    }),
  };
});

describe('SharedRedisConnectionService', () => {
  let service: SharedRedisConnectionService;
  let configService: { getOrThrow: jest.Mock; get: jest.Mock };
  let mockClient: MockIORedisClient;

  beforeEach(async () => {
    mockClientInstances.length = 0;
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'redis.host') return 'localhost';
        if (key === 'redis.port') return 6379;
        throw new Error(`unexpected getOrThrow(${key})`);
      }),
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedRedisConnectionService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SharedRedisConnectionService);
    mockClient = mockClientInstances[0];
  });

  it('creates exactly one ioredis client, attaches an error listener, and connects', () => {
    expect(mockClientInstances).toHaveLength(1);
    expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(service.client).toBe(mockClient);
  });

  it('does not throw when the error listener fires (defensive logging only)', () => {
    const errorHandler = mockClient.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1] as (error: Error) => void;

    expect(() => errorHandler(new Error('connect ECONNREFUSED'))).not.toThrow();
  });

  describe('onApplicationShutdown', () => {
    it('gracefully quits the connection when it is not already closed', async () => {
      mockClient.status = 'ready';

      await service.onApplicationShutdown('SIGTERM');

      expect(mockClient.quit).toHaveBeenCalledTimes(1);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('is a no-op when the connection is already closed', async () => {
      mockClient.status = 'end';

      await service.onApplicationShutdown();

      expect(mockClient.quit).not.toHaveBeenCalled();
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to a forced disconnect when quit() rejects, never leaving shutdown hanging', async () => {
      mockClient.status = 'ready';
      mockClient.quit.mockRejectedValue(new Error('Connection is closed'));

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined();

      expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('falls back to a forced disconnect when quit() is too slow (bounded shutdown)', async () => {
      jest.useFakeTimers();
      mockClient.status = 'ready';
      // Resolves eventually, just after the shutdown timeout — proves the
      // race is won by the timeout, not that quit() is unobservable.
      mockClient.quit.mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve('OK'), 10000)),
      );

      const shutdown = service.onApplicationShutdown();
      await jest.advanceTimersByTimeAsync(3000);
      await shutdown;
      await jest.advanceTimersByTimeAsync(10000);

      expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });
});
