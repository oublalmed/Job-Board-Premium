// Reference list for the OCR grande-école matcher. A static table,
// deliberately — same doctrine as assessments/remediation-resources.ts:
// an admin-managed referential is a later-phase concern, not this one.
// Each entry's aliases are the strings actually likely to appear on a
// scanned diploma (full name, common acronym, campus variants) — the
// matcher below does substring matching against normalized OCR text, so
// aliases matter more than the canonical name picked for display.
export interface GrandeEcole {
  name: string;
  aliases: string[];
}

export const GRANDES_ECOLES: GrandeEcole[] = [
  {
    name: 'ENSIAS',
    aliases: ['ensias', "ecole nationale superieure d'informatique"],
  },
  {
    name: 'EMI — École Mohammadia d\'Ingénieurs',
    aliases: ['emi', "ecole mohammadia d'ingenieurs"],
  },
  {
    name: 'EHTP — École Hassania des Travaux Publics',
    aliases: ['ehtp', 'ecole hassania des travaux publics'],
  },
  {
    name: 'INPT — Institut National des Postes et Télécommunications',
    aliases: ['inpt', 'institut national des postes et telecommunications'],
  },
  { name: 'ENSA', aliases: ['ensa', 'ecole nationale des sciences appliquees'] },
  {
    name: 'ENSAM',
    aliases: ['ensam', "ecole nationale superieure d'arts et metiers"],
  },
  { name: 'ISCAE', aliases: ['iscae'] },
  { name: 'HEM Business School', aliases: ['hem', 'hem business school'] },
  {
    name: 'École Centrale Casablanca',
    aliases: ['centrale casablanca', 'ecole centrale casablanca'],
  },
  {
    name: 'Université Al Akhawayn',
    aliases: ['al akhawayn', 'akhawayn university'],
  },
  {
    name: 'UM6P — Université Mohammed VI Polytechnique',
    aliases: ['um6p', 'universite mohammed vi polytechnique'],
  },
  { name: 'ENCG', aliases: ['encg', 'ecole nationale de commerce et de gestion'] },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SchoolMatch {
  school: string;
  matchedAlias: string;
}

export function matchGrandeEcole(extractedText: string): SchoolMatch | null {
  const normalized = normalize(extractedText);
  for (const school of GRANDES_ECOLES) {
    for (const alias of school.aliases) {
      if (normalized.includes(normalize(alias))) {
        return { school: school.name, matchedAlias: alias };
      }
    }
  }
  return null;
}
