import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../candidates/entities/candidate-profile.entity.js';
import { ProfileSkill } from '../candidates/entities/profile-skill.entity.js';
import { Skill } from '../candidates/entities/skill.entity.js';
import {
  Score,
  PlagiarismVerdict,
} from '../assessments/entities/score.entity.js';
import {
  Assessment,
  AssessmentStatus,
} from '../assessments/entities/assessment.entity.js';
import { SearchCandidatesDto } from './dto/search-candidates.dto.js';
import type {
  CandidateSearchResultDto,
  SearchCandidatesResult,
} from './dto/candidate-search-result.dto.js';

interface CursorPayload {
  score: number;
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as CursorPayload;
    if (typeof decoded.score !== 'number' || typeof decoded.id !== 'string') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

interface RawScoreRow {
  bestScoreValue: string | null;
  bestScorePercentile: string | null;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(ProfileSkill)
    private readonly profileSkillRepo: Repository<ProfileSkill>,
  ) {}

  async searchCandidates(
    filters: SearchCandidatesDto,
  ): Promise<SearchCandidatesResult> {
    const limit = filters.limit ?? 20;
    const qb = this.buildQuery(filters);

    // TypeORM's ORDER BY + getRawAndEntities() combination chokes on a raw
    // function-call expression here ("COALESCE(best_score" alias was not
    // found) — ordering by the already-selected plain alias avoids it.
    qb.orderBy('"sortScore"', 'DESC').addOrderBy('profile.id', 'DESC');
    // .take() wraps the query in a "DISTINCT ... FROM (...)" subquery to
    // stay correct under one-to-many joins — our best_score join is 1:1
    // (GROUP BY candidate_id), so that wrapping isn't needed, and it
    // currently emits malformed SQL for this ORDER BY shape. .limit() is a
    // plain SQL LIMIT and is safe given the join is 1:1.
    qb.limit(limit + 1);

    const { entities, raw } = await qb.getRawAndEntities<RawScoreRow>();

    const hasMore = entities.length > limit;
    const page = hasMore ? entities.slice(0, limit) : entities;
    const rawPage = hasMore ? raw.slice(0, limit) : raw;

    const skillsByProfile = await this.loadSkills(page.map((p) => p.id));

    const items: CandidateSearchResultDto[] = page.map((profile, i) => ({
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline,
      location: profile.location,
      skills: skillsByProfile.get(profile.id) ?? [],
      score: Number(rawPage[i]?.bestScoreValue ?? 0),
      percentile:
        rawPage[i]?.bestScorePercentile !== null &&
        rawPage[i]?.bestScorePercentile !== undefined
          ? Number(rawPage[i].bestScorePercentile)
          : null,
      featured: profile.featured,
    }));

    let nextCursor: string | null = null;
    if (hasMore) {
      const lastIndex = page.length - 1;
      nextCursor = encodeCursor({
        score: Number(rawPage[lastIndex]?.bestScoreValue ?? 0),
        id: page[lastIndex].id,
      });
    }

    return { items, nextCursor };
  }

