import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums';

@Entity('app_user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  password_hash: string;

  @Column({ default: '' })
  full_name: string;

  @Column({ type: 'varchar', default: Role.Counsellor })
  role: Role;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ default: '' })
  branch: string;

  /** Extra fine-grained grants, e.g. 'visa:read'. */
  @Column({ type: 'text', array: true, default: '{}' })
  permissions: string[];

  /** Only set for role = student — the student file this login owns. */
  @Column({ type: 'uuid', nullable: true })
  student_id: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
