import { IsOptional, IsString } from 'class-validator';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

export class StudentSearchDto {
  // `full_name` filter uses `contains` on the frontend, which `generateFilter`
  // suffixes `_like` — the DTO property name must match the wire param exactly.
  @IsOptional()
  @PageSearch({ column: 'full_name', operation: 'like', operator: 'and' })
  full_name_like?: string;

  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  state?: string;

  /**
   * Country filter — the frontend sends `contains` on
   * `preferences.preferred_countries` (a text[] on the joined table).  Array
   * containment doesn't fit the search library's operators cleanly, so this is
   * NOT a `@PageSearch` field: StudentService resolves it to an `id IN (...)`
   * pre-filter (see `list`).  Declared here only so `whitelist: true` keeps it.
   */
  @IsOptional()
  @IsString()
  'preferences.preferred_countries_like'?: string;

  // Tenancy — set server-side only, never trusted from the client (see
  // StudentController where these are overwritten from @AuthUser).
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  branch_id?: string;

  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  counsellor_id?: string;
}
