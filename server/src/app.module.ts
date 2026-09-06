import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import Redis from "ioredis";
import { dataSourceOptions } from "./config/data-source";
import { env } from "./config/env";
import { HealthController } from "./modules/health/health.controller";
import { StorageModule } from "./common/storage/storage.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ReferenceModule } from "./modules/reference/reference.module";
import { UniversityModule } from "./modules/university/university.module";
import { CourseModule } from "./modules/course/course.module";
import { StudentModule } from "./modules/student/student.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { MatchModule } from "./modules/match/match.module";
import { DocumentModule } from "./modules/document/document.module";
import { FollowUpModule } from "./modules/follow-up/follow-up.module";
import { AssistantModule } from "./modules/assistant/assistant.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    // Rate limiting (PRODUCT_PLAN §8 "rate limits on public endpoints"),
    // Redis-backed so limits hold across multiple instances, not just this
    // process. Per-route overrides (e.g. a tighter cap on /auth/login) via
    // @Throttle() on the handler.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: env.throttle.ttlMs, limit: env.throttle.limit }],
      storage: new ThrottlerStorageRedisService(
        new Redis({ host: env.redis.host, port: env.redis.port }),
      ),
    }),
    StorageModule,
    AuthModule,
    AuditModule,
    ReferenceModule,
    UniversityModule,
    CourseModule,
    StudentModule,
    ProfileModule,
    MatchModule,
    DocumentModule,
    FollowUpModule,
    AssistantModule,
    KnowledgeModule,
  ],
  controllers: [HealthController, AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
