import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LinkVerificationService } from '../link-verification.service.js';
import {
  ProfileLink,
  LinkAccessibilityStatus,
} from '../entities/profile-link.entity.js';
import { LINK_PROBER } from '../../../ports/link-prober.port.js';

describe('LinkVerificationService (EF-CAND-04)', () => {
  let service: LinkVerificationService;
  let linkRepo: Record<string, jest.Mock>;
  let prober: { probe: jest.Mock };

  beforeEach(async () => {
    linkRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    prober = { probe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkVerificationService,
        { provide: getRepositoryToken(ProfileLink), useValue: linkRepo },
        { provide: LINK_PROBER, useValue: prober },
      ],
    }).compile();

    service = module.get(LinkVerificationService);
  });

  it('marks a reachable link REACHABLE and stamps checked_at', async () => {
    linkRepo.findOne.mockResolvedValue({ id: 'l1', url: 'https://ok.example' });
    prober.probe.mockResolvedValue({ reachable: true, statusCode: 200 });

    const status = await service.verify('l1');

    expect(prober.probe).toHaveBeenCalledWith('https://ok.example');
    expect(status).toBe(LinkAccessibilityStatus.REACHABLE);
    expect(linkRepo.update).toHaveBeenCalledWith(
      { id: 'l1' },
      expect.objectContaining({
        accessibilityStatus: LinkAccessibilityStatus.REACHABLE,
        checkedAt: expect.any(Date),
      }),
    );
  });

  it('marks an unreachable link UNREACHABLE', async () => {
    linkRepo.findOne.mockResolvedValue({
      id: 'l2',
      url: 'https://down.example',
    });
    prober.probe.mockResolvedValue({ reachable: false, reason: 'timeout' });

    const status = await service.verify('l2');

    expect(status).toBe(LinkAccessibilityStatus.UNREACHABLE);
    expect(linkRepo.update).toHaveBeenCalledWith(
      { id: 'l2' },
      expect.objectContaining({
        accessibilityStatus: LinkAccessibilityStatus.UNREACHABLE,
      }),
    );
  });

  it('is a no-op when the link was deleted before the job ran (idempotent retry)', async () => {
    linkRepo.findOne.mockResolvedValue(null);

    const status = await service.verify('gone');

    expect(status).toBeNull();
    expect(prober.probe).not.toHaveBeenCalled();
    expect(linkRepo.update).not.toHaveBeenCalled();
  });
});
