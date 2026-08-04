import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from './entities/specialty.entity.js';
import { Test } from './entities/test.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import { PSYCHOTECHNICAL_ITEM_TYPES } from './psychotechnical-item-types.js';
import {
  TECHNIQUE_WEIGHT_KEY,
  PSYCHOTECHNIQUE_WEIGHT_KEY,
  DEFAULT_TECHNIQUE_WEIGHT,
  DEFAULT_PSYCHOTECHNIQUE_WEIGHT,
} from './webhook.service.js';

export interface SpecialtySummary {
  id: string;
  name: string;
  description: string | null;
}

export interface TestSummary {
  id: string;
  specialtyId: string;
  durationMinutes: number;
}

export interface EvaluationComposition {
  techniqueWeight: number;
  psychotechniqueWeight: number;
  psychotechnicalItemTypes: string[];
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
    @InjectRepository(Test)
    private readonly testRepo: Repository<Test>,
    private readonly settingsService: SettingsService,
  ) {}

  // Same weights WebhookService actually uses to compute Score.value —
  // read from the same settings keys rather than duplicating the 60/40
  // default separately, so this display never drifts from what scoring
  // really does.
  async getComposition(): Promise<EvaluationComposition> {
    const [techniqueWeight, psychotechniqueWeight] = await Promise.all([
      this.settingsService
        .getNumber(TECHNIQUE_WEIGHT_KEY)
        .then((v) => v ?? DEFAULT_TECHNIQUE_WEIGHT),
      this.settingsService
        .getNumber(PSYCHOTECHNIQUE_WEIGHT_KEY)
        .then((v) => v ?? DEFAULT_PSYCHOTECHNIQUE_WEIGHT),
    ]);
    return {
      techniqueWeight,
      psychotechniqueWeight,
      psychotechnicalItemTypes: PSYCHOTECHNICAL_ITEM_TYPES,
    };
  }

  async listSpecialties(): Promise<SpecialtySummary[]> {
    const specialties = await this.specialtyRepo.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    return specialties.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));
  }

  // provider/externalTestId are internal (vendor) details, deliberately
  // never returned to the frontend — a candidate only needs enough to
  // start an assessment (id, duration), not which scoring vendor backs it.
  async listTests(specialtyId?: string): Promise<TestSummary[]> {
    const tests = await this.testRepo.find({
      where: {
        active: true,
        ...(specialtyId ? { specialtyId } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    return tests.map((t) => ({
      id: t.id,
      specialtyId: t.specialtyId,
      durationMinutes: t.durationMinutes,
    }));
  }
}
