import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class IngestItemMetaDto {
  @IsString() title: string;
  @IsString() doc_type: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() institution?: string;
  @IsString() publisher: string;
  @IsOptional() @IsString() effective_date?: string;
  @IsOptional() @IsString() review_by?: string;
}

class IngestItemDto {
  @IsString() url: string;
  @ValidateNested() @Type(() => IngestItemMetaDto) meta: IngestItemMetaDto;
}

export class IngestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestItemDto)
  items: IngestItemDto[];
}

class IngestTextItemDto {
  @IsString() source_url: string;
  @IsString() text: string;
  @ValidateNested() @Type(() => IngestItemMetaDto) meta: IngestItemMetaDto;
}

export class IngestTextDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestTextItemDto)
  items: IngestTextItemDto[];
}

export class SearchDto {
  @IsString() query: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() doc_type?: string;
  @IsOptional() @IsString() institution?: string;
}
