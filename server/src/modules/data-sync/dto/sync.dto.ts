import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { STALENESS_WINDOWS } from '../sync.service';

const WINDOWS = Object.keys(STALENESS_WINDOWS);

export class StartCricosRunDto {
  /**
   * How far back to consider a record stale. Scopes which existing rows are
   * re-compared — not what's downloaded, since the register is a single
   * monthly file.
   */
  @IsOptional() @IsIn(WINDOWS) window?: keyof typeof STALENESS_WINDOWS;

  /** Include Diploma/Advanced Diploma/Certificate levels as well as degrees. */
  @IsOptional() @IsBoolean() @Type(() => Boolean) include_vet?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true }) states?: string[];

  /** 'Government' | 'Private' as published in the register. */
  @IsOptional() @IsArray() @IsString({ each: true }) institution_types?: string[];
}

export class DecideChangesDto {
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) ids?: string[];

  @IsIn(['accepted', 'rejected']) decision: 'accepted' | 'rejected';

  /** With no ids, applies to every pending change matching these filters. */
  @IsOptional() @IsBoolean() all?: boolean;
  @IsOptional() @IsIn(['university', 'course', 'admission_policy']) entity_type?: string;
  @IsOptional() @IsIn(['create', 'update', 'unchanged', 'disappeared']) change_type?: string;
}

export class ListChangesDto {
  @IsOptional() @IsIn(['university', 'course', 'admission_policy']) entity_type?: string;
  @IsOptional() @IsIn(['create', 'update', 'unchanged', 'disappeared']) change_type?: string;
  @IsOptional() @IsIn(['pending', 'accepted', 'rejected', 'applied']) decision?: string;
  @IsOptional() @IsString() q?: string;

  @IsOptional() @IsInt() @Min(0) @Type(() => Number) skip?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) take?: number;
}

export class StartSiteScrapeDto {
  /** Specific institutions to visit; omitted means "choose for me". */
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) university_ids?: string[];

  /** Default true — only institutions with no English band sourced yet. */
  @IsOptional() @IsBoolean() only_missing?: boolean;

  /** Re-visit institutions whose pages haven't been fetched in this many days. */
  @IsOptional() @IsInt() @Min(1) @Max(3650) @Type(() => Number) stale_days?: number;

  /** Institutions per run. Capped server-side: 663 sites in one pass is neither polite nor reviewable. */
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) limit?: number;

  /** Candidate pages to try per institution. */
  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number) max_pages?: number;

  /** Re-attempt institutions already flagged as unreadable (anti-bot, robots.txt, JS-rendered). */
  @IsOptional() @IsBoolean() retry_blocked?: boolean;
}

export class ListSourcePagesDto {
  @IsOptional() @IsUUID('4') entity_id?: string;
  @IsOptional()
  @IsIn(['ok', 'unchanged', 'blocked_by_robots', 'http_error', 'fetch_error', 'never_fetched'])
  fetch_status?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) skip?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) take?: number;
}

export class UpdateSourcePageDto {
  /** What this page actually holds — a counsellor correcting the AI's summary. */
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) data_kinds?: string[];
  @IsOptional() @IsString() notes?: string;
  /** Marks that a human confirmed this really is the right source page. */
  @IsOptional() @IsBoolean() verified?: boolean;
}

export class ReconcileConsistencyDto {
  /**
   * 1. keep_both        — report only, change nothing (the default).
   * 2. course_to_policy — the course figure replaces the policy band's.
   * 3. policy_to_course — the policy band's figure replaces the course's.
   */
  @IsIn(['keep_both', 'course_to_policy', 'policy_to_course'])
  direction: 'keep_both' | 'course_to_policy' | 'policy_to_course';

  /** Resolve only these courses; omitted means every disagreement. */
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) course_ids?: string[];

  /** Dry run unless explicitly true. */
  @IsOptional() @IsBoolean() apply?: boolean;

  /**
   * Required to push a course figure into a band that governs other courses too,
   * since that changes the requirement for all of them.
   */
  @IsOptional() @IsBoolean() force?: boolean;
}
