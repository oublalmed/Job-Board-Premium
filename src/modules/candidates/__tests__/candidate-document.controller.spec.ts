import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CandidateDocumentController } from '../candidate-document.controller.js';
import { CandidateDocumentService } from '../candidate-document.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';
import { DocumentType, ScanStatus } from '../entities/document.entity.js';

describe('CandidateDocumentController', () => {
  let controller: CandidateDocumentController;
  let service: Record<string, jest.Mock>;

  const authenticatedUser: JwtPayload = {
    sub: 'user-self',
    email: 'self@example.com',
    roles: [Role.CANDIDATE],
  };

  const otherUserId = 'user-other';

  const mockDocument = {
    id: 'doc-1',
    originalName: 'cv.pdf',
    mimeType: 'application/pdf',
    size: 204800,
    scanStatus: ScanStatus.CLEAN,
    createdAt: new Date('2026-05-01'),
  };

  beforeEach(async () => {
    service = {
      uploadCV: jest.fn().mockResolvedValue(mockDocument),
      getCV: jest.fn().mockResolvedValue(mockDocument),
      deleteCV: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidateDocumentController],
      providers: [{ provide: CandidateDocumentService, useValue: service }],
    }).compile();

    controller = module.get(CandidateDocumentController);
  });

  describe('uploadCV', () => {
    const mockFile = {
      buffer: Buffer.alloc(1024),
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    it('should upload CV for the authenticated user', async () => {
      const result = await controller.uploadCV(authenticatedUser, mockFile);

      expect(service.uploadCV).toHaveBeenCalledWith('user-self', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
        size: mockFile.size,
      });
      expect(result.id).toBe('doc-1');
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.uploadCV(authenticatedUser, mockFile);

      expect(service.uploadCV).not.toHaveBeenCalledWith(
        otherUserId,
        expect.anything(),
      );
      expect(service.uploadCV.mock.calls[0][0]).toBe(authenticatedUser.sub);
    });

    it('should throw BadRequestException if no file provided', async () => {
      await expect(
        controller.uploadCV(authenticatedUser, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCV', () => {
    it('should return CV info for the authenticated user', async () => {
      const result = await controller.getCV(authenticatedUser);

      expect(service.getCV).toHaveBeenCalledWith('user-self');
      expect(result.cv).toBeDefined();
      expect(result.cv.id).toBe('doc-1');
    });

    it('should return null when no CV exists', async () => {
      service.getCV.mockResolvedValue(null);

      const result = await controller.getCV(authenticatedUser);

      expect(result).toEqual({ cv: null });
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.getCV(authenticatedUser);

      expect(service.getCV).not.toHaveBeenCalledWith(otherUserId);
      expect(service.getCV.mock.calls[0][0]).toBe(authenticatedUser.sub);
    });
  });

  describe('deleteCV', () => {
    it('should delete CV for the authenticated user', async () => {
      const result = await controller.deleteCV(authenticatedUser);

      expect(service.deleteCV).toHaveBeenCalledWith('user-self');
      expect(result).toEqual({ message: 'CV deleted' });
    });

    it('should always use user.sub, never an external parameter', async () => {
      await controller.deleteCV(authenticatedUser);

      expect(service.deleteCV).not.toHaveBeenCalledWith(otherUserId);
      expect(service.deleteCV.mock.calls[0][0]).toBe(authenticatedUser.sub);
    });
  });
});
