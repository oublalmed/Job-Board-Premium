import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User, UserStatus } from '../users/entities/user.entity.js';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { ProfileLink } from './entities/profile-link.entity.js';
import { Document } from './entities/document.entity.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../ports/object-storage.port.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

@Injectable()
export class CandidateDataService {
  private readonly logger = new Logger(CandidateDataService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(Experience)
    private readonly experienceRepo: Repository<Experience>,
    @InjectRepository(ProfileSkill)
    private readonly profileSkillRepo: Repository<ProfileSkill>,
    @InjectRepository(ProfileLink)
    private readonly profileLinkRepo: Repository<ProfileLink>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async exportData(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }

    const profile = await this.profileRepo.findOne({ where: { userId } });

    const [experiences, profileSkills, links, documents] = await Promise.all([
      profile
        ? this.experienceRepo.find({ where: { profileId: profile.id } })
        : Promise.resolve([]),
      profile
        ? this.profileSkillRepo.find({
            where: { profileId: profile.id },
            relations: { skill: true },
          })
        : Promise.resolve([]),
      profile
        ? this.profileLinkRepo.find({ where: { profileId: profile.id } })
        : Promise.resolve([]),
      this.documentRepo.find({ where: { ownerId: userId } }),
    ]);

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_DATA_EXPORTED,
      entityType: 'User',
      entityId: userId,
    });

    return {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        roles: user.roles,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            headline: profile.headline,
            bio: profile.bio,
            school: profile.school,
            completeness: profile.completeness,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
      experiences: experiences.map((e) => ({
        type: e.type,
        title: e.title,
        organization: e.organization,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
      skills: profileSkills.map((ps) => ({
        name: ps.skill.name,
        category: ps.skill.category,
        level: ps.level,
      })),
      links: links.map((l) => ({
        type: l.type,
        url: l.url,
        label: l.label,
      })),
      documents: documents.map((d) => ({
        type: d.type,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        createdAt: d.createdAt,
      })),
    };
  }

  async deleteData(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }

    const documents = await this.documentRepo.find({
      where: { ownerId: userId },
    });
    for (const doc of documents) {
      try {
        await this.objectStorage.delete(doc.storageKey);
      } catch {
        this.logger.warn(
          `Failed to delete storage object for document ${doc.id}`,
        );
      }
    }

    if (documents.length > 0) {
      await this.documentRepo.remove(documents);
    }

    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (profile) {
      await this.profileRepo.remove(profile);
    }

    user.email = `deleted_${uuidv4()}@anonymized.local`;
    user.passwordHash = '';
    user.status = UserStatus.DELETED;
    user.emailVerified = false;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepo.save(user);

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: userId,
    });
  }
}
