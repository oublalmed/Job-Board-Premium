import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UsersService } from '../users/users.service.js';
import {
  AuthTokensResponseDto,
  LoginResponseDto,
} from './dto/auth-tokens-response.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { MessageResponseDto } from './dto/message-response.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';
import {
  MfaCodeDto,
  MfaLoginDto,
  MfaSetupResponseDto,
  MfaEnableResponseDto,
} from './dto/mfa.dto.js';
import { MfaService } from './mfa.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

// §11 (OWASP) — brute-force protection. The controller is guarded by
// ThrottlerGuard; the credential-checking endpoints below carry a strict
// per-route limit, well under the app-wide default.
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // EF-CAND-01 — request a reset link. Strict limit: this is an unauthenticated
  // endpoint that triggers an email send. Always 200 with a generic message.
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  // EF-CAND-01 — complete the reset with the emailed token + new password.
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ENF-06 — second step of an MFA login: exchange the challenge token + code
  // for session tokens. Strict limit — this verifies one-time codes.
  @Post('login/mfa')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  async loginMfa(@Body() dto: MfaLoginDto) {
    return this.authService.verifyMfaChallenge(dto.mfaToken, dto.code);
  }

  // ENF-06 — MFA enrollment/management (authenticated user acting on self).
  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MfaSetupResponseDto })
  async mfaSetup(@CurrentUser() user: JwtPayload) {
    return this.mfaService.beginSetup(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MfaEnableResponseDto })
  async mfaEnable(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    return this.mfaService.enable(user.sub, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async mfaDisable(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    await this.mfaService.disable(user.sub, dto.code);
    return { message: 'MFA disabled' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiResponse({ status: 200, type: MeResponseDto })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.usersService.findById(user.sub);
    return {
      userId: user.sub,
      email: user.email,
      roles: user.roles,
      mfaEnabled: dbUser?.mfaEnabled ?? false,
    };
  }

  // EF-CAND-01 — authenticated self-service password change.
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
