import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from './entities/saved-search.entity.js';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto.js';
import { UpdateSavedSearchDto } from './dto/update-saved-search.dto.js';

// EF-SRCH-04 — CRUD for a recruiter's saved searches. Every method takes the
// authenticated owner's id (never a body value) and scopes every query by it,
// so a recruiter can only ever see or modify their own saved searches — a
// mismatched owner is indistinguishable from a missing row (404 either way).
@Injectable()
export class SavedSearchService {
  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepo: Repository<SavedSearch>,
  ) {}

  async create(
    ownerUserId: string,
    dto: CreateSavedSearchDto,
  ): Promise<SavedSearch> {
    const alertEnabled = dto.alertEnabled ?? false;
    const entity = this.savedSearchRepo.create({
      ownerUserId,
      name: dto.name,
      criteria: dto.criteria,
      alertEnabled,
      // Anchor the alert window at creation time. Without this, the first
      // sweep would treat the ENTIRE existing matching pool as "new" and
      // notify the owner about thousands of pre-existing candidates.
      lastNotifiedAt: alertEnabled ? new Date() : null,
    });
    return this.savedSearchRepo.save(entity);
  }

  async listOwn(ownerUserId: string): Promise<SavedSearch[]> {
    return this.savedSearchRepo.find({
      where: { ownerUserId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    ownerUserId: string,
    id: string,
    dto: UpdateSavedSearchDto,
  ): Promise<SavedSearch> {
    const existing = await this.findOwned(ownerUserId, id);

    if (dto.name !== undefined) existing.name = dto.name;
    if (dto.criteria !== undefined) existing.criteria = dto.criteria;
    if (dto.alertEnabled !== undefined) {
      // Turning alerts ON (from off) re-anchors the window at now(), so the
      // owner is alerted about candidates indexed AFTER they opted in, not the
      // whole back-catalogue accumulated while alerts were off.
      if (dto.alertEnabled && !existing.alertEnabled) {
        existing.lastNotifiedAt = new Date();
      }
      existing.alertEnabled = dto.alertEnabled;
    }

    return this.savedSearchRepo.save(existing);
  }

  async remove(ownerUserId: string, id: string): Promise<void> {
    // Scope the DELETE itself by owner — a foreign id affects zero rows and
    // is reported as not-found, never silently succeeding on someone else's
    // row.
    const result = await this.savedSearchRepo.delete({ id, ownerUserId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException('Saved search not found');
    }
  }

  // A single owned row or 404 — the shared guard behind update. Loading with
  // the owner in the WHERE means another recruiter's id can never be reached.
  private async findOwned(
    ownerUserId: string,
    id: string,
  ): Promise<SavedSearch> {
    const found = await this.savedSearchRepo.findOne({
      where: { id, ownerUserId },
    });
    if (!found) {
      throw new NotFoundException('Saved search not found');
    }
    return found;
  }
}
