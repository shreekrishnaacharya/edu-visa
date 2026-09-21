import { IsString } from 'class-validator';

export class DraftReplyDto {
  @IsString()
  student_id: string;

  @IsString()
  question: string;
}
