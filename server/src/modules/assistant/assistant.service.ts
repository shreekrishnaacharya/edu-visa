import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { OrchestratorService } from './orchestrator.service';

/**
 * The AI consultant front door (PRODUCT_PLAN §J / plan appendix B), now wired
 * to OrchestratorService: real retrieval-grounded, cited generation via
 * OpenRouter. The deterministic engine (MatchService) still owns any scoring;
 * this only explains it and answers open questions.
 */
@Injectable()
export class AssistantService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly orchestrator: OrchestratorService,
  ) {}

  async postMessage(
    conversationId: string | undefined,
    studentId: string | null,
    startedBy: string,
    body: string,
  ) {
    let conversation = conversationId
      ? await this.conversations.findOne({ where: { id: conversationId } })
      : null;
    if (!conversation) {
      conversation = await this.conversations.save(
        this.conversations.create({ student_id: studentId, started_by: startedBy }),
      );
    }

    await this.messages.save(
      this.messages.create({ conversation_id: conversation.id, role: 'user', body }),
    );

    const result = await this.orchestrator.answer(body, studentId);

    const reply = await this.messages.save(
      this.messages.create({
        conversation_id: conversation.id,
        role: 'assistant',
        body: result.answer,
        meta: {
          cites: result.cites,
          confidence: result.confidence,
          degraded: result.degraded,
          passes_run: result.passes_run,
        },
      }),
    );

    return { conversation_id: conversation.id, reply };
  }

  /**
   * The most recent conversation thread for a student, with its full
   * message history — powers the "AI Consultant" tab reloading a student's
   * existing chat instead of starting blank every time.
   */
  async getLatestForStudent(studentId: string): Promise<{ conversation_id: string | null; messages: Message[] }> {
    const conversation = await this.conversations.findOne({
      where: { student_id: studentId },
      order: { created_at: 'DESC' },
    });
    if (!conversation) return { conversation_id: null, messages: [] };

    const messages = await this.messages.find({
      where: { conversation_id: conversation.id },
      order: { created_at: 'ASC' },
    });
    return { conversation_id: conversation.id, messages };
  }
}
