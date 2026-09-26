import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../candidates/entities/candidate-profile.entity.js';
import { ProfileSkill } from '../candidates/entities/profile-skill.entity.js';
import { Skill } from '../candidates/entities/skill.entity.js';
import {
  Experience,
  ExperienceType,
} from '../candidates/entities/experience.entity.js';
import { Project } from '../candidates/entities/project.entity.js';
import { Certification } from '../candidates/entities/certification.entity.js';
import { ProfileLink } from '../candidates/entities/profile-link.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../candidates/entities/document.entity.js';
import type { ObjectStorage } from '../../ports/object-storage.port.js';
import { OBJECT_STORAGE } from '../../ports/object-storage.port.js';
import {
  Score,
  PlagiarismVerdict,
} from '../assessments/entities/score.entity.js';
import {
  Assessment,
  AssessmentStatus,
} from '../assessments/entities/assessment.entity.js';
import { Conversation } from '../messaging/entities/conversation.entity.js';
import { SearchCandidatesDto } from './dto/search-candidates.dto.js';
import type {
  CandidateSearchResultDto,
  SearchCandidatesResult,
} from './dto/candidate-search-result.dto.js';

// EF-SRCH-05 — who is viewing a candidate detail, and whether they have earned
// the full-identity reveal (admin, or a recruiter who already contacted the
// candidate — i.e. a conversation exists between their company and the
// candidate).
export interface CandidateDetailViewer {
  isAdmin?: boolean;
  companyId?: string;
}

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
  assessmentCount: string | null;
}

