import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ProfileOverrideDto } from './profile-override.dto';

export class RunMatchDto {
  @IsString()
  student_id: string;

  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  limit?: number;

  /** Whether a real institution's not_eligible verdict knocks a course out of the ranked results — the report's live toggle. Default true. */
  @IsOptional()
  @IsBoolean()
  enforce_admission_eligibility?: boolean;

  /** "What-if" overrides on top of the student's real profile/preferences — see ProfileOverrideDto. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileOverrideDto)
  profile_override?: ProfileOverrideDto;
}
