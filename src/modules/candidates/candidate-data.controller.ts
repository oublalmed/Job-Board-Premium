import {
  Controller,
  Get,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { CandidateDataService } from './candidate-data.service.js';

@Controller('candidates/data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateDataController {
  constructor(private readonly dataService: CandidateDataService) {}

  @Get('export')
  async exportData(@CurrentUser() user: JwtPayload) {
    return this.dataService.exportData(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteData(@CurrentUser() user: JwtPayload) {
    await this.dataService.deleteData(user.sub);
    return { message: 'Account data deleted and anonymized' };
  }
}
