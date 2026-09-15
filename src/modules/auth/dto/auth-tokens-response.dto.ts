import { ApiProperty } from '@nestjs/swagger';

// Documentation-only: AuthService.login/refreshTokens return the plain
// `AuthTokens` interface (unchanged) — interfaces are erased at runtime,
// so @nestjs/swagger's compiler plugin can't reflect them into the
// OpenAPI document. This class exists purely so @ApiResponse({ type: ... })
// on the controller has something concrete to describe; it mirrors
// AuthTokens's shape but isn't otherwise used by the auth flow itself.
export class AuthTokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

// Documentation-only shape for POST /auth/login, which returns EITHER session
// tokens (no MFA) OR an MFA challenge. All fields are optional because only
// one of the two shapes is present on any given response.
export class LoginResponseDto {
  @ApiProperty({ required: false })
  accessToken?: string;

  @ApiProperty({ required: false })
  refreshToken?: string;

  @ApiProperty({
    required: false,
    description: 'Present and true when a second factor is required.',
  })
  mfaRequired?: boolean;

  @ApiProperty({
    required: false,
    description: 'Interim token to submit to POST /auth/login/mfa with a code.',
  })
  mfaToken?: string;
}
