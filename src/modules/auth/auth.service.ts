import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { User, UserStatus } from '../users/entities/user.entity.js';
import { RefreshToken } from '../users/entities/refresh-token.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ReferralService } from '../growth/referral.service.js';
import { MfaService } from './mfa.service.js';
import { APP_NAME } from '../../common/brand.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity.js';
import { Role } from '../../common/enums/role.enum.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import type { MailProvider } from '../../ports/mail.port.js';
import { MAIL_PROVIDER } from '../../ports/mail.port.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResult = AuthTokens | MfaChallenge;

const MFA_CHALLENGE_PURPOSE = 'mfa_challenge';
// Short-lived: the interim token only has to survive the user typing a code.
const MFA_CHALLENGE_EXPIRATION = '5m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly auditService: AuditService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
    private readonly referralService: ReferralService,
    private readonly mfaService: MfaService,
    // Optional so the auth unit tests don't need the (global) analytics module.
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: { id: string; email: string }; message: string }> {
    const existing = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const verificationToken = uuidv4();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    const allowedRoles = dto.roles?.filter(
      (r) => r === Role.CANDIDATE || r === Role.RECRUITER,
    );
    const roles =
      allowedRoles && allowedRoles.length > 0 ? allowedRoles : [Role.CANDIDATE];

    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      roles,
      status: UserStatus.PENDING_VERIFICATION,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      // ENF-12 — record when consent was given (the DTO guarantees it was).
      consentAt: new Date(),
    });

    await this.mailProvider.send({
      to: user.email,
      subject: `Vérifiez votre adresse email - ${APP_NAME}`,
      templateId: 'email-verification',
      variables: {
        token: verificationToken,
        email: user.email,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_REGISTERED,
      entityType: 'user',
      entityId: user.id,
    });

    // EF-GROW-02 — attribute the signup to a referrer if an invite code was
    // supplied. Strictly best-effort: referral bookkeeping must never break
    // account creation.
    try {
      await this.referralService.recordSignup(dto.referralCode, user.id);
    } catch (error) {
      this.logger.warn(
        `Referral signup tracking failed for ${user.id}: ${(error as Error).message}`,
      );
    }

    // EF-ADM-05 funnel — fire-and-forget.
    void this.analytics?.track(AnalyticsEventType.SIGNUP, user.id, { roles });

    return {
      user: { id: user.id, email: user.email },
      message: 'Registration successful. Please verify your email.',
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.findUserByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.update(user.id, {
      emailVerified: true,
      status: UserStatus.ACTIVE,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_EMAIL_VERIFIED,
      entityType: 'user',
      entityId: user.id,
    });

    // EF-GROW-02 — a verified email is the tracked "conversion".
    // Best-effort: never fail verification over referral bookkeeping.
    try {
      await this.referralService.markConverted(user.id);
    } catch (error) {
      this.logger.warn(
        `Referral conversion tracking failed for ${user.id}: ${(error as Error).message}`,
      );
    }

    // EF-ADM-05 funnel — fire-and-forget.
    void this.analytics?.track(AnalyticsEventType.EMAIL_VERIFIED, user.id);

    return { message: 'Email verified successfully' };
  }

  /**
   * EF-CAND-01 — start a password reset. Always resolves with the same
   * outcome whether or not the email maps to an eligible account, so an
   * attacker cannot use this to enumerate registered emails. When it does
   * match, a single-use token (hashed at rest, raw value emailed) valid for
   * one hour is issued.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const genericMessage =
      'If an account exists for that email, a reset link has been sent.';

    const user = await this.usersService.findByEmail(email.toLowerCase());
    // Only active, verified accounts can reset — but we still return the same
    // message for everything else.
    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerified) {
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.update(user.id, {
      passwordResetToken: this.hashToken(rawToken),
      passwordResetExpires: expires,
    });

    // Best-effort delivery — the generic response never reveals a send failure.
    try {
      await this.mailProvider.send({
        to: user.email,
        subject: `Réinitialisation de votre mot de passe - ${APP_NAME}`,
        templateId: 'password-reset',
        variables: { token: rawToken, email: user.email },
      });
    } catch (error) {
      this.logger.warn(
        `Password-reset email failed for ${user.id}: ${(error as Error).message}`,
      );
    }

    return { message: genericMessage };
  }

  /**
   * EF-CAND-01 — complete a password reset. Validates the emailed token
   * against its stored hash + expiry, sets the new password, clears the token,
   * and revokes every existing session so a compromised session cannot
   * survive a reset.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.findUserByResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    await this.usersService.update(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    await this.revokeAllUserTokens(user.id);

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_PASSWORD_CHANGED,
      entityType: 'user',
      entityId: user.id,
      metadata: { via: 'password_reset' },
    });

    return { message: 'Password reset successfully' };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // ENF-06 — password is only the first factor when MFA is enabled. Issue a
    // short-lived challenge token instead of session tokens; the client
    // completes login via verifyMfaChallenge with a TOTP/backup code.
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaToken: this.issueMfaChallengeToken(user.id),
      };
    }

    const tokens = await this.generateTokens(user);

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: user.id,
    });

    return tokens;
  }

  /**
   * ENF-06 — second step of an MFA login. Validates the interim challenge
   * token and the submitted code, then issues MFA-authenticated session
   * tokens.
   */
  async verifyMfaChallenge(
    mfaToken: string,
    code: string,
  ): Promise<AuthTokens> {
    let userId: string;
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        purpose?: string;
      }>(mfaToken, {
        secret: this.configService.getOrThrow<string>('auth.jwtRefreshSecret'),
      });
      if (payload.purpose !== MFA_CHALLENGE_PURPOSE) {
        throw new Error('wrong purpose');
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    const valid = await this.mfaService.verifyForLogin(user, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const tokens = await this.generateTokens(user, { mfaAuthenticated: true });

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: user.id,
      metadata: { mfa: true },
    });

    return tokens;
  }

  private issueMfaChallengeToken(userId: string): string {
    // Signed with the REFRESH secret, not the access secret, so this interim
    // token is structurally invalid as a bearer access token (JwtStrategy
    // only trusts the access secret). The `purpose` claim is checked on
    // redemption as defence in depth.
    return this.jwtService.sign(
      { sub: userId, purpose: MFA_CHALLENGE_PURPOSE },
      {
        secret: this.configService.getOrThrow<string>('auth.jwtRefreshSecret'),
        expiresIn: MFA_CHALLENGE_EXPIRATION,
      },
    );
  }

  async refreshTokens(refreshTokenValue: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshTokenValue);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revoked) {
      await this.revokeAllUserTokens(storedToken.userId);
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions revoked.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    storedToken.revoked = true;
    // Carry the session's MFA state across rotation so a step-up
    // authentication is not silently downgraded on refresh (ENF-06).
    const newTokens = await this.generateTokens(storedToken.user, {
      mfaAuthenticated: storedToken.mfaAuthenticated,
    });

    storedToken.replacedBy = this.hashToken(newTokens.refreshToken);
    await this.refreshTokenRepository.save(storedToken);

    return newTokens;
  }

  private async generateTokens(
    user: User,
    opts: { mfaAuthenticated?: boolean } = {},
  ): Promise<AuthTokens> {
    const mfaAuthenticated = opts.mfaAuthenticated ?? false;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      mfa: mfaAuthenticated,
    };

    const accessToken = this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
        mfa: mfaAuthenticated,
      },
      {
        secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'auth.jwtAccessExpiration',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshTokenValue = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshTokenValue);

    const expiresAt = new Date();
    const refreshExpiration = this.configService.getOrThrow<string>(
      'auth.jwtRefreshExpiration',
    );
    const days = parseInt(refreshExpiration, 10);
    expiresAt.setDate(expiresAt.getDate() + (isNaN(days) ? 7 : days));

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenHash,
        userId: user.id,
        expiresAt,
        revoked: false,
        mfaAuthenticated,
      }),
    );

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );
    this.logger.warn(`All refresh tokens revoked for user ${userId}`);
  }

  private async findUserByVerificationToken(
    token: string,
  ): Promise<User | null> {
    const users = await this.refreshTokenRepository.manager.find(User, {
      where: {
        emailVerificationToken: token,
      },
    });
    const user = users[0];
    if (
      !user ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      return null;
    }
    return user;
  }

  /**
   * EF-CAND-01 — an authenticated user changes their own password. Re-verifies
   * the current password before applying the new one; existing sessions are
   * left intact (a voluntary change from a trusted session).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });
    await this.usersService.update(user.id, { passwordHash });

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_PASSWORD_CHANGED,
      entityType: 'user',
      entityId: user.id,
      metadata: { via: 'self_service' },
    });

    return { message: 'Password changed successfully' };
  }

  private async findUserByResetToken(token: string): Promise<User | null> {
    const tokenHash = this.hashToken(token);
    const users = await this.refreshTokenRepository.manager.find(User, {
      where: { passwordResetToken: tokenHash },
    });
    const user = users[0];
    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      return null;
    }
    return user;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
