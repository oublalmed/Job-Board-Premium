import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SchoolVerification, SchoolVerificationStatus } from './entities/school-verification.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { Document, DocumentType, ScanStatus } from '../candidates/entities/document.entity.js';
import type { FileScanner } from '../../ports/file-scanner.port.js';
import { FILE_SCANNER } from '../../ports/file-scanner.port.js';
import type { ObjectStorage } from '../../ports/object-storage.port.js';
import { OBJECT_STORAGE } from '../../ports/object-storage.port.js';
import type { OcrProvider } from '../../ports/ocr.port.js';
import { OCR_PROVIDER } from '../../ports/ocr.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { matchGrandeEcole } from './grande-ecoles.constant.js';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const DEFAULT_MAX_SIZE = 8 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES = 'application/pdf,image/jpeg,image/png';

@Injectable()
export class SchoolVerificationService {
  private readonly logger = new Logger(SchoolVerificationService.name);

  constructor(
    @InjectRepository(SchoolVerification)
    private readonly verificationRepo: Repository<SchoolVerification>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @Inject(FILE_SCANNER)
    private readonly fileScanner: FileScanner,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    @Inject(OCR_PROVIDER)
    private readonly ocrProvider: OcrProvider,
    private readonly settingsService: SettingsService,
  ) {}

  async submit(
    userId: string,
    file: UploadedFile,
  ): Promise<SchoolVerification> {
    if (!file.size || file.buffer.length === 0) {
      throw new BadRequestException('Le fichier est vide');
    }

    const maxSize =
      (await this.settingsService.getNumber('diploma_max_size_bytes')) ??
      DEFAULT_MAX_SIZE;
    if (file.size > maxSize) {
      const maxMo = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `Le fichier dépasse la taille maximale de ${maxMo} Mo`,
      );
    }

    const allowedTypesStr =
      (await this.settingsService.get('diploma_allowed_mime_types')) ??
      DEFAULT_ALLOWED_TYPES;
    const allowedTypes = allowedTypesStr.split(',').map((t) => t.trim());
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Type de fichier non autorisé. Types acceptés : PDF, JPEG, PNG',
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

    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = await this.profileRepo.save(
        this.profileRepo.create({ userId }),
      );
    }

    const storageKey = `diploma/${userId}/${uuidv4()}-${file.originalname}`;
    await this.objectStorage.upload({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Re-submission replaces the previous attempt entirely (document +
    // verification row) — a candidate correcting a bad scan shouldn't pile
    // up history an admin has to sort through, and the unique constraint on
    // candidateProfileId means a second insert would fail anyway.
    const existing = await this.verificationRepo.findOne({
      where: { candidateProfileId: profile.id },
    });
    if (existing) {
      const oldDocument = await this.documentRepo.findOne({
        where: { id: existing.documentId },
      });
      await this.verificationRepo.remove(existing);
      if (oldDocument) {
        await this.objectStorage.delete(oldDocument.storageKey);
        await this.documentRepo.remove(oldDocument);
      }
    }

    const document = await this.documentRepo.save(
      this.documentRepo.create({
        ownerId: userId,
        type: DocumentType.DIPLOMA,
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        scanStatus: ScanStatus.CLEAN,
      }),
    );

    const ocrResult = await this.ocrProvider.extractText(
      file.buffer,
      file.mimetype,
    );
    const match = matchGrandeEcole(ocrResult.text);

    const verification = await this.verificationRepo.save(
      this.verificationRepo.create({
        candidateProfileId: profile.id,
        documentId: document.id,
        status: SchoolVerificationStatus.PENDING,
        ocrExtractedText: ocrResult.text,
        matchedSchool: match?.school ?? null,
        confidence: ocrResult.confidence,
      }),
    );

    this.logger.log(
      `School verification submitted for user ${userId}, matched=${match?.school ?? 'none'}`,
    );

    return verification;
  }

  async getMine(userId: string): Promise<SchoolVerification | null> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return null;
    return this.verificationRepo.findOne({
      where: { candidateProfileId: profile.id },
    });
  }

  async listPending(): Promise<SchoolVerification[]> {
    return this.verificationRepo.find({
      where: { status: SchoolVerificationStatus.PENDING },
      relations: { candidateProfile: true },
      order: { createdAt: 'ASC' },
    });
  }

  async getDetailForAdmin(
    id: string,
  ): Promise<{ verification: SchoolVerification; documentUrl: string }> {
    const verification = await this.verificationRepo.findOne({
      where: { id },
      relations: { candidateProfile: true, document: true },
    });
    if (!verification) {
      throw new NotFoundException('School verification not found');
    }
    const documentUrl = await this.objectStorage.getSignedUrl(
      verification.document.storageKey,
      600,
    );
    return { verification, documentUrl };
  }

  async approve(
    id: string,
    adminUserId: string,
    note: string | undefined,
  ): Promise<SchoolVerification> {
    const verification = await this.claimPendingDecision(id, adminUserId, note, SchoolVerificationStatus.VERIFIED);

    // Canonicalizes the candidate's free-text school entry to the matched
    // reference name on approval — otherwise a verified badge could sit
    // next to whatever the candidate originally typed (typo, abbreviation),
    // which would undercut the point of verifying it. Falls back to
    // leaving the candidate's own text untouched if nothing matched (an
    // admin can still approve a school that isn't in the static reference
    // list — the badge just won't rewrite the name).
    await this.profileRepo
      .createQueryBuilder()
      .update(CandidateProfile)
      .set({
        schoolVerified: true,
        ...(verification.matchedSchool
          ? { school: verification.matchedSchool }
          : {}),
      })
      .where('id = :id', { id: verification.candidateProfileId })
      .execute();

    return verification;
  }

  async reject(
    id: string,
    adminUserId: string,
    note: string | undefined,
  ): Promise<SchoolVerification> {
    return this.claimPendingDecision(id, adminUserId, note, SchoolVerificationStatus.REJECTED);
  }

  // Atomic claim, same shape as ContactQuotaService.consumeOneContact: a
  // single conditional UPDATE (WHERE id AND status = 'pending') is what
  // makes "two admins reviewing the same submission at once" resolve to
  // exactly one winner instead of a last-write-wins race — a plain
  // findOne-then-save here would let both requests read status='pending'
  // and both "succeed", silently overwriting each other's decision.
  private async claimPendingDecision(
    id: string,
    adminUserId: string,
    note: string | undefined,
    status: SchoolVerificationStatus,
  ): Promise<SchoolVerification> {
    const result = await this.verificationRepo
      .createQueryBuilder()
      .update(SchoolVerification)
      .set({
        status,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      })
      .where('id = :id', { id })
      .andWhere('status = :pending', {
        pending: SchoolVerificationStatus.PENDING,
      })
      .execute();

    if ((result.affected ?? 0) === 0) {
      const existing = await this.verificationRepo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('School verification not found');
      }
      throw new ConflictException(
        'This submission has already been reviewed',
      );
    }

    return this.verificationRepo.findOneOrFail({ where: { id } });
  }
}
