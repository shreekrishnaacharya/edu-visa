import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { OrchestratorService } from './orchestrator.service';
import { PostMessageDto } from './dto/post-message.dto';
import { DraftReplyDto } from './dto/draft-reply.dto';
import { CreateConversationDto, RenameConversationDto } from './dto/conversation.dto';
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

  /**
   * The student's most recent thread — kept because it is what the tab loads on
   * open when no specific thread is selected.
   */
  @Get('students/:studentId')
  getForStudent(@Param('studentId') studentId: string) {
    return this.assistant.getLatestForStudent(studentId);
  }

  /** Every thread for this student, most recently used first. */
  @Get('students/:studentId/conversations')
  listConversations(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.assistant.listForStudent(studentId);
  }

  /** Starts an empty thread, so a counsellor can deliberately begin a fresh one. */
  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto, @AuthUser() user: AuthUserPayload) {
    return this.assistant.createConversation(dto.student_id ?? null, user.email);
  }

  /** One thread with its full message history — opening an older conversation. */
  @Get('conversations/:id')
  getConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.assistant.getConversation(id);
  }

  @Patch('conversations/:id')
  renameConversation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameConversationDto) {
    return this.assistant.renameConversation(id, dto.title);
  }

  /** Deletes the thread and its messages (message.conversation_id cascades). */
  @Delete('conversations/:id')
  deleteConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.assistant.deleteConversation(id);
  }

  /** Drafts a reply for a counsellor to review and send — never persisted here, see OrchestratorService.draftReply. */
  @Post('draft-reply')
  draftReply(@Body() dto: DraftReplyDto) {
    return this.orchestrator.draftReply(dto.student_id, dto.question);
  }
}