// EF-SRCH-05 — reduce a last name to an initial for the anonymised search
// preview ("El Amrani" -> "E."). Null/blank stays null so the UI shows no
// spurious placeholder.
export function anonymizeLastName(lastName: string | null): string | null {
  const trimmed = lastName?.trim();
  if (!trimmed) {
    return null;
  }
  return `${trimmed.charAt(0).toUpperCase()}.`;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(ProfileSkill)
    private readonly profileSkillRepo: Repository<ProfileSkill>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Experience)
    private readonly experienceRepo: Repository<Experience>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Certification)
    private readonly certificationRepo: Repository<Certification>,
    @InjectRepository(ProfileLink)
    private readonly profileLinkRepo: Repository<ProfileLink>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
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

    // EF-SRCH-05 — anonymised preview: the list only ever exposes the first
    // name + last initial. Full identity is revealed on the candidate detail
    // (getCandidateDetail), the point at which a recruiter has singled a
    // candidate out. This narrows PII exposure of the browsable index without
    // hiding the signal a recruiter searches on (skills, score, headline).
    const items: CandidateSearchResultDto[] = page.map((profile, i) => ({
      id: profile.id,
      firstName: profile.firstName,
      lastName: anonymizeLastName(profile.lastName),
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
      school: profile.school,
      schoolVerified: profile.schoolVerified,
      assessmentCount: Number(rawPage[i]?.assessmentCount ?? 0),
      anonymized: true,
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
  async getCandidateDetail(
    id: string,
    viewer: CandidateDetailViewer = {},
  ): Promise<CandidateSearchResultDto> {
    const qb = this.profileRepo
      .createQueryBuilder('profile')
      .leftJoin(
        (sub) => this.bestScoreSubQuery(sub),
        'best_score',
        'best_score.candidate_id = profile.userId',
      )
      .leftJoin(
        (sub) => this.assessmentCountSubQuery(sub),
        'assess_count',
        'assess_count.candidate_id = profile.userId',
      )
      .addSelect('best_score.best_value', 'bestScoreValue')
      .addSelect('best_score.best_percentile', 'bestScorePercentile')
      .addSelect('COALESCE(assess_count.assessment_count, 0)', 'assessmentCount')
      .where('profile.id = :id', { id })
      .andWhere('profile.indexedInCvtheque = true')
      // EF-ADM-01 — an admin-suspended profile is never reachable, whatever the
      // candidate's own visibility says.
      .andWhere('profile.moderationStatus = :modActive', { modActive: 'active' })
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

    // EF-SRCH-05 — full identity is revealed only to a viewer who has earned it:
    // an admin, or a recruiter whose company already contacted this candidate
    // (a conversation exists). Otherwise the detail keeps the anonymized
    // preview (first name + last initial), same as the list.
    const identityRevealed =
      viewer.isAdmin === true ||
      (viewer.companyId !== undefined &&
        (await this.hasContact(viewer.companyId, profile.id)));

    // EF-CAND-07 — the "proof of work" sections a recruiter evaluates: work &
    // education history, projects delivered and certifications earned. These
    // carry no direct contact PII, so they are shown even in the anonymized
    // preview (like skills and score) — they are the differentiators the user
    // asked to surface on the profile.
    const [experiences, projects, certifications] = await Promise.all([
      this.experienceRepo.find({
        where: { profileId: profile.id },
        order: { startDate: 'DESC' },
      }),
      this.projectRepo.find({
        where: { profileId: profile.id },
        order: { startDate: 'DESC', createdAt: 'DESC' },
      }),
      this.certificationRepo.find({
        where: { profileId: profile.id },
        order: { issueDate: 'DESC' },
      }),
    ]);

    // Personal links and the downloadable CV both expose identifying details,
    // so they are gated behind the identity reveal.
    const cv = identityRevealed ? await this.loadCvDownload(profile.userId) : null;
    const links = identityRevealed
      ? await this.profileLinkRepo.find({ where: { profileId: profile.id } })
      : [];

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: identityRevealed
        ? profile.lastName
        : anonymizeLastName(profile.lastName),
      anonymized: identityRevealed ? undefined : true,
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
      school: profile.school,
      schoolVerified: profile.schoolVerified,
      assessmentCount: Number(raw[0]?.assessmentCount ?? 0),
      // EF-CAND-05 — availability/mobility always shown; the salary range is
      // withheld (masked) unless the candidate chose to expose it.
      availability: profile.availability,
      mobility: profile.mobility,
      salaryMin: profile.salaryVisible ? profile.salaryMin : null,
      salaryMax: profile.salaryVisible ? profile.salaryMax : null,
      salaryCurrency: profile.salaryVisible ? profile.salaryCurrency : null,
      bio: profile.bio,
      experiences: experiences.map((e) => ({
        type: e.type === ExperienceType.EDUCATION ? 'education' : 'work',
        title: e.title,
        organization: e.organization,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
      projects: projects.map((p) => ({
        title: p.title,
        description: p.description,
        url: p.url,
        role: p.role,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
      certifications: certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
        issueDate: c.issueDate,
        expiryDate: c.expiryDate,
        credentialUrl: c.credentialUrl,
      })),
      links: links.map((l) => ({ type: l.type, url: l.url, label: l.label })),
      cv,
    };
  }

  // The candidate's uploaded CV, as a short-lived signed download URL. Only a
  // clean-scanned CV is ever handed to a recruiter — a pending/infected file is
  // treated as absent. Returns null when there is no downloadable CV.
  private async loadCvDownload(
    candidateUserId: string,
  ): Promise<{
    originalName: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
  } | null> {
    const doc = await this.documentRepo.findOne({
      where: { ownerId: candidateUserId, type: DocumentType.CV },
    });
    if (!doc || doc.scanStatus !== ScanStatus.CLEAN) {
      return null;
    }
    const downloadUrl = await this.objectStorage.getSignedUrl(doc.storageKey, 600);
    return {
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      downloadUrl,
    };
  }

  // EF-SRCH-05 — a company has "contacted" a candidate once a conversation
  // exists between them (the same unique (candidate, company) pair that
  // consuming a contact opens). Owner-scoped to the viewer's company.
  // Conversation.candidateId is the candidate *profile* id (FK to
  // CandidateProfile), so this must be matched against profile.id — matching
  // against the user id would never find the thread and the CV/identity would
  // stay locked even after contact.
  private async hasContact(
    companyId: string,
    candidateProfileId: string,
  ): Promise<boolean> {
    const count = await this.conversationRepo.count({
      where: { companyId, candidateId: candidateProfileId },
    });
    return count > 0;
  }

  // EF-SRCH-04 — the saved-search alert sweep asks "how many candidates match
  // this saved criteria that became visible since `since`?". It reuses the
  // exact same filter + visibility predicates as the recruiter-facing search
  // (buildQuery), so a masked/non-indexed profile can never be counted here
  // either — only the freshness window (`profile.updatedAt > since`, i.e.
  // newly indexed/updated into the CVthèque) is added. A null `since` (a
  // saved search that has never alerted) counts every current match.
  async countNewMatches(
    filters: SearchCandidatesDto,
    since: Date | null,
  ): Promise<number> {
    const qb = this.buildQuery(filters);
    if (since) {
      qb.andWhere('profile.updatedAt > :since', { since });
    }
    return qb.getCount();
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
      .leftJoin(
        (sub) => this.assessmentCountSubQuery(sub),
        'assess_count',
        'assess_count.candidate_id = profile.userId',
      )
      .addSelect('best_score.best_value', 'bestScoreValue')
      .addSelect('best_score.best_percentile', 'bestScorePercentile')
      .addSelect('COALESCE(best_score.best_value, 0)', 'sortScore')
      .addSelect('COALESCE(assess_count.assessment_count, 0)', 'assessmentCount')
      .where('profile.indexedInCvtheque = true')
      // EF-ADM-01 — admin-suspended profiles never appear in the CVthèque.
      .andWhere('profile.moderationStatus = :modActive', { modActive: 'active' })
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

    // EF-SRCH-02 — availability substring filter.
    if (filters.availability) {
      qb.andWhere('profile.availability ILIKE :availability', {
        availability: `%${filters.availability}%`,
      });
    }

    // EF-SRCH-02 — salary budget: only candidates who disclosed a range
    // (salaryVisible) whose minimum expectation fits the recruiter's budget.
    if (filters.salaryMax !== undefined) {
      qb.andWhere(
        'profile.salaryVisible = true AND profile.salaryMin IS NOT NULL AND profile.salaryMin <= :salaryMax',
        { salaryMax: filters.salaryMax },
      );
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

  // Count of completed evaluations per candidate — a "how proven is this
  // candidate" signal surfaced in the CVthèque alongside the best score.
  private assessmentCountSubQuery(qb: SelectQueryBuilder<any>) {
    return qb
      .subQuery()
      .select('assessment.candidateId', 'candidate_id')
      .addSelect('COUNT(*)', 'assessment_count')
      .from(Assessment, 'assessment')
      .where('assessment.status = :acCompleted', {
        acCompleted: AssessmentStatus.COMPLETED,
      })
      .groupBy('assessment.candidateId');
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
