import { IsString, MinLength } from 'class-validator';
import { StrongPassword } from '../../../common/validators/strong-password.decorator.js';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @StrongPassword()
  password!: string;
}
