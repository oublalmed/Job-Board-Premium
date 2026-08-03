import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from './entities/specialty.entity.js';
import { Test } from './entities/test.entity.js';

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

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
    @InjectRepository(Test)
    private readonly testRepo: Repository<Test>,
  ) {}

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
