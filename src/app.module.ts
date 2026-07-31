import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import IORedis from 'ioredis';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  authConfig,
  storageConfig,
  businessConfig,
  scoringConfig,
  paymentConfig,
  legalConfig,
  configValidationSchema,
} from './config/index.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CandidatesModule } from './modules/candidates/candidates.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PortsModule } from './ports/ports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        authConfig,
        storageConfig,
        businessConfig,
        scoringConfig,
        paymentConfig,
        legalConfig,
      ],
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.username'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.database'),
        synchronize: config.get<boolean>('database.synchronize', false),
        logging: config.get<boolean>('database.logging', false),
        autoLoadEntities: true,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: false,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // A plain options object here would let each Queue/Worker created
        // from it open its OWN connection lazily, at whatever moment Nest's
        // DI happens to instantiate that particular provider — there is no
        // guarantee a consumer (e.g. CooldownSchedulerService, which
        // attaches its own `queue.on('error', ...)` in its constructor) has
        // run by the time that connection attempt fails. A broker refusing
        // the connection fast (ECONNREFUSED) can lose that race, producing
        // a genuinely unhandled rejection that crashes app boot.
        //
        // Pre-creating the ioredis client ourselves, right here, and
        // attaching its error listener in the very next statement — before
        // BullMQ ever sees it — closes that gap: the connection cannot fail
        // before something is listening, because nothing is listening for
        // it to fail before this factory returns. BullMQ detects an
        // already-constructed client (vs. a plain options object) and reuses
        // it directly instead of opening a new connection from scratch.
        const connection = new IORedis({
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
          // Forces IPv4-only connection attempts. Without this, when
          // `host` resolves to both an IPv6 (::1) and IPv4 (127.0.0.1)
          // address (typical for "localhost"), Node's dual-stack "happy
          // eyeballs" connector can leak an AggregateError as a genuinely
          // unhandled rejection outside of ioredis/BullMQ's own error
          // handling when both refuse simultaneously — observed while
          // testing this feature without Redis running. A single-family
          // connection attempt doesn't hit that path.
          family: 4,
          lazyConnect: true,
        });
        connection.on('error', (error: Error) => {
          new Logger('BullMQConnection').warn(
            `Redis connection error: ${error.message}`,
          );
        });
        // Kick off the connection attempt ourselves, now that the error
        // listener above is already attached — rather than leaving it to
        // whichever Queue/Worker happens to issue the first command.
        connection.connect().catch(() => {
          // Already surfaced via the 'error' listener above; this second
          // observer only exists so the connect() promise itself is never
          // left unhandled (see withTimeout()'s own comment in
          // cooldown-scheduler.service.ts for the same class of gotcha).
        });
        return { connection };
      },
    }),
    PortsModule,
    AuthModule,
    UsersModule,
    CandidatesModule,
    CompaniesModule,
    AssessmentsModule,
    SearchModule,
    MessagingModule,
    BillingModule,
    AuditModule,
    SettingsModule,
    HealthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
