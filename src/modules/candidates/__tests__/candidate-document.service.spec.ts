import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CandidateDocumentService } from '../candidate-document.service.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../entities/document.entity.js';
import { CandidateProfile } from '../entities/candidate-profile.entity.js';
import { FILE_SCANNER } from '../../../ports/file-scanner.port.js';
import { OBJECT_STORAGE } from '../../../ports/object-storage.port.js';
import { SettingsService } from '../../settings/settings.service.js';
import { CandidateProfileService } from '../candidate-profile.service.js';

describe('CandidateDocumentService', () => {
  let service: CandidateDocumentService;
  let documentRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let fileScanner: Record<string, jest.Mock>;
  let objectStorage: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let profileService: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profileId = 'profile-1';

  beforeEach(async () => {
    documentRepo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest
        .fn()
        .mockImplementation((e: any) =>
          Promise.resolve({ id: 'doc-1', createdAt: new Date(), ...e }),
        ),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: profileId, userId }),
    };
    fileScanner = {
      scan: jest.fn().mockResolvedValue({ clean: true }),
    };
    objectStorage = {
      upload: jest.fn().mockResolvedValue({
        key: 'cv/user-1/file.pdf',
        url: 'https://store/cv/user-1/file.pdf',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    settingsService = {
      getNumber: jest.fn().mockImplementation((key: string) => {
        if (key === 'cv_max_size_bytes')
          return Promise.resolve(5 * 1024 * 1024);
        return Promise.resolve(null);
      }),
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'cv_allowed_mime_types')
          return Promise.resolve(
            'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          );
        return Promise.resolve(null);
      }),
    };
    profileService = {
      calculateCompleteness: jest.fn().mockResolvedValue({
        completeness: 15,
        isPublishable: false,
        missing: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateDocumentService,
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: FILE_SCANNER, useValue: fileScanner },
        { provide: OBJECT_STORAGE, useValue: objectStorage },
        { provide: SettingsService, useValue: settingsService },
        { provide: CandidateProfileService, useValue: profileService },
      ],
    }).compile();

    service = module.get(CandidateDocumentService);
  });

  const validFile = {
    buffer: Buffer.alloc(3 * 1024 * 1024),
    originalname: 'cv.pdf',
    mimetype: 'application/pdf',
    size: 3 * 1024 * 1024,
  };

  describe('uploadCV — nominal scenario', () => {
    it('should scan, store, and create document for valid PDF', async () => {
      const result = await service.uploadCV(userId, validFile);

      expect(fileScanner.scan).toHaveBeenCalledWith(validFile.buffer, 'cv.pdf');
      expect(objectStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining(`cv/${userId}/`),
          body: validFile.buffer,
          contentType: 'application/pdf',
        }),
      );
      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: userId,
          type: DocumentType.CV,
          scanStatus: ScanStatus.CLEAN,
          mimeType: 'application/pdf',
        }),
      );
      expect(result.id).toBe('doc-1');
    });

    it('should accept DOCX files', async () => {
      const docxFile = {
        ...validFile,
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      await service.uploadCV(userId, docxFile);

      expect(objectStorage.upload).toHaveBeenCalled();
      expect(documentRepo.save).toHaveBeenCalled();
    });

    it('should recalculate completeness after upload', async () => {
      await service.uploadCV(userId, validFile);

      expect(profileService.calculateCompleteness).toHaveBeenCalledWith(
        profileId,
      );
    });
  });

  describe('uploadCV — rejection scenarios', () => {
    it('should reject file exceeding 5 Mo', async () => {
      const largeFile = {
        ...validFile,
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(6 * 1024 * 1024),
      };

      await expect(service.uploadCV(userId, largeFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadCV(userId, largeFile)).rejects.toThrow(
        /5.*Mo/i,
      );
      expect(objectStorage.upload).not.toHaveBeenCalled();
    });

    it('should reject non-PDF/DOCX file type', async () => {
      const imageFile = {
        ...validFile,
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
      };

      await expect(service.uploadCV(userId, imageFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadCV(userId, imageFile)).rejects.toThrow(
        /type/i,
      );
      expect(fileScanner.scan).not.toHaveBeenCalled();
    });

    it('should reject infected file after scan', async () => {
      fileScanner.scan.mockResolvedValue({
        clean: false,
        threat: 'Trojan.Test',
      });

      await expect(service.uploadCV(userId, validFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadCV(userId, validFile)).rejects.toThrow(
        /infect|menace|threat/i,
      );
      expect(objectStorage.upload).not.toHaveBeenCalled();
      expect(documentRepo.save).not.toHaveBeenCalled();
    });

    it('should reject with explicit message for empty file', async () => {
      const emptyFile = {
        ...validFile,
        size: 0,
        buffer: Buffer.alloc(0),
      };

      await expect(service.uploadCV(userId, emptyFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadCV — replaces previous CV', () => {
    it('should delete old CV before storing new one', async () => {
      const oldDoc = {
        id: 'old-doc',
        storageKey: 'cv/user-1/old.pdf',
        ownerId: userId,
        type: DocumentType.CV,
      };
      documentRepo.findOne.mockResolvedValue(oldDoc);

      await service.uploadCV(userId, validFile);

      expect(objectStorage.delete).toHaveBeenCalledWith('cv/user-1/old.pdf');
      expect(documentRepo.remove).toHaveBeenCalledWith(oldDoc);
    });
  });
});
