import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Country } from '../../common/enums';
import { Course } from '../course/course.entity';
import { UniversityDocument } from './university-document.entity';

@Entity('university')
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 2 })
  country: Country;

  @Column()
  city: string;

  @Column({ type: 'int', default: 999 })
  world_rank: number;

  /** 0-360, drives a generated monogram on the frontend. */
  @Column({ type: 'int', default: 210 })
  logo_hue: number;

  /** Set when a re-verification pass last confirmed this row (PRODUCT_PLAN §2). */
  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date | null;

  /** Links this row to its real admission-policy.data.ts key (e.g. 'cqu') when one exists — null for the CRICOS-sourced catalogue, which has no per-institution policy on file. Drives MatchService's real admission-eligibility check (PRODUCT_PLAN phase 4). */
  @Column({ type: 'varchar', nullable: true })
  policy_key: string | null;

  /**
   * Real official CRICOS registry fields (PRODUCT_PLAN phase 9) — from
   * data.gov.au's CRICOS institutions dataset, the same authoritative
   * source `src/seed/cricos-import.ts` already uses for course data. Null
   * for an institution not (yet) matched against that registry; the
   * completeness indicator flags that gap rather than guessing a value.
   */
  @Column({ type: 'varchar', nullable: true })
  cricos_provider_code: string | null;

  @Column({ type: 'varchar', nullable: true })
  institution_type: string | null;

  @Column({ type: 'int', nullable: true })
  student_capacity: number | null;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  /** One formatted line — loose on purpose, matching CourseWriteDto's own convention, not a normalised address. */
  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @OneToMany(() => Course, (c) => c.university)
  courses: Course[];

  @OneToMany(() => UniversityDocument, (d) => d.university)
  documents: UniversityDocument[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
