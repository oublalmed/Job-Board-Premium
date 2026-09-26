// Local exam content bank, derived from the IT question bank (10 profiles x
// domains x levels x question types). The source questions are open-ended
// (a rubric of expected elements, not multiple choice), so the bank is
// regenerated here in clean French from the same templates the bank uses. The
// expected-answer rubric is server-side only and surfaced as feedback after
// submission — never as a graded key, since these answers are free text.

export type QuestionType = 'technical' | 'psychotechnical';

export interface ExamQuestion {
  id: string;
  profile: string;
  domain: string; // the evaluated skill
  type: QuestionType;
  // The original bank's category (Technique, Debugging, Architecture…), kept
  // for display; psychotechnical maps to the "Psychotechnique IT" category.
  category: string;
  level: string;
  timeSeconds: number;
  prompt: string;
  expected: string;
}

interface Profile {
  name: string;
  aliases?: string[];
  domains: string[];
}

// The 10 professional profiles and their evaluated skills (from the bank).
const PROFILES: Profile[] = [
  {
    name: 'Software Engineer',
    aliases: ['Développement Logiciel'],
    domains: [
      'Algorithms & Data Structures', 'OOP & Design', 'Programming Concepts',
      'System Design', 'Debugging', 'Concurrency', 'Databases',
      'APIs & Integration', 'Software Engineering',
    ],
  },
  {
    name: 'Java / Backend',
    domains: [
      'Java Core', 'Collections & Streams', 'JVM', 'Spring / Spring Boot',
      'REST APIs', 'Persistence / JPA', 'SQL', 'Concurrency', 'Messaging',
      'Backend Architecture',
    ],
  },
  {
    name: 'Frontend',
    aliases: ['Développement Web Full-Stack'],
    domains: [
      'HTML/CSS', 'JavaScript / TypeScript', 'React / Angular', 'Browser',
      'State Management', 'Web Performance', 'Accessibility', 'Security',
      'Testing', 'Frontend Architecture',
    ],
  },
  {
    name: 'Full Stack',
    domains: [
      'Frontend', 'Backend', 'APIs', 'Databases', 'Authentication',
      'Integration', 'Architecture', 'Performance', 'Testing', 'Deployment',
    ],
  },
  {
    name: 'Data Engineer',
    aliases: ['Data Engineering'],
    domains: [
      'SQL', 'Python', 'ETL/ELT', 'Data Modeling', 'Spark', 'Kafka',
      'Data Warehousing', 'Cloud Data', 'Data Quality', 'Pipelines',
    ],
  },
  {
    name: 'DevOps / Cloud',
    aliases: ['DevOps & Cloud'],
    domains: [
      'Linux', 'Networking', 'Docker', 'Kubernetes', 'CI/CD', 'AWS/Azure/GCP',
      'IaC', 'Observability', 'Security', 'SRE',
    ],
  },
  {
    name: 'Cybersecurity',
    aliases: ['Cybersécurité'],
    domains: [
      'Network Security', 'Application Security', 'IAM', 'Cryptography',
      'SOC / SIEM', 'Incident Response', 'Cloud Security',
      'Vulnerability Management', 'Threat Modeling', 'Security Governance',
    ],
  },
  {
    name: 'QA / Test',
    domains: [
      'Testing Fundamentals', 'Test Design', 'Automation', 'API Testing',
      'UI Testing', 'Performance', 'Security Testing', 'CI/CD Testing',
      'Defect Management', 'Quality Strategy',
    ],
  },
  {
    name: 'Business Analyst IT',
    domains: [
      'Requirements', 'Business Analysis', 'Functional Specifications', 'BPMN',
      'UML', 'SQL/Data', 'API Understanding', 'Agile', 'UAT/Recette',
      'Stakeholder Management',
    ],
  },
  {
    name: 'IT Project Manager',
    domains: [
      'Project Planning', 'Agile / Scrum', 'Waterfall', 'Estimation',
      'Risk Management', 'Budget', 'Stakeholders', 'Delivery', 'Governance',
      'Leadership',
    ],
  },
];

// Question categories from the bank. Each has two phrasings (`{s}` = skill) and
// a rubric of expected elements. "Psychotechnique IT" is the psychotechnical
// section; the rest are technical.
interface Category {
  key: string;
  label: string;
  type: QuestionType;
  templates: [string, string];
  expected: string;
}

