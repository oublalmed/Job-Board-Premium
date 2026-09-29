import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { FileScanner } from '../../ports/file-scanner.port.js';
import { FILE_SCANNER } from '../../ports/file-scanner.port.js';
import type { OcrProvider } from '../../ports/ocr.port.js';
import { OCR_PROVIDER } from '../../ports/ocr.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { parseCvText, type CvSuggestions } from './cv-parsing.js';
import { CandidateExperienceService } from './candidate-experience.service.js';
import { CandidateProjectService } from './candidate-project.service.js';
import { CandidateCertificationService } from './candidate-certification.service.js';
import { CandidateLinkService } from './candidate-link.service.js';
import type { ApplyCvImportDto } from './dto/apply-cv-import.dto.js';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const DEFAULT_MAX_SIZE = 8 * 1024 * 1024;
// The OCR provider understands PDFs (pdf-parse) and images (tesseract). DOCX
// isn't OCR-able here, so CV *parsing* accepts only these — independent of what
// CV *storage* allows.
const PARSE_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

export interface CvImportResult {
  created: {
    experiences: number;
    projects: number;
    certifications: number;
    links: number;
  };
}

// §1 — parse an uploaded CV into profile suggestions (never saved on its own),
// then apply the candidate-reviewed subset to their profile.
@Injectable()
export class CandidateCvImportService {
  private readonly logger = new Logger(CandidateCvImportService.name);

  constructor(
    @Inject(FILE_SCANNER) private readonly fileScanner: FileScanner,
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
    private readonly settingsService: SettingsService,
    private readonly experienceService: CandidateExperienceService,
    private readonly projectService: CandidateProjectService,
    private readonly certificationService: CandidateCertificationService,
    private readonly linkService: CandidateLinkService,
  ) {}

  async parse(file: UploadedFile): Promise<{ suggestions: CvSuggestions }> {
    if (!file.size || file.buffer.length === 0) {
      throw new BadRequestException('Le fichier est vide');
    }
    const maxSize =
      (await this.settingsService.getNumber('cv_max_size_bytes')) ??
      DEFAULT_MAX_SIZE;
    if (file.size > maxSize) {
      const maxMo = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `Le fichier dépasse la taille maximale de ${maxMo} Mo`,
      );
    }
    if (!PARSE_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Type non pris en charge pour l’analyse. Formats acceptés : PDF, JPEG, PNG',
      );
    }
    const scan = await this.fileScanner.scan(file.buffer, file.originalname);
    if (!scan.clean) {
      throw new BadRequestException(
        `Fichier rejeté : menace détectée (${scan.threat ?? 'threat detected'})`,
      );
    }

    const ocr = await this.ocrProvider.extractText(file.buffer, file.mimetype);
    const suggestions = parseCvText(ocr.text);
    this.logger.log(
      `CV parsed: ${suggestions.experiences.length} exp, ${suggestions.projects.length} proj, ${suggestions.certifications.length} cert, ${suggestions.links.length} links`,
    );
    return { suggestions };
  }

  // Persist only what the candidate confirmed (already validated by the DTO).
  async apply(userId: string, dto: ApplyCvImportDto): Promise<CvImportResult> {
    let experiences = 0;
    let projects = 0;
    let certifications = 0;
    let links = 0;

    for (const e of dto.experiences ?? []) {
      await this.experienceService.create(userId, e);
      experiences++;
    }
    for (const p of dto.projects ?? []) {
      await this.projectService.create(userId, p);
      projects++;
    }
    for (const c of dto.certifications ?? []) {
      await this.certificationService.create(userId, c);
      certifications++;
    }
    for (const l of dto.links ?? []) {
      await this.linkService.create(userId, l);
      links++;
    }

    return { created: { experiences, projects, certifications, links } };
  }
}
