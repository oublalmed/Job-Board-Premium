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
