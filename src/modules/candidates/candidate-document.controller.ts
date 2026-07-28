import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateDocumentService } from './candidate-document.service.js';

@Controller('candidates/cv')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateDocumentController {
  constructor(private readonly documentService: CandidateDocumentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadCV(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const document = await this.documentService.uploadCV(user.sub, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    return {
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      scanStatus: document.scanStatus,
    };
  }

  @Get()
  async getCV(@CurrentUser() user: JwtPayload) {
    const doc = await this.documentService.getCV(user.sub);
    if (!doc) return { cv: null };
    return {
      cv: {
        id: doc.id,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        scanStatus: doc.scanStatus,
        createdAt: doc.createdAt,
      },
    };
  }

  @Delete()
  async deleteCV(@CurrentUser() user: JwtPayload) {
    await this.documentService.deleteCV(user.sub);
    return { message: 'CV deleted' };
  }
}
