import { IsIn, IsOptional, IsString } from 'class-validator';

export class CheckEligibilityDto {
  @IsString()
  student_id: string;

  @IsString()
  policy_key: string;

  @IsOptional()
  @IsIn(['UG', 'PG', 'PG_RESEARCH', 'PATHWAY'])
  level?: 'UG' | 'PG' | 'PG_RESEARCH' | 'PATHWAY';

  @IsOptional()
  @IsString()
  course_label?: string;

  /**
   * The course's field of education. Optional, but without it this endpoint can
   * resolve a DIFFERENT band from the match report for the same course: band
   * selection matches a band's topic against the title AND the field, and some
   * real bands are only reachable via the field. CQU's "Management programs"
   * band (60%) is one — "Master of Business Administration" contains no
   * "management", so omitting the field made this endpoint answer "no
   * academic-threshold data on file" for a course whose bar its own briefing
   * states plainly, while the match report got it right.
   */
  @IsOptional()
  @IsString()
  course_field?: string;
}
