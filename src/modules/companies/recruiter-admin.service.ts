import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Recruiter } from './entities/recruiter.entity.js';
import { Company } from './entities/company.entity.js';
import { SubscriptionPlan } from './entities/subscription.entity.js';
import { SubscriptionAdminService } from './subscription-admin.service.js';
import { CreateRecruiterDto } from './dto/create-recruiter.dto.js';
import { UsersService } from '../users/users.service.js';
import { UserStatus } from '../users/entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { MailProvider } from '../../ports/mail.port.js';
import { MAIL_PROVIDER } from '../../ports/mail.port.js';
import { APP_NAME } from '../../common/brand.js';

// How long the recruiter's set-password invite link stays valid. Longer than a
// self-service reset (1h) — an admin-provisioned invite may sit in an inbox a
// while before the recruiter acts on it.
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedRecruiter {
  recruiterId: string;
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  plan: SubscriptionPlan | null;
}

// Admin-side provisioning of recruiter accounts. Recruiters no longer self-
// register: an admin creates the account here, attaches it to a company,
// optionally assigns a pack, and the recruiter receives an email with their
// login and a link to set their own password.
@Injectable()
export class RecruiterAdminService {
  private readonly logger = new Logger(RecruiterAdminService.name);

  constructor(
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly usersService: UsersService,
    private readonly subscriptionAdmin: SubscriptionAdminService,
    private readonly auditService: AuditService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
  ) {}

  async createRecruiter(
    adminId: string,
    dto: CreateRecruiterDto,
  ): Promise<CreatedRecruiter> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const company = await this.resolveCompany(dto);

    // The recruiter never chooses this password; it is a random placeholder so
    // the account has a valid hash before they complete the set-password flow.
    const placeholderHash = await argon2.hash(randomBytes(24).toString('hex'), {
      type: argon2.argon2id,
    });

    // Single-use set-password token: raw value emailed, only its hash stored
    // (same scheme as AuthService's password-reset, so the existing
    // /reset-password flow accepts it).
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Admin-vouched: active + email pre-verified, so once the password is set
    // the recruiter can log straight in (login requires ACTIVE + verified).
    const user = await this.usersService.create({
      email,
      passwordHash: placeholderHash,
      roles: [Role.RECRUITER],
      status: UserStatus.ACTIVE,
      emailVerified: true,
      passwordResetToken: tokenHash,
      passwordResetExpires: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      consentAt: new Date(),
    });

    const recruiter = await this.recruiterRepo.save(
      this.recruiterRepo.create({
        userId: user.id,
        companyId: company.id,
        position: dto.position?.trim() || null,
      }),
    );

    // Optional pack assignment, per the recruiter's contract.
    let assignedPlan: SubscriptionPlan | null = null;
    if (dto.plan) {
      const sub = await this.subscriptionAdmin.assignPlan(
        company.id,
        dto.plan,
        dto.contactQuota,
      );
      assignedPlan = sub.plan;
    }

    await this.auditService.log({
      actorId: adminId,
      action: AuditAction.RECRUITER_ADDED,
      entityType: 'recruiter',
      entityId: recruiter.id,
      metadata: {
        companyId: company.id,
        addedUserId: user.id,
        provisionedByAdmin: true,
        plan: assignedPlan,
      },
    });

    // The credentials email — best-effort: a mail outage must not undo the
    // account that was already created (the admin can resend / share the link).
    try {
      await this.mailProvider.send({
        to: email,
        subject: `Votre compte recruteur - ${APP_NAME}`,
        templateId: 'recruiter-invite',
        variables: {
          token: rawToken,
          email,
          companyName: company.name,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Recruiter invite email failed for ${email}: ${(error as Error).message}`,
      );
    }

    return {
      recruiterId: recruiter.id,
      userId: user.id,
      email,
      companyId: company.id,
      companyName: company.name,
      plan: assignedPlan,
    };
  }

  private async resolveCompany(dto: CreateRecruiterDto): Promise<Company> {
    if (dto.companyId) {
      const company = await this.companyRepo.findOne({
        where: { id: dto.companyId },
      });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const name = dto.companyName?.trim();
    if (!name) {
      throw new BadRequestException(
        'Either an existing companyId or a companyName is required',
      );
    }
    return this.companyRepo.save(this.companyRepo.create({ name }));
  }
}
