import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { SchoolVerificationService } from './school-verification.service.js';

@Controller('candidates/school-verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class SchoolVerificationController {
  constructor(
    private readonly schoolVerificationService: SchoolVerificationService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async submit(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const verification = await this.schoolVerificationService.submit(
      user.sub,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    );
    return {
      id: verification.id,
      status: verification.status,
      matchedSchool: verification.matchedSchool,
      createdAt: verification.createdAt,
    };
  }

  @Get()
  async getMine(@CurrentUser() user: JwtPayload) {
    const verification = await this.schoolVerificationService.getMine(
      user.sub,
    );
    if (!verification) return { verification: null };
    return {
      verification: {
        id: verification.id,
        status: verification.status,
        matchedSchool: verification.matchedSchool,
        reviewNote: verification.reviewNote,
        createdAt: verification.createdAt,
        reviewedAt: verification.reviewedAt,
      },
    };
  }
}
