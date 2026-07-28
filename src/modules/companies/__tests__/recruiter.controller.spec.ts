import { Test, TestingModule } from '@nestjs/testing';
import { RecruiterController } from '../recruiter.controller.js';
import { RecruiterService } from '../recruiter.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('RecruiterController', () => {
  let controller: RecruiterController;
  let service: Record<string, jest.Mock>;

  const adminUser: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@acme.ma',
    roles: [Role.COMPANY_ADMIN],
  };

  beforeEach(async () => {
    service = {
      addRecruiter: jest.fn().mockResolvedValue({ id: 'recruiter-new' }),
      listRecruiters: jest.fn().mockResolvedValue([{ id: 'r1' }]),
      removeRecruiter: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecruiterController],
      providers: [{ provide: RecruiterService, useValue: service }],
    }).compile();

    controller = module.get(RecruiterController);
  });

  it('addRecruiter delegates to the service with the caller id', async () => {
    const dto = { email: 'new@acme.ma' };

    const result = await controller.addRecruiter(adminUser, dto);

    expect(service.addRecruiter).toHaveBeenCalledWith('admin-1', dto);
    expect(result).toEqual({ id: 'recruiter-new' });
  });

  it('listRecruiters delegates to the service with the caller id', async () => {
    const result = await controller.listRecruiters(adminUser);

    expect(service.listRecruiters).toHaveBeenCalledWith('admin-1');
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('removeRecruiter delegates to the service with the caller id and target id', async () => {
    const result = await controller.removeRecruiter(
      adminUser,
      '11111111-1111-1111-1111-111111111111',
    );

    expect(service.removeRecruiter).toHaveBeenCalledWith(
      'admin-1',
      '11111111-1111-1111-1111-111111111111',
    );
    expect(result).toEqual({ removed: true });
  });
});
