import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Company, CompanyStatus } from './entities/company.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './entities/subscription.entity.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UsersService } from '../users/users.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { Role } from '../../common/enums/role.enum.js';

const DEFAULT_TRIAL_DURATION_DAYS = 14;
const DEFAULT_STARTER_CONTACT_QUOTA = 15;

export interface CompanyWithSubscription {
  company: Company;
  subscription: Subscription | null;
}

export interface PartnerCompany {
  id: string;
  name: string;
  logo: string | null;
  sector: string | null;
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  async createCompany(
    userId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyWithSubscription> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'A verified professional email is required to create a company',
      );
    }

    const existingRecruiter = await this.recruiterRepo.findOne({
      where: { userId },
    });
    if (existingRecruiter) {
      throw new ConflictException('You are already attached to a company');
    }

    const existingCompany = await this.companyRepo.findOne({
      where: { ice: dto.ice },
    });
    if (existingCompany) {
      throw new ConflictException('A company with this ICE already exists');
    }

    const company = await this.companyRepo.save(
      this.companyRepo.create({
        name: dto.name,
        ice: dto.ice,
        registrationNumber: dto.registrationNumber ?? null,
      }),
    );

    await this.recruiterRepo.save(
      this.recruiterRepo.create({ userId, companyId: company.id }),
    );

    if (!user.roles.includes(Role.COMPANY_ADMIN)) {
      await this.usersService.update(userId, {
        roles: [...user.roles, Role.COMPANY_ADMIN],
      });
    }

    const [trialDurationDays, starterContactQuota] = await Promise.all([
      this.settingsService.getNumber(
        'trial_duration_days',
        'TRIAL_DURATION_DAYS',
      ),
      this.settingsService.getNumber(
        'plan_starter_contacts',
        'PLAN_STARTER_CONTACTS',
      ),
    ]);

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(
      endsAt.getDate() + (trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS),
    );

    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        companyId: company.id,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.TRIAL,
        contactQuota: starterContactQuota ?? DEFAULT_STARTER_CONTACT_QUOTA,
        contactsUsed: 0,
        startsAt,
        endsAt,
      }),
    );

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.COMPANY_CREATED,
      entityType: 'company',
      entityId: company.id,
      metadata: {
        name: company.name,
        plan: subscription.plan,
        trialEndsAt: endsAt.toISOString(),
      },
    });

    return { company, subscription };
  }

  async getMyCompany(userId: string): Promise<CompanyWithSubscription> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId },
      relations: { company: true },
    });

    if (!recruiter) {
      throw new NotFoundException('No company associated with this account');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId: recruiter.companyId },
      order: { createdAt: 'DESC' },
    });

    return { company: recruiter.company, subscription };
  }

  // Public showcase for the landing "Ils nous ont fait confiance" section:
  // only active, verified companies that have actually uploaded a logo, so we
  // never render a broken tile or claim an endorsement a company didn't set up.
  async listPartners(): Promise<PartnerCompany[]> {
    const companies = await this.companyRepo.find({
      where: {
        status: CompanyStatus.ACTIVE,
        verified: true,
        logo: Not(IsNull()),
      },
      order: { name: 'ASC' },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      sector: c.sector,
    }));
  }
}
