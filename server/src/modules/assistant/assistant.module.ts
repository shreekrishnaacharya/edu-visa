import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { OrchestratorService } from './orchestrator.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { StudentModule } from '../student/student.module';
import { ProfileModule } from '../profile/profile.module';
import { MatchModule } from '../match/match.module';
import { CourseModule } from '../course/course.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    KnowledgeModule,
    StudentModule,
    ProfileModule,
    MatchModule,
    CourseModule,
  ],
  providers: [AssistantService, OrchestratorService],
  controllers: [AssistantController],
})
export class AssistantModule {}
