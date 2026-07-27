import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users.service.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('UsersService', () => {
  let service: UsersService;
  let repo: Record<string, jest.Mock>;

  const mockUser: User = {
    id: 'uuid-123',
    email: 'test@example.com',
    passwordHash: 'hash',
    roles: [Role.CANDIDATE],
    status: UserStatus.ACTIVE,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest
        .fn()
        .mockImplementation((data: any) =>
          Promise.resolve({ ...mockUser, ...data }),
        ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should find a user by email', async () => {
    repo['findOne'].mockResolvedValue(mockUser);
    const result = await service.findByEmail('test@example.com');
    expect(result).toEqual(mockUser);
    expect(repo['findOne']).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });

  it('should return null when user not found', async () => {
    repo['findOne'].mockResolvedValue(null);
    const result = await service.findByEmail('notfound@example.com');
    expect(result).toBeNull();
  });

  it('should find a user by id', async () => {
    repo['findOne'].mockResolvedValue(mockUser);
    const result = await service.findById('uuid-123');
    expect(result).toEqual(mockUser);
  });

  it('should create a user', async () => {
    const result = await service.create({
      email: 'new@test.com',
      passwordHash: 'hash',
    });
    expect(repo['create']).toHaveBeenCalled();
    expect(repo['save']).toHaveBeenCalled();
    expect(result.email).toBe('new@test.com');
  });

  it('should update a user', async () => {
    repo['findOne'].mockResolvedValue({
      ...mockUser,
      status: UserStatus.SUSPENDED,
    });
    const result = await service.update('uuid-123', {
      status: UserStatus.SUSPENDED,
    });
    expect(repo['update']).toHaveBeenCalledWith('uuid-123', {
      status: UserStatus.SUSPENDED,
    });
    expect(result?.status).toBe(UserStatus.SUSPENDED);
  });
});
