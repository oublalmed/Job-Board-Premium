import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SchoolVerificationService } from '../school-verification.service.js';
import {
  SchoolVerification,
  SchoolVerificationStatus,
} from '../entities/school-verification.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../../candidates/entities/document.entity.js';
import { FILE_SCANNER } from '../../../ports/file-scanner.port.js';
import { OBJECT_STORAGE } from '../../../ports/object-storage.port.js';
import { OCR_PROVIDER } from '../../../ports/ocr.port.js';
import { SettingsService } from '../../settings/settings.service.js';

function createMockUpdateQueryBuilder(
  affected: number,
): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['update', 'set', 'where', 'andWhere']) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.execute = jest.fn().mockResolvedValue({ affected });
  return qb;
}

describe('SchoolVerificationService', () => {
  let service: SchoolVerificationService;
  let verificationRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let documentRepo: Record<string, jest.Mock>;
  let fileScanner: Record<string, jest.Mock>;
  let objectStorage: Record<string, jest.Mock>;
  let ocrProvider: Record<string, jest.Mock>;
  let settingsService: Record<string, jest.Mock>;
  let verificationUpdateQb: Record<string, jest.Mock>;
  let profileUpdateQb: Record<string, jest.Mock>;

  const userId = 'user-1';
  const profileId = 'profile-1';

  const validFile = {
    buffer: Buffer.from('fake-pdf-bytes'),
    originalname: 'diplome.pdf',
    mimetype: 'application/pdf',
    size: 1024,
  };

  beforeEach(async () => {
    verificationUpdateQb = createMockUpdateQueryBuilder(1);
    profileUpdateQb = createMockUpdateQueryBuilder(1);

    verificationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest
        .fn()
        .mockImplementation((e: any) =>
          Promise.resolve({ id: 'verification-1', ...e }),
        ),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(verificationUpdateQb),
      findOneOrFail: jest.fn(),
    };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: profileId, userId }),
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      createQueryBuilder: jest.fn().mockReturnValue(profileUpdateQb),
    };
    documentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest
        .fn()
        .mockImplementation((e: any) =>
          Promise.resolve({ id: 'document-1', ...e }),
        ),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    fileScanner = { scan: jest.fn().mockResolvedValue({ clean: true }) };
    objectStorage = {
      upload: jest.fn().mockResolvedValue({ key: 'k', url: 'u' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/x'),
    };
    ocrProvider = {
      extractText: jest.fn().mockResolvedValue({
        text: 'ENSIAS - Rabat',
        confidence: 88,
      }),
    };
    settingsService = {
      get: jest.fn().mockResolvedValue(null),
      getNumber: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolVerificationService,
        {
          provide: getRepositoryToken(SchoolVerification),
          useValue: verificationRepo,
        },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: FILE_SCANNER, useValue: fileScanner },
        { provide: OBJECT_STORAGE, useValue: objectStorage },
        { provide: OCR_PROVIDER, useValue: ocrProvider },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get(SchoolVerificationService);
  });

  describe('submit', () => {
    it('rejects an empty file', async () => {
      await expect(
        service.submit(userId, {
          ...validFile,
          size: 0,
          buffer: Buffer.alloc(0),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file over the max size', async () => {
      settingsService.getNumber.mockResolvedValue(100);
      await expect(
        service.submit(userId, { ...validFile, size: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a disallowed mime type', async () => {
      await expect(
        service.submit(userId, { ...validFile, mimetype: 'application/exe' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file that fails the scan', async () => {
      fileScanner.scan.mockResolvedValue({ clean: false, threat: 'eicar' });
      await expect(service.submit(userId, validFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('extracts text via OCR, matches a grande école, and creates a pending verification', async () => {
      const result = await service.submit(userId, validFile);

      expect(fileScanner.scan).toHaveBeenCalledWith(
        validFile.buffer,
        validFile.originalname,
      );
      expect(objectStorage.upload).toHaveBeenCalled();
      expect(ocrProvider.extractText).toHaveBeenCalledWith(
        validFile.buffer,
        validFile.mimetype,
      );
      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DocumentType.DIPLOMA,
          scanStatus: ScanStatus.CLEAN,
        }),
      );
      expect(result.status).toBe(SchoolVerificationStatus.PENDING);
      expect(result.matchedSchool).toBe('ENSIAS');
      expect(result.confidence).toBe(88);
    });

    it('leaves matchedSchool null when OCR text matches no known school', async () => {
      ocrProvider.extractText.mockResolvedValue({
        text: 'Universite privee non reconnue',
        confidence: 70,
      });

      const result = await service.submit(userId, validFile);

      expect(result.matchedSchool).toBeNull();
    });

    it('creates a candidate profile on first submission if none exists yet', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await service.submit(userId, validFile);

      expect(profileRepo.create).toHaveBeenCalledWith({ userId });
      expect(profileRepo.save).toHaveBeenCalled();
    });

    it('replaces a previous verification and its document on re-submission', async () => {
      const oldVerification = {
        id: 'verification-old',
        candidateProfileId: profileId,
        documentId: 'document-old',
      };
      const oldDocument = { id: 'document-old', storageKey: 'diploma/old-key' };
      verificationRepo.findOne.mockResolvedValue(oldVerification);
      documentRepo.findOne.mockResolvedValue(oldDocument);

      await service.submit(userId, validFile);

      expect(verificationRepo.remove).toHaveBeenCalledWith(oldVerification);
      expect(objectStorage.delete).toHaveBeenCalledWith(oldDocument.storageKey);
      expect(documentRepo.remove).toHaveBeenCalledWith(oldDocument);
    });
  });

  describe('getMine', () => {
    it('returns null when the candidate has no profile yet', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      expect(await service.getMine(userId)).toBeNull();
    });

    it('returns null when the profile has no verification', async () => {
      verificationRepo.findOne.mockResolvedValue(null);
      expect(await service.getMine(userId)).toBeNull();
    });

    it("scopes the lookup to the caller's own candidate profile id", async () => {
      verificationRepo.findOne.mockResolvedValue({
        id: 'v1',
        candidateProfileId: profileId,
      });
      await service.getMine(userId);
      expect(verificationRepo.findOne).toHaveBeenCalledWith({
        where: { candidateProfileId: profileId },
      });
    });
  });

  describe('listPending', () => {
    it('queries only PENDING status', async () => {
      await service.listPending();
      expect(verificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: SchoolVerificationStatus.PENDING },
        }),
      );
    });
  });

  describe('approve / reject — atomic review claim', () => {
    const pendingVerification = {
      id: 'verification-1',
      candidateProfileId: profileId,
      matchedSchool: 'ENSIAS',
      status: SchoolVerificationStatus.PENDING,
    };

    beforeEach(() => {
      verificationRepo.findOneOrFail.mockResolvedValue({
        ...pendingVerification,
        status: SchoolVerificationStatus.VERIFIED,
      });
    });

    it('approve() marks the profile verified and canonicalizes the school name', async () => {
      await service.approve('verification-1', 'admin-1', 'looks good');

      expect(verificationUpdateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SchoolVerificationStatus.VERIFIED,
          reviewedBy: 'admin-1',
          reviewNote: 'looks good',
        }),
      );
      expect(profileUpdateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ schoolVerified: true, school: 'ENSIAS' }),
      );
    });

    it('reject() does not touch the candidate profile', async () => {
      verificationRepo.findOneOrFail.mockResolvedValue({
        ...pendingVerification,
        status: SchoolVerificationStatus.REJECTED,
      });

      await service.reject('verification-1', 'admin-1', 'not a real diploma');

      expect(profileUpdateQb.set).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the submission was already reviewed', async () => {
      verificationUpdateQb.execute.mockResolvedValue({ affected: 0 });
      verificationRepo.findOne.mockResolvedValue({
        ...pendingVerification,
        status: SchoolVerificationStatus.VERIFIED,
      });

      await expect(
        service.approve('verification-1', 'admin-1', undefined),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the submission does not exist', async () => {
      verificationUpdateQb.execute.mockResolvedValue({ affected: 0 });
      verificationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve('missing-id', 'admin-1', undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('the same submission cannot be approved by two concurrent reviewers (second claim loses)', async () => {
      // First call wins the atomic UPDATE, second call's WHERE matches
      // zero rows because status is no longer 'pending'.
      verificationUpdateQb.execute
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 });
      verificationRepo.findOne.mockResolvedValue({
        ...pendingVerification,
        status: SchoolVerificationStatus.VERIFIED,
      });

      const [first, second] = await Promise.allSettled([
        service.approve('verification-1', 'admin-1', undefined),
        service.approve('verification-1', 'admin-2', undefined),
      ]);

      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
      if (second.status === 'rejected') {
        expect(second.reason).toBeInstanceOf(ConflictException);
      }
    });
  });
});
