import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
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
import { DataRequestService } from './data-request.service.js';
import { CreateDataRequestDto } from './dto/create-data-request.dto.js';
import { toDataRequestResponse } from './dto/data-request-response.dto.js';

@Controller('candidates/data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
export class CandidateDataController {
  constructor(
    private readonly dataService: CandidateDataService,
    private readonly dataRequestService: DataRequestService,
  ) {}

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

  // EF-ADM-03 — file a formal CNDP/RGPD request that lands in the admin queue
  // with a 30-day legal deadline, rather than acting immediately.
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDataRequestDto,
  ) {
    const request = await this.dataRequestService.create(
      user.sub,
      dto.type,
      dto.message,
    );
    return toDataRequestResponse(request);
  }

  @Get('requests')
  async listRequests(@CurrentUser() user: JwtPayload) {
    const requests = await this.dataRequestService.listForUser(user.sub);
    return requests.map(toDataRequestResponse);
  }
}
