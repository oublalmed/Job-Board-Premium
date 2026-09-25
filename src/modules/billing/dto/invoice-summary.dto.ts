import { ApiProperty } from '@nestjs/swagger';
import { Invoice } from '../entities/invoice.entity.js';

// Read-only projection of an emitted invoice for listing (EF-BILL-03).
// Deliberately omits pdf_storage_key — the PDF is reached only through the
// signed-URL endpoint, never by exposing the storage key.
export class InvoiceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-0001' })
  invoiceNumber!: string;

  @ApiProperty({ description: 'Amount excluding tax, in centimes.' })
  amountHT!: number;

  @ApiProperty({ description: 'VAT rate as an integer percentage.' })
  vatRate!: number;

  @ApiProperty({ description: 'VAT amount, in centimes.' })
  vatAmount!: number;

  @ApiProperty({ description: 'Total incl. tax, in centimes.' })
  amountTTC!: number;

  @ApiProperty({ example: 'MAD' })
  currency!: string;

  @ApiProperty({ description: "Buyer's ICE as captured at emission." })
  companyIce!: string;

  @ApiProperty({ format: 'date-time' })
  issuedAt!: Date;

  static fromEntity(invoice: Invoice): InvoiceSummaryDto {
    const dto = new InvoiceSummaryDto();
    dto.id = invoice.id;
    dto.invoiceNumber = invoice.invoiceNumber;
    dto.amountHT = invoice.amountHT;
    dto.vatRate = invoice.vatRate;
    dto.vatAmount = invoice.vatAmount;
    dto.amountTTC = invoice.amountTTC;
    dto.currency = invoice.currency;
    dto.companyIce = invoice.companyIce;
    dto.issuedAt = invoice.issuedAt;
    return dto;
  }
}
