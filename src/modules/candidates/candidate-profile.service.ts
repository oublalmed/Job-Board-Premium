import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ProfileLink } from './entities/profile-link.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from './entities/document.entity.js';
import { SettingsService } from '../settings/settings.service.js';

interface MissingElement {
  key: string;
  label: string;
  weight: number;
}

export interface CompletenessResult {
  completeness: number;
  isPublishable: boolean;
  missing: MissingElement[];
}

interface CompletenessWeights {
  identity: number;
  experience: number;
  skills: number;
  cv: number;
  links: number;
  availability: number;
  school: number;
  threshold: number;
  minSkills: number;
}

@Injectable()
export class CandidateProfileService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(ProfileSkill)
    private readonly skillRepo: Repository<ProfileSkill>,
    @InjectRepository(Experience)
    private readonly experienceRepo: Repository<Experience>,
    @InjectRepository(ProfileLink)
    private readonly linkRepo: Repository<ProfileLink>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly settingsService: SettingsService,
  ) {}

  async findByUserId(userId: string): Promise<CandidateProfile | null> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  async createProfile(userId: string): Promise<CandidateProfile> {
    const profile = this.profileRepo.create({ userId });
    return this.profileRepo.save(profile);
  }

  // Shared by the experience/link/skill services below (Front 1
  // prerequisite) — they all need "my profile row, created on first touch
  // if it doesn't exist yet" exactly like CandidateProfileController's
  // getMyProfile/updateMyProfile already do inline. Added here rather than
  // refactoring those two call sites to avoid touching already-tested,
  // already-shipped controller code for an unrelated change.
  async findOrCreateProfile(userId: string): Promise<CandidateProfile> {
    const existing = await this.findByUserId(userId);
    return existing ?? this.createProfile(userId);
  }

  async updateProfile(
    profileId: string,
    data: Partial<
      Pick<
        CandidateProfile,
        | 'firstName'
        | 'lastName'
        | 'headline'
        | 'bio'
        | 'availability'
        | 'mobility'
        | 'location'
        | 'school'
        | 'visibility'
      >
    >,
  ): Promise<CandidateProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    Object.assign(profile, data);
    const saved = await this.profileRepo.save(profile);

    await this.calculateCompleteness(profileId);

    return saved;
  }

  async calculateCompleteness(profileId: string): Promise<CompletenessResult> {
    const profile = await this.profileRepo.findOne({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const weights = await this.loadWeights();
    const missing: MissingElement[] = [];
    let completeness = 0;

    const hasIdentity =
      !!profile.firstName &&
      !!profile.lastName &&
      !!profile.headline &&
      !!profile.bio;
    if (hasIdentity) {
      completeness += weights.identity;
    } else {
      missing.push({
        key: 'identity',
        label: 'Identité + headline + bio',
        weight: weights.identity,
      });
    }

    const experienceCount = await this.experienceRepo.count({
      where: { profileId },
    });
    if (experienceCount >= 1) {
      completeness += weights.experience;
    } else {
      missing.push({
        key: 'experience',
        label: '>= 1 expérience ou formation',
        weight: weights.experience,
      });
    }

    const skillCount = await this.skillRepo.count({
      where: { profileId },
    });
    if (skillCount >= weights.minSkills) {
      completeness += weights.skills;
    } else {
      missing.push({
        key: 'skills',
        label: `>= ${weights.minSkills} compétences`,
        weight: weights.skills,
      });
    }

    const cv = await this.documentRepo.findOne({
      where: {
        ownerId: profile.userId,
        type: DocumentType.CV,
        scanStatus: ScanStatus.CLEAN,
      },
    });
    if (cv) {
      completeness += weights.cv;
    } else {
      missing.push({
        key: 'cv',
        label: 'CV téléversé (scanné OK)',
        weight: weights.cv,
      });
    }

    const linkCount = await this.linkRepo.count({
      where: { profileId },
    });
    if (linkCount >= 1) {
      completeness += weights.links;
    } else {
      missing.push({
        key: 'links',
        label: '>= 1 lien externe',
        weight: weights.links,
      });
    }

    if (profile.availability && profile.mobility) {
      completeness += weights.availability;
    } else {
      missing.push({
        key: 'availability',
        label: 'Disponibilité + mobilité',
        weight: weights.availability,
      });
    }

    if (profile.school) {
      completeness += weights.school;
    } else {
      missing.push({
        key: 'school',
        label: 'École',
        weight: weights.school,
      });
    }

    profile.completeness = completeness;
    await this.profileRepo.save(profile);

    return {
      completeness,
      isPublishable: completeness >= weights.threshold,
      missing,
    };
  }

  private async loadWeights(): Promise<CompletenessWeights> {
    const [
      identity,
      experience,
      skills,
      cv,
      links,
      availability,
      school,
      threshold,
      minSkills,
    ] = await Promise.all([
      this.settingsService.getNumber('completeness_weight_identity'),
      this.settingsService.getNumber('completeness_weight_experience'),
      this.settingsService.getNumber('completeness_weight_skills'),
      this.settingsService.getNumber('completeness_weight_cv'),
      this.settingsService.getNumber('completeness_weight_links'),
      this.settingsService.getNumber('completeness_weight_availability'),
      this.settingsService.getNumber('completeness_weight_school'),
      this.settingsService.getNumber('completeness_threshold_publishable'),
      this.settingsService.getNumber('completeness_min_skills'),
    ]);

    return {
      identity: identity ?? 15,
      experience: experience ?? 20,
      skills: skills ?? 20,
      cv: cv ?? 15,
      links: links ?? 15,
      availability: availability ?? 10,
      school: school ?? 5,
      threshold: threshold ?? 70,
      minSkills: minSkills ?? 5,
    };
  }
}
