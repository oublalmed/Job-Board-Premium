import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/** Body for enabling/disabling MFA and for the login step-up: a code. */
export class MfaCodeDto {
  @ApiProperty({
    description: 'A 6-digit TOTP code or a one-time backup code.',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}

/** Body for completing an MFA login: the challenge token plus a code. */
export class MfaLoginDto extends MfaCodeDto {
  @ApiProperty({ description: 'The mfaToken returned by POST /auth/login.' })
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({
    description: 'Base32 shared secret (also encoded in the URI).',
  })
  secret!: string;

  @ApiProperty({
    description: 'otpauth:// provisioning URI to render as a QR code.',
  })
  otpauthUri!: string;
}

export class MfaEnableResponseDto {
  @ApiProperty({
    type: [String],
    description: 'One-time backup codes. Shown once — store them securely.',
  })
  backupCodes!: string[];
}
