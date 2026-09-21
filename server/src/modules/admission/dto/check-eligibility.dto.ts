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
}
