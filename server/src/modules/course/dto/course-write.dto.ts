import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EntryRequirement } from '../entry-requirement';

class ScholarshipDto {
  @IsString() name: string;
  @IsNumber() pct: number;
  @IsOptional() @IsString() criteria?: string;
  @IsNumber() min_gpa: number;
}

class CourseIntakeDto {
  @IsString() term: string;
  @IsString() intake_date: string;
  @IsString() application_deadline: string;
}

/** Loose on purpose — the catalogue admin CRUD is super_admin-only and small-volume. */
export class CourseWriteDto {
  @IsString() university_id: string;
  @IsOptional() @IsString() university_name?: string;
  @IsString() country: string;
  @IsString() city: string;
  @IsOptional() @IsInt() world_rank?: number;
  @IsString() title: string;
  @IsString() degree_level: string;
  @IsString() field: string;
  @IsInt() duration_months: number;
  @IsNumber() tuition_fee: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsArray() intakes?: string[];
  @IsString() next_intake_date: string;
  @IsString() application_deadline: string;
  @IsOptional() entry?: EntryRequirement;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ScholarshipDto)
  scholarships?: ScholarshipDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CourseIntakeDto)
  course_intakes?: CourseIntakeDto[];
  @IsOptional() @IsArray() career_outcomes?: string[];
  @IsOptional() @IsString() cricos?: string;
}
