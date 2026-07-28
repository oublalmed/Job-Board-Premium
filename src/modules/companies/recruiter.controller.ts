import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { RecruiterService } from './recruiter.service.js';
import { AddRecruiterDto } from './dto/add-recruiter.dto.js';

@Controller('companies/recruiters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Post()
  @Roles(Role.COMPANY_ADMIN)
  async addRecruiter(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddRecruiterDto,
  ) {
    return this.recruiterService.addRecruiter(user.sub, dto);
  }

  @Get()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async listRecruiters(@CurrentUser() user: JwtPayload) {
    return this.recruiterService.listRecruiters(user.sub);
  }

  @Delete(':id')
  @Roles(Role.COMPANY_ADMIN)
  async removeRecruiter(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) recruiterId: string,
  ) {
    await this.recruiterService.removeRecruiter(user.sub, recruiterId);
    return { removed: true };
  }
}
