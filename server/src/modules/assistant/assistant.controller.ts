import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { PostMessageDto } from './dto/post-message.dto';
import { AuthUser } from '../auth/auth-user.decorator';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('messages')
  post(@Body() dto: PostMessageDto, @AuthUser() user: AuthUserPayload) {
    return this.assistant.postMessage(
      dto.conversation_id,
      dto.student_id ?? null,
      user.email,
      dto.body,
    );
  }

  /** The student's existing chat thread (if any) — for the frontend to reload on open. */
  @Get('students/:studentId')
  getForStudent(@Param('studentId') studentId: string) {
    return this.assistant.getLatestForStudent(studentId);
  }
}
