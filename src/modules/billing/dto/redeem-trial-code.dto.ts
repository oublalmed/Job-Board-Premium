import { IsString, MinLength } from 'class-validator';

export class RedeemTrialCodeDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
