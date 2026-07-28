import {
  Injectable,
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Document,
  DocumentType,
  ScanStatus,
} from './entities/document.entity.js';
import { CandidateProfile } from './entities/candidate-profile.entity.js';
import type { FileScanner } from '../../ports/file-scanner.port.js';
import { FILE_SCANNER } from '../../ports/file-scanner.port.js';
import type { ObjectStorage } from '../../ports/object-storage.port.js';
import { OBJECT_STORAGE } from '../../ports/object-storage.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { CandidateProfileService } from './candidate-profile.service.js';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES =
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class CandidateDocumentService {
  private readonly logger = new Logger(CandidateDocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @Inject(FILE_SCANNER)
    private readonly fileScanner: FileScanner,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly settingsService: SettingsService,
    private readonly profileService: CandidateProfileService,
  ) {}

  async uploadCV(userId: string, file: UploadedFile): Promise<Document> {
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

    const allowedTypesStr =
      (await this.settingsService.get('cv_allowed_mime_types')) ??
      DEFAULT_ALLOWED_TYPES;
    const allowedTypes = allowedTypesStr.split(',').map((t) => t.trim());
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé. Types acceptés : PDF, DOCX`,
      );
    }

    const scanResult = await this.fileScanner.scan(
      file.buffer,
      file.originalname,
    );
    if (!scanResult.clean) {
      throw new BadRequestException(
        `Fichier rejeté : menace détectée (${scanResult.threat ?? 'threat detected'})`,
      );
    }

    const storageKey = `cv/${userId}/${uuidv4()}-${file.originalname}`;
    await this.objectStorage.upload({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const existingCV = await this.documentRepo.findOne({
      where: { ownerId: userId, type: DocumentType.CV },
    });
    if (existingCV) {
      await this.objectStorage.delete(existingCV.storageKey);
      await this.documentRepo.remove(existingCV);
    }

    const document = this.documentRepo.create({
      ownerId: userId,
      type: DocumentType.CV,
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      scanStatus: ScanStatus.CLEAN,
    });

    const saved = await this.documentRepo.save(document);
    this.logger.log(`CV uploaded for user ${userId}, docId=${saved.id}`);

    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (profile) {
      await this.profileService.calculateCompleteness(profile.id);
    }

    return saved;
  }

  async getCV(userId: string): Promise<Document | null> {
    return this.documentRepo.findOne({
      where: { ownerId: userId, type: DocumentType.CV },
    });
  }

  async deleteCV(userId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({
      where: { ownerId: userId, type: DocumentType.CV },
    });
    if (!doc) throw new NotFoundException('CV not found');

    await this.objectStorage.delete(doc.storageKey);
    await this.documentRepo.remove(doc);

    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (profile) {
      await this.profileService.calculateCompleteness(profile.id);
    }
  }
}
