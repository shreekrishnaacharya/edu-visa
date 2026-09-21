import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { OrchestratorService } from './orchestrator.service';
import { PostMessageDto } from './dto/post-message.dto';
import { DraftReplyDto } from './dto/draft-reply.dto';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';
import { MatchResult } from '../match/match.types';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  @Post('messages')
  post(@Body() dto: PostMessageDto, @AuthUser() user: AuthUserPayload) {
    return this.assistant.postMessage(
      dto.conversation_id,
      dto.student_id ?? null,
      user.email,
      dto.body,
      dto.match_result as MatchResult | undefined,
    );
  }

  /** The student's existing chat thread (if any) — for the frontend to reload on open. */
  @Get('students/:studentId')
  getForStudent(@Param('studentId') studentId: string) {
    return this.assistant.getLatestForStudent(studentId);
  }

  /** Drafts a reply for a counsellor to review and send — never persisted here, see OrchestratorService.draftReply. */
  @Post('draft-reply')
  draftReply(@Body() dto: DraftReplyDto) {
    return this.orchestrator.draftReply(dto.student_id, dto.question);
  }
}
