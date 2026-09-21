import { Test, TestingModule } from '@nestjs/testing';
import { SavedSearchController } from '../saved-search.controller.js';
import { SavedSearchService } from '../saved-search.service.js';
import { SavedSearch } from '../entities/saved-search.entity.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('SavedSearchController', () => {
  let controller: SavedSearchController;
  let service: {
    create: jest.Mock;
    listOwn: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const recruiter: JwtPayload = {
    sub: 'recruiter-1',
    email: 'recruiter@example.com',
    roles: [Role.RECRUITER],
  };

  const sample: SavedSearch = {
    id: 'ss-1',
    ownerUserId: recruiter.sub,
    owner: undefined as never,
    name: 'Backend Casablanca',
    criteria: { q: 'node', skills: ['node'], scoreMin: 40, location: 'Casa' },
    alertEnabled: true,
    lastNotifiedAt: new Date('2026-09-20T00:00:00.000Z'),
    createdAt: new Date('2026-09-19T00:00:00.000Z'),
    updatedAt: new Date('2026-09-20T00:00:00.000Z'),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(sample),
      listOwn: jest.fn().mockResolvedValue([sample]),
      update: jest.fn().mockResolvedValue({ ...sample, name: 'Renamed' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedSearchController],
      providers: [{ provide: SavedSearchService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SavedSearchController);
  });

  it('creates a saved search owned by the authenticated user', async () => {
    const dto = { name: 'Backend Casablanca', criteria: sample.criteria };
    const result = await controller.create(recruiter, dto);

    expect(service.create).toHaveBeenCalledWith(recruiter.sub, dto);
    expect(result.id).toBe('ss-1');
    // The joined owner relation must never leak into the payload.
    expect(result).not.toHaveProperty('owner');
    expect(result).not.toHaveProperty('ownerUserId');
    expect(result.lastNotifiedAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('lists only the authenticated user own searches', async () => {
    const result = await controller.list(recruiter);
    expect(service.listOwn).toHaveBeenCalledWith(recruiter.sub);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('owner');
  });

  it('updates by owner + id and returns the serialized shape', async () => {
    const result = await controller.update(recruiter, 'ss-1', {
      name: 'Renamed',
    });
    expect(service.update).toHaveBeenCalledWith(recruiter.sub, 'ss-1', {
      name: 'Renamed',
    });
    expect(result.name).toBe('Renamed');
  });

  it('removes by owner + id', async () => {
    await controller.remove(recruiter, 'ss-1');
    expect(service.remove).toHaveBeenCalledWith(recruiter.sub, 'ss-1');
  });
});
