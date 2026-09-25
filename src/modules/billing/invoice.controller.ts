import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { JwtPayload } from '../../common/interfaces/request-with-user.interface.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceSummaryDto } from './dto/invoice-summary.dto.js';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // EF-BILL-03 — list the company's emitted invoices.
  @Get()
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  @ApiResponse({ status: 200, type: [InvoiceSummaryDto] })
  async listInvoices(
    @CurrentUser() user: JwtPayload,
  ): Promise<InvoiceSummaryDto[]> {
    const invoices = await this.invoiceService.listForUser(user.sub);
    return invoices.map((invoice) => InvoiceSummaryDto.fromEntity(invoice));
  }

  @Get(':id')
  @Roles(Role.RECRUITER, Role.COMPANY_ADMIN)
  async getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoiceService.getSignedPdfUrl(user.sub, id);
  }
}
