import { IsOptional, IsString, Length } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  student_id?: string;
}

export class RenameConversationDto {
  /**
   * Bounded because it is rendered in a fixed-width list; the service also
   * collapses whitespace and truncates, so this only rejects the absurd.
   */
  @IsString()
  @Length(1, 200)
  title: string;
}
