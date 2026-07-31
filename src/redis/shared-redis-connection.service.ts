import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

const SHUTDOWN_QUIT_TIMEOUT_MS = 3000;

// Owns the single ioredis connection shared by every BullMQ Queue/Worker in
// the app (see AppModule's BullModule.forRootAsync — it injects this
// service rather than building its own connection inline). BullMQ marks a
// pre-constructed client instance as "shared" internally and, by design,
// never closes a connection it didn't create itself (see RedisConnection's
// own `extraOptions.shared` check in bullmq/dist/cjs/classes/redis-connection.js
// — confirmed by reading the source, not assumed) — only the Worker's own
// duplicated "blocking" connection is BullMQ's to close. Whoever creates a
// shared client is responsible for closing it; that owner is this service.
@Injectable()
export class SharedRedisConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(SharedRedisConnectionService.name);

  public readonly client: IORedis;

  constructor(config: ConfigService) {
    // A plain options object here would let each Queue/Worker created from
    // it open its OWN connection lazily, at whatever moment Nest's DI
    // happens to instantiate that particular provider — there is no
    // guarantee a consumer (e.g. CooldownSchedulerService, which attaches
    // its own `queue.on('error', ...)` in its constructor) has run by the
    // time that connection attempt fails. A broker refusing the connection
    // fast (ECONNREFUSED) can lose that race, producing a genuinely
    // unhandled rejection that crashes app boot.
    //
    // Pre-creating the ioredis client ourselves, right here, and attaching
    // its error listener in the very next statement — before BullMQ ever
    // sees it — closes that gap: the connection cannot fail before
    // something is listening, because nothing is listening for it to fail
    // before this constructor returns. BullMQ detects an already-
    // constructed client (vs. a plain options object) and reuses it
    // directly instead of opening a new connection from scratch.
    this.client = new IORedis({
      host: config.getOrThrow<string>('redis.host'),
      port: config.getOrThrow<number>('redis.port'),
      password: config.get<string>('redis.password') || undefined,
      // Required by BullMQ Workers (CooldownNotificationProcessor,
      // Lot 7) — per-command retries must be unbounded, never set this
      // away from null. Reconnection attempts (below) are bounded
      // instead, which is what actually prevents an unreachable Redis
      // from hanging app boot forever.
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
      retryStrategy: (times: number) =>
        times > 5 ? null : Math.min(times * 200, 2000),
      // Forces IPv4-only connection attempts. Without this, when `host`
      // resolves to both an IPv6 (::1) and IPv4 (127.0.0.1) address
      // (typical for "localhost"), Node's dual-stack "happy eyeballs"
      // connector can leak an AggregateError as a genuinely unhandled
      // rejection outside of ioredis/BullMQ's own error handling when both
      // refuse simultaneously — observed while testing this feature
      // without Redis running. A single-family connection attempt doesn't
      // hit that path.
      family: 4,
      lazyConnect: true,
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
    // Kick off the connection attempt ourselves, now that the error
    // listener above is already attached — rather than leaving it to
    // whichever Queue/Worker happens to issue the first command.
    this.client.connect().catch(() => {
      // Already surfaced via the 'error' listener above; this second
      // observer only exists so the connect() promise itself is never
      // left unhandled (see withTimeout()'s own comment in
      // cooldown-scheduler.service.ts for the same class of gotcha).
    });
  }

  // Runs on `app.close()` (tests) and, once `app.enableShutdownHooks()` is
  // active (main.ts), on SIGTERM/SIGINT too — the case that actually
  // matters in production: Kubernetes sends SIGTERM on every pod
  // redeploy/scale-down (CDC §9), and an unclosed Redis connection here
  // would leak one orphaned connection on the Redis side per pod cycle.
  //
  // quit() is the graceful path (sends QUIT, waits for the reply, lets any
  // in-flight command finish) — the right default for an orderly shutdown.
  // It can hang if the connection never fully came up (e.g. Redis was
  // unreachable for this process's whole lifetime), so it's bounded: if it
  // doesn't resolve in time, disconnect() forces closure immediately
  // rather than blocking app shutdown indefinitely. Never left as an
  // unhandled rejection either way — see the same pattern in
  // cooldown-scheduler.service.ts.
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Closing shared Redis connection${signal ? ` (signal: ${signal})` : ''}`,
    );
    if (this.client.status === 'end') {
      return;
    }
    try {
      await this.withTimeout(this.client.quit(), SHUTDOWN_QUIT_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(
        `Graceful Redis quit() failed or timed out, forcing disconnect: ${(error as Error).message}`,
      );
      this.client.disconnect();
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    promise.catch(() => {});
    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`timed out after ${ms}ms`)),
        ms,
      );
    });
    // Whichever promise wins the race, the timer must be cleared — an
    // uncleared setTimeout keeps Node's event loop alive until it actually
    // fires, even after Promise.race has already settled (the loser is
    // never cancelled, only ignored). Left unfixed, this is exactly what
    // kept the process — and every Jest run that boots this service —
    // alive for the timeout's full duration after everything else had
    // already finished.
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timeoutHandle),
    );
  }
}
