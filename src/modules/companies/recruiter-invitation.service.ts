import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  RecruiterInvitation,
  RecruiterInvitationStatus,
} from './entities/recruiter-invitation.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import { Company } from './entities/company.entity.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { UsersService } from '../users/users.service.js';
import { UserStatus } from '../users/entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import { MAIL_PROVIDER } from '../../ports/mail.port.js';
import type { MailProvider } from '../../ports/mail.port.js';
import { APP_NAME } from '../../common/brand.js';

const INVITE_TTL_DAYS = 7;

export interface InviteRecruiterInput {
  email: string;
  position?: string;
}

@Injectable()
export class RecruiterInvitationService {
  private readonly logger = new Logger(RecruiterInvitationService.name);

  constructor(
    @InjectRepository(RecruiterInvitation)
    private readonly invitationRepo: Repository<RecruiterInvitation>,
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Seats already taken: active recruiters + still-pending invitations. */
  private async usedSeats(companyId: string): Promise<number> {
    const [recruiters, pending] = await Promise.all([
      this.recruiterRepo.count({ where: { companyId } }),
      this.invitationRepo.count({
        where: {
          companyId,
          status: RecruiterInvitationStatus.PENDING,
          expiresAt: MoreThan(new Date()),
        },
      }),
    ]);
    return recruiters + pending;
  }

  // EF-RECR-02 — a company_admin invites a teammate by email. If they already
  // have a verified account, attach them immediately; otherwise create a
  // pending invitation and email them a link to set their password.
  async invite(
    callerId: string,
    dto: InviteRecruiterInput,
  ): Promise<{ status: 'attached' | 'invited' }> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);
    const email = dto.email.trim().toLowerCase();

    const seatLimit = await this.subscriptionGuard.getSeatLimit(companyId);
    if ((await this.usedSeats(companyId)) >= seatLimit) {
      throw new ForbiddenException(
        `Votre abonnement est limité à ${seatLimit} recruteur(s). Passez à un pack supérieur pour en ajouter davantage.`,
      );
    }

    const targetUser = await this.usersService.findByEmail(email);

    // Already a recruiter somewhere → nothing to do.
    if (targetUser) {
      const existing = await this.recruiterRepo.findOne({
        where: { userId: targetUser.id },
      });
      if (existing) {
        throw new ConflictException(
          'Cet utilisateur est déjà rattaché à une entreprise.',
        );
      }
      // Existing, verified account → attach directly, no invite needed.
      if (targetUser.emailVerified) {
        await this.attach(targetUser.id, companyId, dto.position ?? null, callerId);
        return { status: 'attached' };
      }
    }

    // Avoid stacking duplicate pending invites for the same email/company.
    await this.invitationRepo.update(
      {
        companyId,
        email,
        status: RecruiterInvitationStatus.PENDING,
      },
      { status: RecruiterInvitationStatus.REVOKED },
    );

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const invitation = await this.invitationRepo.save(
      this.invitationRepo.create({
        companyId,
        email,
        tokenHash: this.hashToken(rawToken),
        position: dto.position ?? null,
        invitedById: callerId,
        expiresAt,
        status: RecruiterInvitationStatus.PENDING,
      }),
    );

    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });

    try {
      await this.mailProvider.send({
        to: email,
        subject: `Invitation à rejoindre ${company?.name ?? APP_NAME} sur ${APP_NAME}`,
        templateId: 'recruiter-invitation',
        variables: {
          token: rawToken,
          email,
          companyName: company?.name ?? APP_NAME,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Recruiter-invitation email failed for ${email}: ${(error as Error).message}`,
      );
    }

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.RECRUITER_INVITED,
      entityType: 'recruiter_invitation',
      entityId: invitation.id,
      metadata: { companyId, email },
    });

    return { status: 'invited' };
  }

  async listPending(callerId: string): Promise<
    Array<{
      id: string;
      email: string;
      position: string | null;
      createdAt: Date;
      expiresAt: Date;
    }>
  > {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);
    const rows = await this.invitationRepo.find({
      where: {
        companyId,
        status: RecruiterInvitationStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      position: r.position,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }

  async revoke(callerId: string, invitationId: string): Promise<void> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, companyId },
    });
    if (!invitation) {
      throw new BadRequestException('Invitation introuvable.');
    }
    invitation.status = RecruiterInvitationStatus.REVOKED;
    await this.invitationRepo.save(invitation);
  }

  /** Public — details for the accept page (company + email), or null. */
  async getByToken(
    rawToken: string,
  ): Promise<{ email: string; companyName: string; position: string | null } | null> {
    const invitation = await this.findPendingByToken(rawToken);
    if (!invitation) return null;
    const company = await this.companyRepo.findOne({
      where: { id: invitation.companyId },
    });
    return {
      email: invitation.email,
      companyName: company?.name ?? APP_NAME,
      position: invitation.position,
    };
  }

  // Public — the invitee sets a password; create (or attach) their recruiter
  // account scoped to the inviting company and consume the invitation.
  async accept(
    rawToken: string,
    password: string,
  ): Promise<{ message: string }> {
    const invitation = await this.findPendingByToken(rawToken);
    if (!invitation) {
      throw new BadRequestException('Invitation invalide ou expirée.');
    }

    // Re-check the seat cap in case seats filled since the invite was sent.
    const seatLimit = await this.subscriptionGuard.getSeatLimit(
      invitation.companyId,
    );
    const seatsNow = await this.recruiterRepo.count({
      where: { companyId: invitation.companyId },
    });
    if (seatsNow >= seatLimit) {
      throw new ForbiddenException(
        "L'entreprise a atteint sa limite de recruteurs.",
      );
    }

    let user = await this.usersService.findByEmail(invitation.email);
    if (user) {
      const existing = await this.recruiterRepo.findOne({
        where: { userId: user.id },
      });
      if (existing) {
        throw new ConflictException(
          'Cet utilisateur est déjà rattaché à une entreprise.',
        );
      }
      if (!user.emailVerified) {
        await this.usersService.update(user.id, {
          emailVerified: true,
          status: UserStatus.ACTIVE,
        });
      }
    } else {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });
      user = await this.usersService.create({
        email: invitation.email,
        passwordHash,
        roles: [Role.RECRUITER],
        status: UserStatus.ACTIVE,
        emailVerified: true,
        consentAt: new Date(),
      });
    }

    await this.attach(
      user.id,
      invitation.companyId,
      invitation.position,
      invitation.invitedById,
    );

    invitation.status = RecruiterInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await this.invitationRepo.save(invitation);

    return { message: 'Compte recruteur activé. Vous pouvez vous connecter.' };
  }

  // Attach a user to a company as a recruiter, granting the role if needed.
  private async attach(
    userId: string,
    companyId: string,
    position: string | null,
    actorId: string,
  ): Promise<void> {
    const recruiter = await this.recruiterRepo.save(
      this.recruiterRepo.create({ userId, companyId, position }),
    );
    const user = await this.usersService.findById(userId);
    if (user && !user.roles.includes(Role.RECRUITER)) {
      await this.usersService.update(userId, {
        roles: [...user.roles, Role.RECRUITER],
      });
    }
    await this.auditService.log({
      actorId,
      action: AuditAction.RECRUITER_ADDED,
      entityType: 'recruiter',
      entityId: recruiter.id,
      metadata: { companyId, addedUserId: userId },
    });
  }

  private async findPendingByToken(
    rawToken: string,
  ): Promise<RecruiterInvitation | null> {
    if (!rawToken) return null;
    return this.invitationRepo.findOne({
      where: {
        tokenHash: this.hashToken(rawToken),
        status: RecruiterInvitationStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
