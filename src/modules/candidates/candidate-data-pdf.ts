import PDFDocument from 'pdfkit';

// Strongly-typed shape of the RGPD portability export. Shared by the JSON
// endpoint and the PDF renderer so the two representations can never drift
// (single source of truth — see CandidateDataService.collectExportData).
export interface CandidateDataExport {
  exportDate: string;
  user: {
    email: string;
    roles: string[];
    status: string;
    emailVerified: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  profile: {
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    bio: string | null;
    school: string | null;
    completeness: number;
    createdAt: Date | string;
    updatedAt: Date | string;
  } | null;
  experiences: {
    type: string;
    title: string | null;
    organization: string | null;
    startDate: Date | string | null;
    endDate: Date | string | null;
    description: string | null;
  }[];
  skills: { name: string; category: string | null; level: string | null }[];
  links: { type: string; url: string; label: string | null }[];
  certifications: {
    name: string;
    issuer: string | null;
    issueDate: Date | string | null;
    expiryDate: Date | string | null;
    credentialUrl: string | null;
  }[];
  documents: {
    type: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: Date | string;
  }[];
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' });
}

function value(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') {
    return '—';
  }
  return String(v);
}

/**
 * Renders the candidate's portability export (EF-CAND-08) as a human-readable
 * PDF. The JSON export stays the machine-readable form; this is the
 * "portabilité" document a candidate can archive or hand to a third party.
 *
 * Returns the full document as a Buffer (same buffering contract as
 * generateInvoicePdf) so the caller can stream it without touching pdfkit.
 */
export function generateCandidateDataPdf(
  data: CandidateDataExport,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const section = (title: string): void => {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(13).text(title);
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
    };

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('Export de mes données personnelles', { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .text('Portabilité RGPD / loi 09-08 (CNDP)', { align: 'center' });
    doc.text(`Généré le ${fmtDate(data.exportDate)}`, { align: 'center' });

    section('Compte');
    doc.text(`Email : ${value(data.user.email)}`);
    doc.text(`Rôles : ${data.user.roles.join(', ') || '—'}`);
    doc.text(`Statut : ${value(data.user.status)}`);
    doc.text(`Email vérifié : ${data.user.emailVerified ? 'oui' : 'non'}`);
    doc.text(`Créé le : ${fmtDate(data.user.createdAt)}`);
    doc.text(`Mis à jour le : ${fmtDate(data.user.updatedAt)}`);

    section('Profil');
    if (data.profile) {
      doc.text(
        `Nom : ${value(data.profile.firstName)} ${value(data.profile.lastName)}`,
      );
      doc.text(`Titre : ${value(data.profile.headline)}`);
      doc.text(`École : ${value(data.profile.school)}`);
      doc.text(`Complétude : ${value(data.profile.completeness)} %`);
      if (data.profile.bio) {
        doc.text(`Bio : ${data.profile.bio}`);
      }
    } else {
      doc.text('Aucun profil candidat.');
    }

    section('Expériences');
    if (data.experiences.length === 0) {
      doc.text('Aucune expérience.');
    } else {
      for (const e of data.experiences) {
        doc
          .font('Helvetica-Bold')
          .text(`${value(e.title)} — ${value(e.organization)} (${e.type})`);
        doc
          .font('Helvetica')
          .text(`${fmtDate(e.startDate)} → ${fmtDate(e.endDate)}`);
        if (e.description) {
          doc.text(e.description);
        }
        doc.moveDown(0.3);
      }
    }

    section('Compétences');
    if (data.skills.length === 0) {
      doc.text('Aucune compétence.');
    } else {
      for (const s of data.skills) {
        doc.text(
          `• ${value(s.name)}${s.category ? ` (${s.category})` : ''}${
            s.level ? ` — niveau ${s.level}` : ''
          }`,
        );
      }
    }

    section('Liens externes');
    if (data.links.length === 0) {
      doc.text('Aucun lien.');
    } else {
      for (const l of data.links) {
        doc.text(
          `• ${l.label ? `${l.label} : ` : ''}${value(l.url)} (${l.type})`,
        );
      }
    }

    section('Certifications');
    if (data.certifications.length === 0) {
      doc.text('Aucune certification.');
    } else {
      for (const c of data.certifications) {
        doc.text(
          `• ${value(c.name)} — ${value(c.issuer)} (${fmtDate(c.issueDate)}${
            c.expiryDate ? ` → ${fmtDate(c.expiryDate)}` : ''
          })`,
        );
      }
    }

    section('Documents');
    if (data.documents.length === 0) {
      doc.text('Aucun document.');
    } else {
      for (const d of data.documents) {
        doc.text(
          `• ${value(d.originalName)} (${d.type}, ${d.mimeType}, ${d.size} o) — ${fmtDate(d.createdAt)}`,
        );
      }
    }

    doc.end();
  });
}
