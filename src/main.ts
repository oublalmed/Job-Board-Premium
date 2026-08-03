import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  // Without this, NestJS never listens for SIGTERM/SIGINT at all — a
  // Kubernetes pod redeploy/scale-down (CDC §9) would kill the process
  // immediately, skipping onModuleDestroy/onApplicationShutdown entirely on
  // every provider (Postgres connections, the shared Redis connection, any
  // in-flight BullMQ job). enableShutdownHooks() is what wires OS signals
  // to app.close() — the graceful-teardown code path already exercised by
  // this repo's own e2e tests (afterAll(() => app.close())) runs
  // regardless of this call, but production only gets it with this line.
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');

  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // The OpenAPI contract this frontend's API client is generated from
  // (Front 0 — never hand-written types). Kept out of production: nothing
  // in the running API needs it reachable at runtime, only whoever is
  // regenerating the client against a dev/staging backend — and a fully
  // public schema is a (minor, but avoidable) surface a production API
  // doesn't need to expose. `@nestjs/swagger`'s compiler plugin
  // (nest-cli.json) infers DTO shapes from their TypeScript types, so
  // this reflects the real request/response contract without hand-
  // annotating every property with @ApiProperty().
  if (configService.get<string>('app.nodeEnv') !== 'production') {
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Talentiq API')
        .setDescription('REST API — see CDC for the full functional spec')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
        .build(),
    );
    SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument);
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on port ${port} with prefix /${apiPrefix}`);
}

void bootstrap();
