import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Who read/changed a student's financial or visa record, and when (PRODUCT_PLAN §8). */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  user_id: string;

  @Column({ default: '' })
  user_email: string;

  @Column()
  @Index()
  student_id: string;

  /** e.g. "financial:read", "visa_history:read", "visa_history:update". */
  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
