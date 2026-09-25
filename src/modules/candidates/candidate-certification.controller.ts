import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateCertificationService } from './candidate-certification.service.js';
import { CreateCertificationDto } from './dto/create-certification.dto.js';
import { UpdateCertificationDto } from './dto/update-certification.dto.js';

// EF-CAND-07 — certifications CRUD, scoped to the authenticated candidate's
// own profile (same authorization pattern as CandidateExperienceController).
@Controller('candidates/certifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateCertificationController {
  constructor(
    private readonly certificationService: CandidateCertificationService,
  ) {}

  @Get()
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.certificationService.listMine(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.certificationService.create(user.sub, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    return this.certificationService.update(user.sub, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.certificationService.remove(user.sub, id);
    return { message: 'Certification deleted' };
  }
}
