import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CandidateProfileController } from '../candidate-profile.controller.js';
import { CandidateProfileService } from '../candidate-profile.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';
import { ProfileVisibility } from '../entities/candidate-profile.entity.js';

describe('CandidateProfileController', () => {
  let controller: CandidateProfileController;
  let service: Record<string, jest.Mock>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    email: 'test@example.com',
    roles: [Role.CANDIDATE],
  };

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    firstName: null,
    lastName: null,
    headline: null,
    bio: null,
    visibility: ProfileVisibility.HIDDEN,
    completeness: 0,
  };

  const mockCompleteness = {
    completeness: 0,
    isPublishable: false,
    missing: [],
  };

  beforeEach(async () => {
    service = {
      findByUserId: jest.fn(),
      createProfile: jest.fn().mockResolvedValue(mockProfile),
      updateProfile: jest.fn().mockResolvedValue(mockProfile),
      calculateCompleteness: jest.fn().mockResolvedValue(mockCompleteness),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidateProfileController],
      providers: [{ provide: CandidateProfileService, useValue: service }],
    }).compile();

    controller = module.get(CandidateProfileController);
  });

  describe('getMyProfile', () => {
    it('should return existing profile with completeness', async () => {
      service.findByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getMyProfile(mockUser);

      expect(result.profile).toEqual(mockProfile);
      expect(result.completeness).toEqual(mockCompleteness);
    });

    it('should create profile on first access', async () => {
      service.findByUserId.mockResolvedValue(null);

      await controller.getMyProfile(mockUser);

      expect(service.createProfile).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateMyProfile', () => {
    it('should update profile and return completeness', async () => {
      service.findByUserId.mockResolvedValue(mockProfile);
      const dto = { firstName: 'Ahmed', lastName: 'Benali' };

      const result = await controller.updateMyProfile(mockUser, dto);

      expect(service.updateProfile).toHaveBeenCalledWith('profile-1', dto);
      expect(result.completeness).toBeDefined();
    });

    it('should create profile if not exists before update', async () => {
      service.findByUserId.mockResolvedValue(null);

      await controller.updateMyProfile(mockUser, { firstName: 'Ahmed' });

      expect(service.createProfile).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getCompleteness', () => {
    it('should return completeness details', async () => {
      service.findByUserId.mockResolvedValue(mockProfile);

      const result = await controller.getCompleteness(mockUser);

      expect(result).toEqual(mockCompleteness);
    });

    it('should throw NotFoundException if no profile', async () => {
      service.findByUserId.mockResolvedValue(null);

      await expect(controller.getCompleteness(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