  // EF-GROW-04 — a single candidate's detail, gated by the exact same
  // visibility rule as the list (indexedInCvtheque + PUBLIC/RECRUITERS_ONLY):
  // never more reachable than what would already show up in a search, and
  // a hidden/nonexistent profile are indistinguishable (404 either way —
  // ADR-0001, same reasoning as EF-SRCH-03's list-side filter).
  async getCandidateDetail(id: string): Promise<CandidateSearchResultDto> {
    const qb = this.profileRepo
      .createQueryBuilder('profile')
      .leftJoin(
        (sub) => this.bestScoreSubQuery(sub),
        'best_score',
        'best_score.candidate_id = profile.userId',
      )
      .addSelect('best_score.best_value', 'bestScoreValue')
      .addSelect('best_score.best_percentile', 'bestScorePercentile')
      .where('profile.id = :id', { id })
      .andWhere('profile.indexedInCvtheque = true')
      .andWhere('profile.visibility IN (:...visibilities)', {
        visibilities: [
          ProfileVisibility.PUBLIC,
          ProfileVisibility.RECRUITERS_ONLY,
        ],
      });

    const { entities, raw } = await qb.getRawAndEntities<RawScoreRow>();
    if (entities.length === 0) {
      throw new NotFoundException('Candidate profile not found');
    }

    const profile = entities[0];
    const skillsByProfile = await this.loadSkills([profile.id]);

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline,
      location: profile.location,
      skills: skillsByProfile.get(profile.id) ?? [],
      score: Number(raw[0]?.bestScoreValue ?? 0),
      percentile:
        raw[0]?.bestScorePercentile !== null &&
        raw[0]?.bestScorePercentile !== undefined
          ? Number(raw[0].bestScorePercentile)
          : null,
      featured: profile.featured,
    };
  }

  private buildQuery(
    filters: SearchCandidatesDto,
  ): SelectQueryBuilder<CandidateProfile> {
    const qb = this.profileRepo
      .createQueryBuilder('profile')
      .leftJoin(
        (sub) => this.bestScoreSubQuery(sub),
        'best_score',
        'best_score.candidate_id = profile.userId',
      )
      .addSelect('best_score.best_value', 'bestScoreValue')
      .addSelect('best_score.best_percentile', 'bestScorePercentile')
      .addSelect('COALESCE(best_score.best_value, 0)', 'sortScore')
      .where('profile.indexedInCvtheque = true')
      .andWhere('profile.visibility IN (:...visibilities)', {
        visibilities: [
          ProfileVisibility.PUBLIC,
          ProfileVisibility.RECRUITERS_ONLY,
        ],
      });

    if (filters.q) {
      qb.andWhere(
        `to_tsvector('french', coalesce(profile.headline, '') || ' ' || coalesce(profile.bio, '')) @@ plainto_tsquery('french', :q)`,
        { q: filters.q },
      );
    }

    if (filters.skills && filters.skills.length > 0) {
      const skillExists = this.profileSkillRepo
        .createQueryBuilder('ps')
        .select('1')
        .innerJoin(Skill, 'sk', 'sk.id = ps.skillId')
        .where('ps.profileId = profile.id')
        .andWhere('sk.name IN (:...skillNames)')
        .getQuery();
      qb.andWhere(`EXISTS (${skillExists})`, {
        skillNames: filters.skills,
      });
    }

    if (filters.scoreMin !== undefined) {
      qb.andWhere('COALESCE(best_score.best_value, 0) >= :scoreMin', {
        scoreMin: filters.scoreMin,
      });
    }

    if (filters.location) {
      qb.andWhere('profile.location ILIKE :location', {
        location: `%${filters.location}%`,
      });
    }

    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      if (decoded) {
        qb.andWhere(
          '(COALESCE(best_score.best_value, 0) < :cursorScore) OR (COALESCE(best_score.best_value, 0) = :cursorScore AND profile.id < :cursorId)',
          { cursorScore: decoded.score, cursorId: decoded.id },
        );
      }
    }

    return qb;
  }

  private bestScoreSubQuery(qb: SelectQueryBuilder<any>) {
    return qb
      .subQuery()
      .select('assessment.candidateId', 'candidate_id')
      .addSelect('MAX(score.value)', 'best_value')
      .addSelect('MAX(score.percentile)', 'best_percentile')
      .from(Score, 'score')
      .innerJoin(Assessment, 'assessment', 'assessment.id = score.assessmentId')
      .where('assessment.status = :completedStatus', {
        completedStatus: AssessmentStatus.COMPLETED,
      })
      .andWhere('score.plagiarismVerdict != :confirmedVerdict', {
        confirmedVerdict: PlagiarismVerdict.CONFIRMED,
      })
      .andWhere('score.expiresAt > :now', { now: new Date() })
      .groupBy('assessment.candidateId');
  }

  private async loadSkills(
    profileIds: string[],
  ): Promise<Map<string, string[]>> {
    if (profileIds.length === 0) return new Map();

    const rows = await this.profileSkillRepo
      .createQueryBuilder('ps')
      .innerJoin('ps.skill', 'skill')
      .where('ps.profileId IN (:...profileIds)', { profileIds })
      .select(['ps.profileId AS "profileId"', 'skill.name AS "name"'])
      .getRawMany<{ profileId: string; name: string }>();

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.profileId) ?? [];
      list.push(row.name);
      map.set(row.profileId, list);
    }
    return map;
  }
}
