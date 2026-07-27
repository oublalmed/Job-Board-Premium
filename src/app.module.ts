import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  authConfig,
  storageConfig,
  businessConfig,
  configValidationSchema,
} from './config/index.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CandidatesModule } from './modules/candidates/candidates.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SCORING_PROVIDER } from './ports/scoring.port.js';
import { PAYMENT_PROVIDER } from './ports/payment.port.js';
import { MAIL_PROVIDER } from './ports/mail.port.js';
import { FILE_SCANNER } from './ports/file-scanner.port.js';
import { OBJECT_STORAGE } from './ports/object-storage.port.js';
import { StubScoringAdapter } from './adapters/scoring/stub-scoring.adapter.js';
import { StubPaymentAdapter } from './adapters/payment/stub-payment.adapter.js';
import { StubMailAdapter } from './adapters/mail/stub-mail.adapter.js';
import { StubFileScannerAdapter } from './adapters/file-scanner/stub-file-scanner.adapter.js';
import { StubObjectStorageAdapter } from './adapters/object-storage/stub-object-storage.adapter.js';

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
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    CandidatesModule,
    CompaniesModule,
    AssessmentsModule,
    AuditModule,
    SettingsModule,
    HealthModule,
  ],
  providers: [
    { provide: SCORING_PROVIDER, useClass: StubScoringAdapter },
    { provide: PAYMENT_PROVIDER, useClass: StubPaymentAdapter },
    { provide: MAIL_PROVIDER, useClass: StubMailAdapter },
    { provide: FILE_SCANNER, useClass: StubFileScannerAdapter },
    { provide: OBJECT_STORAGE, useClass: StubObjectStorageAdapter },
  ],
  exports: [
    SCORING_PROVIDER,
    PAYMENT_PROVIDER,
    MAIL_PROVIDER,
    FILE_SCANNER,
    OBJECT_STORAGE,
  ],
})
export class AppModule {}
