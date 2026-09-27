import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCurationSessionDto {
  /** Omit both to open an unbound session (general research, no single record). */
  @IsOptional() @IsIn(['university', 'course', 'admission_policy']) entity_type?:
    | 'university'
    | 'course'
    | 'admission_policy';

  /**
   * The record being curated. A university/course id, or an admission policy
   * `key` — the policy table is keyed by a slug, not a uuid, so this is not
   * validated as one.
   */
  @IsOptional() @IsString() @MaxLength(200) entity_id?: string;

  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class CurationSessionIdDto {
  @IsUUID('4') id: string;
}
