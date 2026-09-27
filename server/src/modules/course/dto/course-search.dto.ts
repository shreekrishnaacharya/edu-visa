import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

/**
 * Field names match exactly what the frontend's `generateFilter`
 * (`@refinedev/simple-rest`) emits for the operators the catalogue screen uses:
 * `eq` → plain field, `contains` → `<field>_like`, `lte` → `<field>_lte`.
 * See NEST_SEARCH.MD Appendix A — every eq filter is pinned `{eq, and}` so it
 * never falls back to the decorator default (`like`/`or`).
 */
export class CourseSearchDto {
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  country?: string;

  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  degree_level?: string;

  @IsOptional()
  @PageSearch({ column: 'field', operation: 'like', operator: 'and' })
  field_like?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @PageSearch({ column: 'tuition_fee', operation: 'lteq', operator: 'and' })
  tuition_fee_lte?: number;

  @IsOptional()
  @PageSearch({ column: 'title', operation: 'like', operator: 'and' })
  title_like?: string;

  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  university_id?: string;

  /**
   * "Where can I actually study this?" — matches the cities a course is really
   * taught in, which is not the same as everywhere its provider operates. Array
   * containment doesn't fit the search library's operators, so CourseService
   * resolves it (see `list`); declared here so `whitelist: true` keeps it.
   */
  @IsOptional()
  @IsString()
  campus_city?: string;
}
