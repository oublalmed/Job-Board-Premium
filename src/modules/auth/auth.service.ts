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
    });

    await this.mailProvider.send({
      to: user.email,
      subject: 'Vérifiez votre adresse email - Talentiq',
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

  async login(dto: LoginDto): Promise<AuthTokens> {
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

    const tokens = await this.generateTokens(user);

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: user.id,
    });

    return tokens;
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
    const newTokens = await this.generateTokens(storedToken.user);

    storedToken.replacedBy = this.hashToken(newTokens.refreshToken);
    await this.refreshTokenRepository.save(storedToken);

    return newTokens;
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(
      { sub: payload.sub, email: payload.email, roles: payload.roles },
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

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
