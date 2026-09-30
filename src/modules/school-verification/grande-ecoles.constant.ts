// Reference list for the OCR grande-école matcher. A static table — an
// admin-managed referential is a later-phase concern. Each entry's aliases are
// the strings likely to appear on a diploma or in a CV's "Formation" section
// (acronym + full name). The matcher below matches each alias as a WHOLE WORD
// against normalized text, so a short acronym like "emi" or "ensem" won't
// false-match inside ordinary French words ("académique", "ensemble").
export interface GrandeEcole {
  name: string;
  aliases: string[];
}

export const GRANDES_ECOLES: GrandeEcole[] = [
  {
    name: "ENSIAS — École Nationale Supérieure d'Informatique et d'Analyse des Systèmes",
    aliases: [
      'ensias',
      'ecole nationale superieure d informatique et d analyse des systemes',
    ],
  },
  {
    name: "EMI — École Mohammadia d'Ingénieurs",
    aliases: ['emi', 'ecole mohammadia d ingenieurs', 'mohammadia ingenieurs'],
  },
  {
    name: 'INPT — Institut National des Postes et Télécommunications',
    aliases: ['inpt', 'institut national des postes et telecommunications'],
  },
  {
    name: "ENIM — École Nationale de l'Industrie Minérale",
    aliases: [
      'enim',
      'ecole nationale de l industrie minerale',
      'industrie minerale',
    ],
  },
  {
    name: 'EHTP — École Hassania des Travaux Publics',
    aliases: ['ehtp', 'ecole hassania des travaux publics', 'hassania'],
  },
  {
    name: "INSEA — Institut National de Statistique et d'Économie Appliquée",
    aliases: [
      'insea',
      'institut national de statistique et d economie appliquee',
    ],
  },
  {
    name: 'UM6P — Université Mohammed VI Polytechnique',
    aliases: [
      'um6p',
      'universite mohammed vi polytechnique',
      'mohammed vi polytechnique',
    ],
  },
  {
    name: 'UIR — Université Internationale de Rabat',
    aliases: ['uir', 'universite internationale de rabat'],
  },
  {
    name: "ENSEM — École Nationale Supérieure d'Électricité et de Mécanique",
    aliases: [
      'ensem',
      'ecole nationale superieure d electricite et de mecanique',
    ],
  },
  {
    name: "ESITH — École Supérieure des Industries du Textile et de l'Habillement",
    aliases: [
      'esith',
      'ecole superieure des industries du textile et de l habillement',
    ],
  },
  {
    name: "EMSI — École Marocaine des Sciences de l'Ingénieur",
    aliases: ['emsi', 'ecole marocaine des sciences de l ingenieur'],
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation/apostrophes → spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SchoolMatch {
  school: string;
  matchedAlias: string;
}

// Whole-word match: an alias matches only when it appears as its own token(s),
// not as a substring inside another word. Aliases are already normalized to
// [a-z0-9 ], so they carry no regex metacharacters.
export function matchGrandeEcole(extractedText: string): SchoolMatch | null {
  const normalized = normalize(extractedText);
  if (!normalized) return null;
  for (const school of GRANDES_ECOLES) {
    for (const alias of school.aliases) {
      const needle = normalize(alias);
      if (!needle) continue;
      const re = new RegExp(`\\b${needle}\\b`);
      if (re.test(normalized)) {
        return { school: school.name, matchedAlias: alias };
      }
    }
  }
  return null;
}
