import { ExperienceType } from './entities/experience.entity.js';
import { LinkType } from './entities/profile-link.entity.js';

// §1 — heuristic extraction of structured data from a CV's OCR text, to
// PRE-FILL the candidate's profile. Links are reliable (URL regex); the section
// blocks (experiences / projects / certifications) are best-effort starting
// points the candidate reviews and completes before saving — nothing here is
// authoritative, and nothing is saved automatically.

export interface LinkSuggestion {
  type: LinkType;
  url: string;
}
export interface ExperienceSuggestion {
  type: ExperienceType;
  title: string;
  organization: string;
  description: string;
}
export interface ProjectSuggestion {
  title: string;
  description: string;
  url: string | null;
}
export interface CertificationSuggestion {
  name: string;
  issuer: string;
}
export interface CvSuggestions {
  links: LinkSuggestion[];
  experiences: ExperienceSuggestion[];
  projects: ProjectSuggestion[];
  certifications: CertificationSuggestion[];
}

// A generous URL matcher: full http(s) URLs, plus bare github.com/… and
// linkedin.com/… that CVs often print without a scheme.
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s)|,;]+|\b(?:github|linkedin)\.com\/[^\s)|,;]+/gi;

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/[.,;:]+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^www\./i, '')}`;
  return url;
}

function classifyLink(url: string): LinkType {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com')) return LinkType.LINKEDIN;
  if (u.includes('github.com')) return LinkType.GITHUB;
  return LinkType.OTHER;
}

export function extractLinks(text: string): LinkSuggestion[] {
  const seen = new Set<string>();
  const out: LinkSuggestion[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = normalizeUrl(m[0]);
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: classifyLink(url), url });
  }
  return out;
}

type Section = 'work' | 'education' | 'projects' | 'certifications' | null;

const HEADERS: { re: RegExp; section: Section }[] = [
  {
    re: /^(exp[ée]riences?|parcours|professional experience|work experience|emplois?)\b/i,
    section: 'work',
  },
  {
    re: /^(formations?|education|dipl[ôo]mes?|scolarit[ée]|academic)\b/i,
    section: 'education',
  },
  { re: /^(projets?|projects?|r[ée]alisations?)\b/i, section: 'projects' },
  {
    re: /^(certifications?|certificats?|licenses?)\b/i,
    section: 'certifications',
  },
  // Sections that END the ones we care about (so we don't spill into them).
  {
    re: /^(comp[ée]tences?|skills|langues?|languages?|centres? d.int[ée]r[êe]t|hobbies|r[ée]f[ée]rences?)\b/i,
    section: null,
  },
];

function headerFor(line: string): Section | 'none' {
  for (const h of HEADERS) if (h.re.test(line.trim())) return h.section;
  return 'none';
}

// A content line worth turning into a suggestion (not a header, not noise).
function isContentLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 200) return false;
  // Skip lines that are only a date / only punctuation.
  if (/^[\s\d/.\-–—|]+$/.test(t)) return false;
  return true;
}

const MAX_PER_SECTION = 6;

export function parseCvText(text: string): CvSuggestions {
  const links = extractLinks(text);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const buckets: Record<
    'work' | 'education' | 'projects' | 'certifications',
    string[]
  > = {
    work: [],
    education: [],
    projects: [],
    certifications: [],
  };

  let current: Section = null;
  for (const line of lines) {
    const h = headerFor(line);
    if (h !== 'none') {
      current = h; // may be null → a section we explicitly stop at
      continue;
    }
    if (
      current &&
      isContentLine(line) &&
      buckets[current].length < MAX_PER_SECTION
    ) {
      // Avoid duplicating a line that is purely a URL (already in links).
      if (!/^(https?:\/\/|www\.)\S+$/i.test(line)) buckets[current].push(line);
    }
  }

  const experiences: ExperienceSuggestion[] = [
    ...buckets.work.map((title) => ({
      type: ExperienceType.WORK,
      title,
      organization: '',
      description: '',
    })),
    ...buckets.education.map((title) => ({
      type: ExperienceType.EDUCATION,
      title,
      organization: '',
      description: '',
    })),
  ];

  const projects: ProjectSuggestion[] = buckets.projects.map((line) => {
    const url = line.match(URL_RE)?.[0];
    return {
      title: line.replace(URL_RE, '').trim() || line,
      description: line,
      url: url ? normalizeUrl(url) : null,
    };
  });

  const certifications: CertificationSuggestion[] = buckets.certifications.map(
    (name) => ({ name, issuer: '' }),
  );

  return { links, experiences, projects, certifications };
}
