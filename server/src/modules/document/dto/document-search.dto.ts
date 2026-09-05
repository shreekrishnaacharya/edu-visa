import { IsOptional } from 'class-validator';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

export class DocumentSearchDto {
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  student_id?: string;
}
