import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { User } from '../users/entities/user.entity.js';
import {
  generateBase32Secret,
  buildOtpauthUri,
  verifyTotp,
} from '../../common/crypto/totp.js';
import {
  deriveKey,
  encryptSecret,
  decryptSecret,
} from '../../common/crypto/secret-box.js';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5; // → 10 hex chars per code.

export interface MfaSetupResult {
  secret: string;
  otpauthUri: string;
}

export interface MfaEnableResult {
  backupCodes: string[];
}

/**
 * ENF-06 — TOTP-based multi-factor authentication.
 *
 * Enrollment is a two-step handshake: `beginSetup` provisions and stores an
 * (encrypted) secret but leaves MFA disabled; `enable` only flips it on once
 * the user proves possession of the authenticator. Backup codes are minted at
 * enable time, returned exactly once, and stored argon2-hashed for one-time
 * consumption. `verifyForLogin` is the step-up check used by the login flow.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly encryptionKey: Buffer;
  private readonly issuer: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    // A dedicated key in prod, otherwise derived from the (required) refresh
    // secret so the feature works with zero extra config in dev/CI.
    const passphrase =
      this.configService.get<string>('auth.mfaEncryptionKey') ||
      this.configService.getOrThrow<string>('auth.jwtRefreshSecret');
    this.encryptionKey = deriveKey(passphrase);
    this.issuer = this.configService.get<string>('auth.mfaIssuer', 'Cobalt');
  }

  /** Step 1 — provision a secret (persisted encrypted) without enabling MFA yet. */
  async beginSetup(userId: string): Promise<MfaSetupResult> {
    const user = await this.getUser(userId);
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    const secret = generateBase32Secret();
    await this.usersService.update(userId, {
      mfaSecret: encryptSecret(secret, this.encryptionKey),
    });

    return {
      secret,
      otpauthUri: buildOtpauthUri({
        issuer: this.issuer,
        account: user.email,
        secretBase32: secret,
      }),
    };
  }

  /** Step 2 — verify a code against the pending secret, then enable MFA. */
  async enable(userId: string, code: string): Promise<MfaEnableResult> {
    const user = await this.getUser(userId);
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException('Start MFA setup before enabling it');
    }

    const secret = decryptSecret(user.mfaSecret, this.encryptionKey);
    if (!verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const { plain, hashed } = await this.generateBackupCodes();
    await this.usersService.update(userId, {
      mfaEnabled: true,
      mfaBackupCodes: hashed,
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_ROLES_CHANGED,
      entityType: 'user',
      entityId: userId,
      metadata: { mfa: 'enabled' },
    });
    this.logger.log(`MFA enabled for user ${userId}`);

    return { backupCodes: plain };
  }

  /** Disable MFA, requiring a valid current code (TOTP or backup) to do so. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const ok = await this.verifyCode(user, code);
    if (!ok.valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.usersService.update(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_ROLES_CHANGED,
      entityType: 'user',
      entityId: userId,
      metadata: { mfa: 'disabled' },
    });
    this.logger.log(`MFA disabled for user ${userId}`);
  }

  /**
   * Step-up verification for the login flow. Accepts a TOTP code or a
   * one-time backup code; a consumed backup code is removed from the stored
   * set (single use).
   */
  async verifyForLogin(user: User, code: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecret) {
      // No second factor configured — nothing to verify against.
      return false;
    }
    const result = await this.verifyCode(user, code);
    if (result.valid && result.consumedBackupCodes) {
      await this.usersService.update(user.id, {
        mfaBackupCodes: result.consumedBackupCodes,
      });
    }
    return result.valid;
  }

  private async verifyCode(
    user: User,
    code: string,
  ): Promise<{ valid: boolean; consumedBackupCodes?: string[] }> {
    if (!user.mfaSecret) {
      return { valid: false };
    }

    const normalized = code.replace(/\s/g, '');

    // A 6-digit numeric input is a TOTP; anything else is treated as a backup
    // code. This avoids doing (expensive) argon2 verifications on every TOTP.
    if (/^\d{6}$/.test(normalized)) {
      const secret = decryptSecret(user.mfaSecret, this.encryptionKey);
      return { valid: verifyTotp(secret, normalized) };
    }

    const remaining = user.mfaBackupCodes ?? [];
    for (let i = 0; i < remaining.length; i++) {
      if (await argon2.verify(remaining[i], normalized)) {
        const consumed = remaining.filter((_, idx) => idx !== i);
        return { valid: true, consumedBackupCodes: consumed };
      }
    }
    return { valid: false };
  }

  private async generateBackupCodes(): Promise<{
    plain: string[];
    hashed: string[];
  }> {
    const plain = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(BACKUP_CODE_BYTES).toString('hex'),
    );
    const hashed = await Promise.all(
      plain.map((c) => argon2.hash(c, { type: argon2.argon2id })),
    );
    return { plain, hashed };
  }

  private async getUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
