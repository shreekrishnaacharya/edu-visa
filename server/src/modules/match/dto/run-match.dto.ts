import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RunMatchDto {
  @IsString()
  student_id: string;

  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
