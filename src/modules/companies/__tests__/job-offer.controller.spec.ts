import { Test, TestingModule } from '@nestjs/testing';
import { JobOfferController } from '../job-offer.controller.js';
import { JobOfferService } from '../job-offer.service.js';
import { ModerationDecision } from '../dto/moderate-job-offer.dto.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('JobOfferController', () => {
  let controller: JobOfferController;
  let service: Record<string, jest.Mock>;

  const recruiterUser: JwtPayload = {
    sub: 'recruiter-1',
    email: 'recruiter@acme.ma',
    roles: [Role.RECRUITER],
  };

  const moderatorUser: JwtPayload = {
    sub: 'moderator-1',
    email: 'moderator@jobboard.ma',
    roles: [Role.MODERATOR],
  };

  beforeEach(async () => {
    service = {
      createOffer: jest.fn().mockResolvedValue({ id: 'offer-1' }),
      listOffers: jest.fn().mockResolvedValue([{ id: 'offer-1' }]),
      closeOffer: jest
        .fn()
        .mockResolvedValue({ id: 'offer-1', status: 'closed' }),
      moderateOffer: jest
        .fn()
        .mockResolvedValue({ id: 'offer-1', status: 'published' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobOfferController],
      providers: [{ provide: JobOfferService, useValue: service }],
    }).compile();

    controller = module.get(JobOfferController);
  });

  it('createOffer delegates with the caller id', async () => {
    const dto = { title: 'Backend engineer' };
    await controller.createOffer(recruiterUser, dto);

    expect(service.createOffer).toHaveBeenCalledWith('recruiter-1', dto);
  });

  it('listOffers delegates with the caller id', async () => {
    await controller.listOffers(recruiterUser);

    expect(service.listOffers).toHaveBeenCalledWith('recruiter-1');
  });

  it('closeOffer delegates with the caller id and offer id', async () => {
    await controller.closeOffer(recruiterUser, 'offer-1');

    expect(service.closeOffer).toHaveBeenCalledWith('recruiter-1', 'offer-1');
  });

  it('moderateOffer delegates with the moderator id, offer id and decision', async () => {
    const dto = { decision: ModerationDecision.APPROVE };
    await controller.moderateOffer(moderatorUser, 'offer-1', dto);

    expect(service.moderateOffer).toHaveBeenCalledWith(
      'moderator-1',
      'offer-1',
      dto,
    );
  });
});
