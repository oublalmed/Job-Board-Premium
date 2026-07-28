import { Test, TestingModule } from '@nestjs/testing';
import { ShortlistController } from '../shortlist.controller.js';
import { ShortlistService } from '../shortlist.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('ShortlistController', () => {
  let controller: ShortlistController;
  let service: Record<string, jest.Mock>;

  const recruiterUser: JwtPayload = {
    sub: 'recruiter-1',
    email: 'recruiter@acme.ma',
    roles: [Role.RECRUITER],
  };

  beforeEach(async () => {
    service = {
      addEntry: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      listEntries: jest.fn().mockResolvedValue([{ id: 'entry-1' }]),
      removeEntry: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShortlistController],
      providers: [{ provide: ShortlistService, useValue: service }],
    }).compile();

    controller = module.get(ShortlistController);
  });

  it('addEntry delegates with the caller id', async () => {
    const dto = { candidateProfileId: 'profile-1' };
    await controller.addEntry(recruiterUser, dto);

    expect(service.addEntry).toHaveBeenCalledWith('recruiter-1', dto);
  });

  it('listEntries delegates with the caller id', async () => {
    await controller.listEntries(recruiterUser);

    expect(service.listEntries).toHaveBeenCalledWith('recruiter-1');
  });

  it('removeEntry delegates with the caller id and entry id', async () => {
    const result = await controller.removeEntry(recruiterUser, 'entry-1');

    expect(service.removeEntry).toHaveBeenCalledWith('recruiter-1', 'entry-1');
    expect(result).toEqual({ removed: true });
  });
});
