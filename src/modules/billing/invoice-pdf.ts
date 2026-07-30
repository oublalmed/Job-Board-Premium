import PDFDocument from 'pdfkit';

export interface InvoicePdfParams {
  invoiceNumber: string;
  issuedAt: Date;
  issuerName: string;
  issuerIce: string;
  issuerAddress: string;
  companyName: string;
  companyIce: string;
  planLabel: string;
  amountHT: number;
  vatRate: number;
  vatAmount: number;
  amountTTC: number;
  currency: string;
}

function formatAmount(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

// The PDF generated here is archived once (invoice-emission.service.ts)
// and never regenerated — the stored bytes ARE the legal document, so any
// future template change must not affect invoices already issued.
export function generateInvoicePdf(params: InvoicePdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('FACTURE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Facture N° ${params.invoiceNumber}`);
    doc.text(
      `Date d'émission : ${params.issuedAt.toLocaleDateString('fr-FR', {
        timeZone: 'Africa/Casablanca',
      })}`,
    );
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Émetteur');
    doc.font('Helvetica');
    doc.text(params.issuerName);
    doc.text(`ICE : ${params.issuerIce}`);
    doc.text(params.issuerAddress);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Client');
    doc.font('Helvetica');
    doc.text(params.companyName);
    doc.text(`ICE : ${params.companyIce}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Désignation');
    doc.font('Helvetica');
    doc.text(`Abonnement ${params.planLabel} — 1 mois`);
    doc.moveDown();

    doc.text(
      `Montant HT : ${formatAmount(params.amountHT)} ${params.currency}`,
    );
    doc.text(
      `TVA (${params.vatRate}%) : ${formatAmount(params.vatAmount)} ${params.currency}`,
    );
    doc
      .font('Helvetica-Bold')
      .text(
        `Montant TTC : ${formatAmount(params.amountTTC)} ${params.currency}`,
      );

    doc.end();
  });
}
