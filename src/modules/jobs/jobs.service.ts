import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOffer, JobStatus } from './entities/job-offer.entity.js';
import { JobApplication } from './entities/job-application.entity.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobSearchDto } from './dto/job-search.dto.js';

export type JobOfferWithCount = JobOffer & { applicationsCount: number };

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
  ) {}

  // ---- recruiter (§3.1) ----

  async create(
    companyId: string,
    createdBy: string,
    dto: CreateJobDto,
  ): Promise<JobOffer> {
    return this.offerRepo.save(
      this.offerRepo.create({
        companyId,
        createdBy,
        title: dto.title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        contractType: dto.contractType ?? null,
        experienceLevel: dto.experienceLevel ?? null,
        skills: dto.skills ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        status: JobStatus.DRAFT,
      }),
    );
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateJobDto,
  ): Promise<JobOffer> {
    const offer = await this.loadForCompany(id, companyId);
    if (dto.title !== undefined) offer.title = dto.title;
    if (dto.description !== undefined)
      offer.description = dto.description ?? null;
    if (dto.location !== undefined) offer.location = dto.location ?? null;
    if (dto.contractType !== undefined)
      offer.contractType = dto.contractType ?? null;
    if (dto.experienceLevel !== undefined)
      offer.experienceLevel = dto.experienceLevel ?? null;
    if (dto.skills !== undefined) offer.skills = dto.skills ?? null;
    if (dto.deadline !== undefined)
      offer.deadline = dto.deadline ? new Date(dto.deadline) : null;
    return this.offerRepo.save(offer);
  }

  async publish(companyId: string, id: string): Promise<JobOffer> {
    const offer = await this.loadForCompany(id, companyId);
    offer.status = JobStatus.PUBLISHED;
    offer.publishedAt = offer.publishedAt ?? new Date();
    return this.offerRepo.save(offer);
  }

  async close(companyId: string, id: string): Promise<JobOffer> {
    const offer = await this.loadForCompany(id, companyId);
    offer.status = JobStatus.CLOSED;
    return this.offerRepo.save(offer);
  }

  async listForCompany(companyId: string): Promise<JobOfferWithCount[]> {
    const offers = await this.offerRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    return this.withCounts(offers);
  }

  async getForCompany(
    companyId: string,
    id: string,
  ): Promise<JobOfferWithCount> {
    const offer = await this.loadForCompany(id, companyId);
    return (await this.withCounts([offer]))[0];
  }

  private async loadForCompany(
    id: string,
    companyId: string,
  ): Promise<JobOffer> {
    const offer = await this.offerRepo.findOne({ where: { id, companyId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  // ---- candidate / public (§3.2, §3.3) ----

  async searchPublished(filters: JobSearchDto): Promise<{
    items: JobOfferWithCount[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.offerRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.company', 'company')
      .where('o.status = :status', { status: JobStatus.PUBLISHED });

    if (filters.q) {
      qb.andWhere('(o.title ILIKE :q OR o.description ILIKE :q)', {
        q: `%${filters.q}%`,
      });
    }
    if (filters.location) {
      qb.andWhere('o.location ILIKE :loc', { loc: `%${filters.location}%` });
    }
    if (filters.contractType) {
      qb.andWhere('o.contract_type = :ct', { ct: filters.contractType });
    }
    if (filters.skills && filters.skills.length > 0) {
      const params: Record<string, string> = {};
      const clauses = filters.skills.map((skill, i) => {
        params[`sk${i}`] = `%${skill}%`;
        return `o.skills ILIKE :sk${i}`;
      });
      qb.andWhere(`(${clauses.join(' OR ')})`, params);
    }

    qb.orderBy('o.published_at', 'DESC')
      .addOrderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: await this.withCounts(items), total, page, limit };
  }

  async getPublished(id: string): Promise<JobOfferWithCount> {
    const offer = await this.offerRepo.findOne({
      where: { id, status: JobStatus.PUBLISHED },
      relations: { company: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return (await this.withCounts([offer]))[0];
  }

  private async withCounts(offers: JobOffer[]): Promise<JobOfferWithCount[]> {
    if (offers.length === 0) return [];
    const rows = await this.applicationRepo
      .createQueryBuilder('a')
      .select('a.job_offer_id', 'offerId')
      .addSelect('COUNT(*)', 'count')
      .where('a.job_offer_id IN (:...ids)', { ids: offers.map((o) => o.id) })
      .groupBy('a.job_offer_id')
      .getRawMany<{ offerId: string; count: string }>();
    const counts = new Map(rows.map((r) => [r.offerId, Number(r.count)]));
    return offers.map((o) => ({
      ...o,
      applicationsCount: counts.get(o.id) ?? 0,
    }));
  }
}
