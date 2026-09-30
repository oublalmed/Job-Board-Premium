import { IsBoolean } from 'class-validator';

export class SetAntiCheatDto {
  @IsBoolean()
  enabled!: boolean;
}
