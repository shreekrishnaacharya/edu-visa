import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Shared pagination / sort surface for every list endpoint. Matches the
 * `_start` / `_end` / `_sort` / `_order` contract the frontend dataProvider and
 * `@refinedev/simple-rest` emit.  `_end` is an ABSOLUTE row index, not a page
 * size (take = _end - _start).
 */
export class PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _start = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _end = 25;

  @IsOptional()
  @IsString()
  _sort = 'id';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  _order: 'ASC' | 'DESC' = 'DESC';
}
