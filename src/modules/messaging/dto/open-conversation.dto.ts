import { IsUUID, IsString, MinLength } from 'class-validator';

export class OpenConversationDto {
  @IsUUID()
  candidateProfileId!: string;

  @IsString()
  @MinLength(1)
  message!: string;
}
