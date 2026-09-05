import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Closes DB/Redis connections cleanly on SIGTERM — matters once this runs
  // in a container that gets rolling-restarted, not just `Ctrl+C`'d locally.
  app.enableShutdownHooks();

  // Default Express body limit (100kb) is too small for /knowledge/ingest-text
  // with a multi-page source document as one chunked-server-side text blob.
  // 10mb covers a whole procedural instruction (~300KB of plain text) with
  // plenty of headroom without opening the door to unbounded request bodies.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CSP off: this app is a JSON API plus the Swagger UI HTML page at /docs,
  // and helmet's default CSP blocks Swagger's inline bundle. Revisit if an
  // HTML surface beyond /docs is ever served from here.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: env.corsOrigin, credentials: true });

  // whitelist + transform, per NEST_SEARCH.MD Appendix A — undecorated query
  // params are dropped, and `@Type()` conversions actually run.
  // NB: no `enableImplicitConversion` — it coerces absent optional string query
  // params to the literal "undefined" (NEST_SEARCH.MD Appendix A). Every
  // non-string search field carries an explicit `@Type()` instead.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const swaggerDoc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Edu-Visa API')
      .setDescription(
        'Student ↔ university/course matching API — Australia-first. ' +
          'Bearer JWT auth (POST /auth/login); most list endpoints accept ' +
          '_start/_end/_sort/_order paging (see NEST_SEARCH.MD).',
      )
      .setVersion(env.engineVersion)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, swaggerDoc);

  await app.listen(env.port);
  Logger.log(`edu-visa API listening on :${env.port} — docs at /docs`, 'Bootstrap');
}

bootstrap();
