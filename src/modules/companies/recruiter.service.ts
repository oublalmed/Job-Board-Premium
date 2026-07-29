import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recruiter } from './entities/recruiter.entity.js';
import { AddRecruiterDto } from './dto/add-recruiter.dto.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { Role } from '../../common/enums/role.enum.js';

export interface RecruiterSummary {
  id: string;
  userId: string;
  email: string;
  position: string | null;
  createdAt: Date;
}

@Injectable()
export class RecruiterService {
  constructor(
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async addRecruiter(
    callerId: string,
    dto: AddRecruiterDto,
  ): Promise<Recruiter> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);

    const targetUser = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );
    if (!targetUser) {
      throw new NotFoundException('No user found with this email');
    }

    if (!targetUser.emailVerified) {
      throw new ForbiddenException(
        'The target user must have a verified email before joining a company',
      );
    }

    const existing = await this.recruiterRepo.findOne({
      where: { userId: targetUser.id },
    });
    if (existing) {
      throw new ConflictException('This user is already attached to a company');
    }

    const recruiter = await this.recruiterRepo.save(
      this.recruiterRepo.create({
        userId: targetUser.id,
        companyId,
        position: dto.position ?? null,
      }),
    );

    if (!targetUser.roles.includes(Role.RECRUITER)) {
      await this.usersService.update(targetUser.id, {
        roles: [...targetUser.roles, Role.RECRUITER],
      });
    }

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.RECRUITER_ADDED,
      entityType: 'recruiter',
      entityId: recruiter.id,
      metadata: { companyId, addedUserId: targetUser.id },
    });

    return recruiter;
  }

  async listRecruiters(callerId: string): Promise<RecruiterSummary[]> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);

    const recruiters = await this.recruiterRepo.find({
      where: { companyId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return recruiters.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      position: r.position,
      createdAt: r.createdAt,
    }));
  }

  async removeRecruiter(callerId: string, recruiterId: string): Promise<void> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);

    const recruiter = await this.recruiterRepo.findOne({
      where: { id: recruiterId, companyId },
    });
    if (!recruiter) {
      throw new NotFoundException('Recruiter not found');
    }

    if (recruiter.userId === callerId) {
      throw new ConflictException('You cannot remove yourself');
    }

    await this.recruiterRepo.delete({ id: recruiterId });

    const targetUser = await this.usersService.findById(recruiter.userId);
    if (targetUser) {
      await this.usersService.update(targetUser.id, {
        roles: targetUser.roles.filter(
          (r) => r !== Role.RECRUITER && r !== Role.COMPANY_ADMIN,
        ),
      });
    }

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.RECRUITER_REMOVED,
      entityType: 'recruiter',
      entityId: recruiterId,
      metadata: { companyId, removedUserId: recruiter.userId },
    });
  }
}
