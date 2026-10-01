import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { OrchestratorService } from './orchestrator.service';
import { MatchResult } from '../match/match.types';

/** One row of the conversation list in the AI-consultant tab. */
export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: Date;
  last_message_at: Date | null;
  message_count: number;
  /** The latest message, shortened — what the thread was last about. */
  preview: string | null;
}

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

  /**
   * A thread's name, taken from its first question. Whitespace is collapsed
   * because the match report's "Ask AI" action sends a long templated sentence,
   * and 80 characters is enough to tell two threads apart in the list.
   */
  private static titleFrom(body: string): string {
    const flat = body.replace(/\s+/g, ' ').trim();
    return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat || 'New conversation';
  }

  async listForStudent(studentId: string): Promise<ConversationSummary[]> {
    // One query rather than a findMany plus a count per thread: the list is
    // rendered on every open of the tab.
    const rows: {
      id: string;
      title: string | null;
      created_at: Date;
      last_message_at: Date | null;
      message_count: string;
      last_body: string | null;
    }[] = await this.conversations.query(
      `SELECT c.id,
              c.title,
              c.created_at,
              c.last_message_at,
              count(m.id)::text            AS message_count,
              (SELECT m2.body FROM "message" m2
                WHERE m2.conversation_id = c.id
                ORDER BY m2.created_at DESC LIMIT 1) AS last_body
         FROM "conversation" c
         LEFT JOIN "message" m ON m.conversation_id = c.id
        WHERE c.student_id = $1
        GROUP BY c.id
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [studentId],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      created_at: r.created_at,
      last_message_at: r.last_message_at,
      message_count: Number(r.message_count),
      preview: r.last_body ? AssistantService.titleFrom(r.last_body) : null,
    }));
  }

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException(`conversation ${id} not found`);
    const messages = await this.messages.find({
      where: { conversation_id: id },
      order: { created_at: 'ASC' },
    });
    return { conversation, messages };
  }

  /** An explicitly started thread. Titled on its first message, like any other. */
  async createConversation(studentId: string | null, startedBy: string): Promise<Conversation> {
    return this.conversations.save(
      this.conversations.create({ student_id: studentId, started_by: startedBy, title: null }),
    );
  }

  async renameConversation(id: string, title: string): Promise<Conversation> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException(`conversation ${id} not found`);
    conversation.title = AssistantService.titleFrom(title);
    return this.conversations.save(conversation);
  }

  /** Messages go with it — `message.conversation_id` is ON DELETE CASCADE. */
  async deleteConversation(id: string): Promise<{ deleted: string }> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException(`conversation ${id} not found`);
    await this.conversations.delete(id);
    return { deleted: id };
  }

  async postMessage(
    conversationId: string | undefined,
    studentId: string | null,
    startedBy: string,
    body: string,
    matchResult?: MatchResult,
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

    // Name the thread from its first question, so the list is readable without
    // anyone having to title anything by hand.
    if (!conversation.title) {
      conversation.title = AssistantService.titleFrom(body);
      await this.conversations.update(conversation.id, { title: conversation.title });
    }

    const result = await this.orchestrator.answer(body, studentId, matchResult);

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
          escalated: result.escalated,
        },
      }),
    );

    // Explicit, because @UpdateDateColumn on `conversation` does not move when a
    // row is inserted into `message` — without this the list would sort by
    // creation time and an abandoned thread would outrank an active one.
    await this.conversations.update(conversation.id, { last_message_at: new Date() });

    return { conversation_id: conversation.id, reply, escalated: result.escalated };
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
