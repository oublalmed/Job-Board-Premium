import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from './entities/certification.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import type { CreateCertificationDto } from './dto/create-certification.dto.js';
import type { UpdateCertificationDto } from './dto/update-certification.dto.js';

// EF-CAND-07 — CRUD scoped to the authenticated candidate's own profile,
// mirroring CandidateExperienceService. Ownership is enforced in the WHERE
// clause (id + profileId together), never a load-then-JS-check (ADR-0001).
@Injectable()
export class CandidateCertificationService {
  constructor(
    @InjectRepository(Certification)
    private readonly certificationRepo: Repository<Certification>,
    private readonly profileService: CandidateProfileService,
  ) {}

  async listMine(userId: string): Promise<Certification[]> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    return this.certificationRepo.find({
      where: { profileId: profile.id },
      order: { issueDate: 'DESC' },
    });
  }

  async create(
    userId: string,
    dto: CreateCertificationDto,
  ): Promise<Certification> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const certification = this.certificationRepo.create({
      profileId: profile.id,
      name: dto.name,
      issuer: dto.issuer,
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate ?? null,
      credentialUrl: dto.credentialUrl ?? null,
    });
    return this.certificationRepo.save(certification);
  }

  async update(
    userId: string,
    certificationId: string,
    dto: UpdateCertificationDto,
  ): Promise<Certification> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const certification = await this.certificationRepo.findOne({
      where: { id: certificationId, profileId: profile.id },
    });
    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    Object.assign(certification, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.issuer !== undefined && { issuer: dto.issuer }),
      ...(dto.issueDate !== undefined && { issueDate: dto.issueDate }),
      ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate }),
      ...(dto.credentialUrl !== undefined && {
        credentialUrl: dto.credentialUrl,
      }),
    });

    return this.certificationRepo.save(certification);
  }

  async remove(userId: string, certificationId: string): Promise<void> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const result = await this.certificationRepo.delete({
      id: certificationId,
      profileId: profile.id,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Certification not found');
    }
  }
}
