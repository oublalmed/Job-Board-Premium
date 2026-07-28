import { IsString, IsNotEmpty } from 'class-validator';

export class WebhookScoreDto {
  @IsString()
  @IsNotEmpty()
  signature!: string;
}
