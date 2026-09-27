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
import { UniversityCampus } from './university-campus.entity';

/**
 * Why a site can't be auto-sourced. Each is a standing property of the site
 * rather than a transient failure, which is what makes it worth recording.
 */
export type AutoSourceReason =
  | 'anti_bot'        // HTTP 403 from bot protection
  | 'robots_disallow' // robots.txt forbids the path
  | 'client_rendered' // 200, but the content/nav only exists after JS runs
  | 'unreachable'     // DNS/TLS/timeout, repeatedly
  | 'no_website';     // the register has no usable URL for this provider

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

  /**
   * Last time an automated sync read this row from upstream. Distinct from
   * `verified_at`, which means a human confirmed it: a row can be freshly
   * fetched and still unverified, and the data-sync UI needs to tell those
   * apart to answer "what is stale?".
   */
  @Column({ type: 'timestamptz', nullable: true })
  last_fetched_at: Date | null;

  /** sha256 of the upstream register fields, so an unchanged row is cheap to skip. */
  @Column({ type: 'varchar', nullable: true })
  content_hash: string | null;

  /**
   * Whether the automated requirement scraper can read this institution's site.
   * `blocked` is a standing property — anti-bot protection and client-side
   * rendering don't resolve themselves — so blocked institutions are skipped by
   * default and surfaced as needing manual entry or a document upload.
   */
  @Column({ type: 'varchar', default: 'unknown' })
  auto_source_status: 'unknown' | 'ok' | 'blocked';

  @Column({ type: 'varchar', nullable: true })
  auto_source_reason: AutoSourceReason | null;

  /** What was actually observed, for the counsellor who has to work around it. */
  @Column({ type: 'text', default: '' })
  auto_source_note: string;

  @Column({ type: 'timestamptz', nullable: true })
  auto_source_checked_at: Date | null;

  /**
   * Consecutive failed attempts. A transient network error shouldn't blocklist a
   * site permanently, so only a deterministic signal (403 / robots.txt) blocks
   * on the first sight; anything else needs to fail repeatedly.
   */
  @Column({ type: 'int', default: 0 })
  auto_source_failures: number;

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

  /**
   * Every registered teaching location. `city` above is the primary campus; a
   * provider commonly teaches in several cities and a student may prefer any of
   * them, so matching reads this list, not just `city`.
   */
  @OneToMany(() => UniversityCampus, (c) => c.university)
  campuses: UniversityCampus[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
