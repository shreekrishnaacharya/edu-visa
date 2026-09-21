import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * "What-if" overrides for a match preview/run — a counsellor exploring
 * "what if their English were higher" without editing the student's real
 * stored profile. Always defaults to the real profile/preferences when a
 * field is omitted (see MatchService.run()). Deliberately the confirmed core
 * set only, not every derived-profile field the engine reads.
 */
export class ProfileOverrideDto {
  @IsOptional()
  @IsNumber()
  canonical_gpa?: number;

  @IsOptional()
  @IsNumber()
  english_band?: number;

  @IsOptional()
  @IsNumber()
  max_tuition_per_year?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred_countries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred_cities?: string[];

  @IsOptional()
  @IsString()
  degree_level?: string;

  @IsOptional()
  @IsString()
  field?: string;
}
