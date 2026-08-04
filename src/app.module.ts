import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { RedisConnectionModule } from './redis/redis-connection.module.js';
import { SharedRedisConnectionService } from './redis/shared-redis-connection.service.js';
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
import { SchoolVerificationModule } from './modules/school-verification/school-verification.module.js';
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
      // The shared connection's creation AND its shutdown are owned by
      // SharedRedisConnectionService (src/redis/), not built inline here —
      // a bare object returned from this factory would have no lifecycle
      // hook Nest could call on shutdown, which is exactly how this
      // connection used to leak on app.close()/SIGTERM (see PROGRESS.md,
      // Lot 7). Injecting the service means Nest calls its
      // OnApplicationShutdown hook as part of the normal module-graph
      // teardown, same as any other provider.
      imports: [RedisConnectionModule],
      inject: [SharedRedisConnectionService],
      useFactory: (redisConnection: SharedRedisConnectionService) => ({
        connection: redisConnection.client,
      }),
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
    SchoolVerificationModule,
  ],
})
export class AppModule {}
