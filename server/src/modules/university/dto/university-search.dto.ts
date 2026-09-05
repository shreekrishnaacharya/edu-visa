import { IsOptional } from 'class-validator';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

export class UniversitySearchDto {
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  country?: string;

  @IsOptional()
  @PageSearch({ column: 'name', operation: 'like', operator: 'and' })
  name_like?: string;
}
