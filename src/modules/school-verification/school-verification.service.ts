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
import {
  SchoolVerification,
  SchoolVerificationStatus,
} from './entities/school-verification.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import {
  Document,
  DocumentType,
  ScanStatus,
} from '../candidates/entities/document.entity.js';
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
// §2 — OCR confidence (0-100) at/above which a matched school is auto-approved,
// skipping manual review. Overridable via the `school_verification_auto_approve
// _min_confidence` setting.
const DEFAULT_AUTO_APPROVE_MIN_CONFIDENCE = 92;

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

    // §2 — auto-approve ONLY when a *referenced* grande école was matched AND the
    // OCR is confident enough. A school that is NOT in the reference list
    // (match === null) is never auto-approved, whatever the OCR confidence — it
    // stays pending for an administrator to verify the school manually, then
    // approve or reject. This gate is the product rule "écoles non référencées =
    // validation admin obligatoire".
    const autoApproveMin =
      (await this.settingsService.getNumber(
        'school_verification_auto_approve_min_confidence',
      )) ?? DEFAULT_AUTO_APPROVE_MIN_CONFIDENCE;
    const autoApprove =
      match !== null && ocrResult.confidence >= autoApproveMin;

    // When it isn't auto-approved, record *why* it's awaiting an admin, so the
    // review queue distinguishes an unreferenced school (needs the school itself
    // vetted) from a referenced one that merely fell short on OCR confidence.
    const pendingNote =
      match === null
        ? 'École non référencée — en attente de validation par un administrateur.'
        : `En attente de validation par un administrateur (OCR ${Math.round(
            ocrResult.confidence,
          )}% < ${autoApproveMin}%).`;

    const verification = await this.verificationRepo.save(
      this.verificationRepo.create({
        candidateProfileId: profile.id,
        documentId: document.id,
        status: autoApprove
          ? SchoolVerificationStatus.VERIFIED
          : SchoolVerificationStatus.PENDING,
        ocrExtractedText: ocrResult.text,
        matchedSchool: match?.school ?? null,
        confidence: ocrResult.confidence,
        // The decision is recorded on the row itself (status + reviewedAt +
        // note), so the auto-approval keeps a trace. reviewedBy stays null =
        // system-decided (no human reviewer).
        reviewedAt: autoApprove ? new Date() : null,
        reviewNote: autoApprove
          ? `Auto-approuvé : OCR ${Math.round(ocrResult.confidence)}% ≥ ${autoApproveMin}% (${match.school})`
          : pendingNote,
      }),
    );

    // Mirror the manual-approval side effect: mark the profile verified and
    // canonicalize the school name to the matched reference.
    if (autoApprove) {
      await this.profileRepo
        .createQueryBuilder()
        .update(CandidateProfile)
        .set({ schoolVerified: true, school: match.school })
        .where('id = :id', { id: profile.id })
        .execute();
    }

    this.logger.log(
      `School verification submitted for user ${userId}, matched=${match?.school ?? 'none'}, autoApproved=${autoApprove}`,
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
    const verification = await this.claimPendingDecision(
      id,
      adminUserId,
      note,
      SchoolVerificationStatus.VERIFIED,
    );

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
    return this.claimPendingDecision(
      id,
      adminUserId,
      note,
      SchoolVerificationStatus.REJECTED,
    );
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
      throw new ConflictException('This submission has already been reviewed');
    }

    return this.verificationRepo.findOneOrFail({ where: { id } });
  }
}
