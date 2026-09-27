import { IsOptional } from 'class-validator';
import { PageSearch } from '@sksharma72000/nestjs-search-page';

/**
 * Field names match what the frontend's Refine filter layer emits: `eq` → plain
 * field, `contains` → `<field>_like`. See NEST_SEARCH.MD Appendix A.
 *
 * Extended beyond name/country once the catalogue grew from 8 institutions to
 * the whole CRICOS register (~663): a list that size is unusable without being
 * able to narrow by city, provider type, or whether the site can even be read
 * automatically.
 */
export class UniversitySearchDto {
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  country?: string;

  @IsOptional()
  @PageSearch({ column: 'name', operation: 'like', operator: 'and' })
  name_like?: string;

  @IsOptional()
  @PageSearch({ column: 'city', operation: 'like', operator: 'and' })
  city_like?: string;

  /** 'Government' or 'Private', as the CRICOS register publishes it. */
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  institution_type?: string;

  /** 'ok' | 'blocked' | 'unknown' — whether the requirement scraper can read the site. */
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  auto_source_status?: string;

  @IsOptional()
  @PageSearch({ column: 'cricos_provider_code', operation: 'like', operator: 'and' })
  cricos_provider_code_like?: string;

  /**
   * Lets a record find the others that share its admission policy. Needed because
   * the aggregator import created 9 rows that duplicate real register providers,
   * and a duplicate has to be able to point at its registered counterpart rather
   * than just showing empty registry fields.
   */
  @IsOptional()
  @PageSearch({ operation: 'eq', operator: 'and' })
  policy_key?: string;
}
