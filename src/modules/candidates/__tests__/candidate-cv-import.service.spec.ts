import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CandidateCvImportService } from '../candidate-cv-import.service.js';
import { CandidateExperienceService } from '../candidate-experience.service.js';
import { CandidateProjectService } from '../candidate-project.service.js';
import { CandidateCertificationService } from '../candidate-certification.service.js';
import { CandidateLinkService } from '../candidate-link.service.js';
import { SettingsService } from '../../settings/settings.service.js';
import { FILE_SCANNER } from '../../../ports/file-scanner.port.js';
import { OCR_PROVIDER } from '../../../ports/ocr.port.js';
import { ExperienceType } from '../entities/experience.entity.js';
import { LinkType } from '../entities/profile-link.entity.js';

const pdf = {
  buffer: Buffer.from('%PDF-1.4 ...'),
  originalname: 'cv.pdf',
  mimetype: 'application/pdf',
  size: 2048,
};

describe('CandidateCvImportService (§1)', () => {
  let service: CandidateCvImportService;
  const experienceService = { create: jest.fn().mockResolvedValue({}) };
  const projectService = { create: jest.fn().mockResolvedValue({}) };
  const certificationService = { create: jest.fn().mockResolvedValue({}) };
  const linkService = { create: jest.fn().mockResolvedValue({}) };
  const fileScanner = { scan: jest.fn().mockResolvedValue({ clean: true }) };
  const ocrProvider = {
    extractText: jest.fn().mockResolvedValue({
      text: 'Expérience\nDev chez Acme\n\nCertifications\nAWS\n\nContact github.com/jane',
      confidence: 80,
    }),
  };
  const settingsService = { getNumber: jest.fn().mockResolvedValue(null) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateCvImportService,
        { provide: CandidateExperienceService, useValue: experienceService },
        { provide: CandidateProjectService, useValue: projectService },
        {
          provide: CandidateCertificationService,
          useValue: certificationService,
        },
        { provide: CandidateLinkService, useValue: linkService },
        { provide: SettingsService, useValue: settingsService },
        { provide: FILE_SCANNER, useValue: fileScanner },
        { provide: OCR_PROVIDER, useValue: ocrProvider },
      ],
    }).compile();
    service = module.get(CandidateCvImportService);
  });

  describe('parse', () => {
    it('OCRs the CV and returns structured suggestions', async () => {
      const { suggestions } = await service.parse(pdf);
      expect(ocrProvider.extractText).toHaveBeenCalled();
      expect(
        suggestions.experiences.some((e) => e.title.includes('Acme')),
      ).toBe(true);
      expect(suggestions.certifications.map((c) => c.name)).toContain('AWS');
      expect(suggestions.links.some((l) => l.type === LinkType.GITHUB)).toBe(
        true,
      );
    });

    it('rejects an empty file', async () => {
      await expect(
        service.parse({ ...pdf, size: 0, buffer: Buffer.alloc(0) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unsupported type', async () => {
      await expect(
        service.parse({ ...pdf, mimetype: 'application/msword' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file that fails the scan', async () => {
      fileScanner.scan.mockResolvedValueOnce({ clean: false, threat: 'x' });
      await expect(service.parse(pdf)).rejects.toThrow(BadRequestException);
    });
  });

  describe('apply', () => {
    it('creates only the confirmed items and returns counts', async () => {
      const result = await service.apply('user-1', {
        experiences: [
          {
            type: ExperienceType.WORK,
            title: 'Dev',
            organization: 'Acme',
            startDate: '2022-01-01',
          },
        ],
        links: [{ type: LinkType.GITHUB, url: 'https://github.com/jane' }],
      });

      expect(experienceService.create).toHaveBeenCalledTimes(1);
      expect(experienceService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Dev' }),
      );
      expect(linkService.create).toHaveBeenCalledTimes(1);
      expect(projectService.create).not.toHaveBeenCalled();
      expect(result.created).toEqual({
        experiences: 1,
        projects: 0,
        certifications: 0,
        links: 1,
      });
    });
  });
});
