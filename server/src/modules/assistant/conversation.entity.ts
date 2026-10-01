import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

/**
 * One chat thread. A student can have many — the AI consultant lists them and
 * lets a counsellor keep separate threads (a visa question, a course shortlist,
 * a financial question) instead of one endless scroll.
 */
@Entity('conversation')
@Index(['student_id', 'last_message_at'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  student_id: string | null;

  @Column()
  started_by: string;

  /**
   * Filled from the first user message, and renameable. Null only for a thread
   * created but never used.
   */
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  /**
   * When this thread was last posted to. Distinct from `updated_at`, which is an
   * @UpdateDateColumn on THIS row and so does not move when a message is
   * inserted into `message` — sorting the list by it would rank an abandoned
   * thread above an active one.
   */
  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  @OneToMany(() => Message, (m) => m.conversation, { cascade: true })
  messages: Message[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
