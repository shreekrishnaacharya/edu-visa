import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PassportStatus, StudentState } from '../../../common/enums';
import { encryptedString } from '../../../common/database/encrypted.transformer';
import { AcademicRecord } from './academic-record.entity';
import { LanguageTest } from './language-test.entity';
import { WorkExperience } from './work-experience.entity';
import { CareerGoal } from './career-goal.entity';
import { IncomeSource } from './income-source.entity';
import { Asset } from './asset.entity';
import { Liability } from './liability.entity';
import { Sponsor } from './sponsor.entity';
import { VisaHistory } from './visa-history.entity';
import { Dependant } from './dependant.entity';
import { Preferences } from './preferences.entity';

@Entity('student')
@Index(['branch_id', 'counsellor_id'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  full_name: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: string | null;

  @Column({ type: 'varchar', default: 'other' })
  gender: 'male' | 'female' | 'other';

  @Column({ default: '' })
  nationality: string;

  @Column({ default: '' })
  current_city: string;

  @Column({ type: 'varchar', default: 'none' })
  passport_status: PassportStatus;

  /** Optional; PII — encrypted at rest. Unused by the prototype seed. */
  @Column({ type: 'text', nullable: true, transformer: encryptedString })
  passport_number: string | null;

  @Column({ type: 'varchar', default: 'single' })
  marital_status: 'single' | 'married';

  @Column({ type: 'varchar', default: 'Enquiry' })
  state: StudentState;

  // --- tenancy / ownership (from day one, PRODUCT_PLAN §2) ------------------
  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  counsellor_id: string | null;

  /** Denormalised display labels (the prototype shows these as strings). */
  @Column({ default: '' })
  counsellor: string;

  @Column({ default: '' })
  branch: string;

  // --- consent (timestamped + versioned) --------------------------------
  @Column({ type: 'timestamptz', nullable: true })
  consent_given_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  consent_version: string | null;

  // --- Side A aggregates -------------------------------------------------
  @OneToMany(() => AcademicRecord, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  academic: AcademicRecord[];

  @OneToMany(() => LanguageTest, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  language_tests: LanguageTest[];

  @OneToMany(() => WorkExperience, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  work: WorkExperience[];

  @OneToOne(() => CareerGoal, (r) => r.student, { cascade: true })
  career_goal: CareerGoal;

  @OneToMany(() => IncomeSource, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  income_sources: IncomeSource[];

  @OneToMany(() => Asset, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  assets: Asset[];

  @OneToMany(() => Liability, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  liabilities: Liability[];

  @OneToMany(() => Sponsor, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  sponsors: Sponsor[];

  @OneToMany(() => VisaHistory, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  visa_history: VisaHistory[];

  @OneToMany(() => Dependant, (r) => r.student, { cascade: true, orphanedRowAction: 'delete' })
  dependants: Dependant[];

  @OneToOne(() => Preferences, (r) => r.student, { cascade: true })
  preferences: Preferences;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
