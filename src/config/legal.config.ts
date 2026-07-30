import { registerAs } from '@nestjs/config';

// The platform's own legal identity as the invoice issuer — distinct from
// any row in the companies table, which represents subscriber companies,
// not us. Required on every invoice alongside the buyer's ICE.
export const legalConfig = registerAs('legal', () => ({
  issuerName: process.env['INVOICE_ISSUER_NAME'] ?? '',
  issuerIce: process.env['INVOICE_ISSUER_ICE'] ?? '',
  issuerAddress: process.env['INVOICE_ISSUER_ADDRESS'] ?? '',
}));