const CATEGORIES: Category[] = [
  {
    key: 'technique', label: 'Technique', type: 'technical',
    templates: [
      'Définissez {s} et expliquez son intérêt dans un projet informatique.',
      'Quels sont les avantages, limites et principaux cas d’utilisation de {s} ?',
    ],
    expected: 'Définition précise, comparaison pertinente, cas d’usage, avantages/limites et exemple.',
  },
  {
    key: 'code', label: 'Code / Pseudo-code', type: 'technical',
    templates: [
      'Proposez un pseudo-code utilisant {s} et indiquez sa complexité temporelle.',
      'Comment optimiseriez-vous une implémentation de {s} lorsque le volume de données augmente fortement ?',
    ],
    expected: 'Raisonnement étape par étape, résultat/comportement, complexité et correction éventuelle.',
  },
  {
    key: 'debugging', label: 'Debugging', type: 'technical',
    templates: [
      'Comment distingueriez-vous une erreur de configuration, de code et d’infrastructure autour de {s} ?',
      'Une application utilisant {s} présente des erreurs intermittentes. Quelle démarche de diagnostic suivez-vous ?',
    ],
    expected: 'Reproduction, logs/métriques, hypothèses, isolation de cause, correction, validation et prévention.',
  },
  {
    key: 'architecture', label: 'Architecture', type: 'technical',
    templates: [
      'Quels composants ajouteriez-vous autour de {s} pour améliorer résilience et observabilité ?',
      'Quels compromis architecture/performance/coût implique l’utilisation de {s} ?',
    ],
    expected: 'Composants, flux, scalabilité, sécurité, résilience, observabilité, compromis coût/performance.',
  },
  {
    key: 'scenario', label: 'Scénario IT', type: 'technical',
    templates: [
      'Vous rejoignez une équipe qui utilise {s}. Quelle serait votre première analyse avant de modifier la solution ?',
      'Une mise en production provoque une régression liée à {s}. Quelles actions prenez-vous immédiatement puis à moyen terme ?',
    ],
    expected: 'Clarification du problème, priorisation, analyse factuelle, communication, solution et suivi.',
  },
  {
    key: 'psycho', label: 'Psychotechnique IT', type: 'psychotechnical',
    templates: [
      'Vous disposez de plusieurs contraintes autour de {s}. Quelle information devez-vous isoler en premier pour réduire l’espace des solutions ?',
      'Pour {s}, comment détermineriez-vous rapidement si une solution est faisable avant de l’implémenter ?',
    ],
    expected: 'Raisonnement explicite, identification des contraintes, élimination des options et conclusion logique.',
  },
];

const LEVELS = [
  { name: 'L1 - Stage', time: 60 },
  { name: 'L2 - Junior', time: 75 },
  { name: 'L3 - Confirmé', time: 90 },
  { name: 'L4 - Senior', time: 120 },
  { name: 'L5 - Expert', time: 150 },
];

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Build every (skill x category) question for a profile — the bank's unique
// content (levels only changed the time; phrasings repeat), regenerated cleanly.
function buildProfileBank(profile: Profile): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  profile.domains.forEach((domain, di) => {
    CATEGORIES.forEach((cat, ci) => {
      const variant = (di + ci) % 2;
      const level = LEVELS[(di + ci) % LEVELS.length];
      out.push({
        id: `${slug(profile.name)}__${slug(domain)}__${cat.key}`,
        profile: profile.name,
        domain,
        type: cat.type,
        category: cat.label,
        level: level.name,
        timeSeconds: level.time,
        prompt: cat.templates[variant].replace(/\{s\}/g, domain),
        expected: cat.expected,
      });
    });
  });
  return out;
}

const BANK: Record<string, ExamQuestion[]> = Object.fromEntries(
  PROFILES.map((p) => [p.name, buildProfileBank(p)]),
);

// Resolve a catalog specialty name to a profile (supports the French aliases of
// the older catalog), falling back to Software Engineer.
function resolveProfile(specialtyName: string | null): Profile {
  if (specialtyName) {
    const match = PROFILES.find(
      (p) =>
        p.name.toLowerCase() === specialtyName.toLowerCase() ||
        p.aliases?.some((a) => a.toLowerCase() === specialtyName.toLowerCase()),
    );
    if (match) return match;
  }
  return PROFILES[0];
}

// The names shown in the assessment catalog (one specialty per profile).
export const PROFILE_NAMES = PROFILES.map((p) => p.name);

// Small deterministic PRNG so getExam and submitExam pick the SAME questions
// for a given attempt (seeded by the assessment id), while different attempts
// get different sets.
function seededPick<T>(items: T[], n: number, seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// An exam for a specialty: 5 technical + 2 psychotechnical questions, drawn from
// the profile's bank, deterministic per attempt seed.
export function examForSpecialty(
  specialtyName: string | null,
  seed = 'default',
): ExamQuestion[] {
  const profile = resolveProfile(specialtyName);
  const pool = BANK[profile.name] ?? [];
  const technical = pool.filter((q) => q.type === 'technical');
  const psycho = pool.filter((q) => q.type === 'psychotechnical');
  return [
    ...seededPick(technical, 5, seed + ':t'),
    ...seededPick(psycho, 2, seed + ':p'),
  ];
}
