import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { CandidateProfileService } from './candidate-profile.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

// EF-CAND-07 — CRUD scoped to the authenticated candidate's own profile,
// mirroring CandidateCertificationService. Ownership is enforced in the WHERE
// clause (id + profileId together), never a load-then-JS-check (ADR-0001).
@Injectable()
export class CandidateProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly profileService: CandidateProfileService,
  ) {}

  async listMine(userId: string): Promise<Project[]> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    return this.projectRepo.find({
      where: { profileId: profile.id },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const project = this.projectRepo.create({
      profileId: profile.id,
      title: dto.title,
      description: dto.description,
      url: dto.url ?? null,
      role: dto.role ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });
    return this.projectRepo.save(project);
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const project = await this.projectRepo.findOne({
      where: { id: projectId, profileId: profile.id },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    Object.assign(project, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
      ...(dto.endDate !== undefined && { endDate: dto.endDate }),
    });

    return this.projectRepo.save(project);
  }

  async remove(userId: string, projectId: string): Promise<void> {
    const profile = await this.profileService.findOrCreateProfile(userId);
    const result = await this.projectRepo.delete({
      id: projectId,
      profileId: profile.id,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Project not found');
    }
  }
}
