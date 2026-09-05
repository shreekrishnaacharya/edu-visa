import { IsOptional, IsString } from 'class-validator';

export class PostMessageDto {
  @IsOptional()
  @IsString()
  conversation_id?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsString()
  body: string;
}
