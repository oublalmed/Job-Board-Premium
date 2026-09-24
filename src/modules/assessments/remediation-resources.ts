// EF-REM-02 — targeted progression resources per weak domain. A static
// table, deliberately: an admin-managed referential (EF-ADM-02) belongs to
// Lot 8, not here — this is just enough to deliver the Should requirement
// without building a referential system a lot early.
export interface RemediationResource {
  title: string;
  url: string;
}

export const DOMAIN_RESOURCES: Record<string, RemediationResource[]> = {
  Algorithmes: [
    {
      title: 'Introduction aux algorithmes (MIT OpenCourseWare)',
      url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
    },
  ],
  'Structures de données': [
    {
      title: 'Structures de données — cours et exercices',
      url: 'https://www.freecodecamp.org/news/data-structures-101/',
    },
  ],
  'Bases de données': [
    {
      title: 'SQL et modélisation relationnelle',
      url: 'https://sqlbolt.com/',
    },
  ],
  'Système & réseaux': [
    {
      title: 'Computer Networking — a Top-Down Approach',
      url: 'https://gaia.cs.umass.edu/kurose_ross/',
    },
  ],
};

export function resourcesForDomain(domain: string): RemediationResource[] {
  return DOMAIN_RESOURCES[domain] ?? [];
}

// EF-REM-02 — the resource referential is admin-overridable at runtime via this
// settings key (a JSON map domain -> [{title,url}]). It ties into the EF-ADM-02
// settings mechanism without hard-coding an admin screen here; when unset or
// malformed, the curated static table above is used.
export const REMEDIATION_RESOURCES_OVERRIDE_KEY =
  'remediation_resources_override';

type ResourceMap = Record<string, RemediationResource[]>;

// Parse the stored override defensively: bad JSON, wrong shape, or non-http(s)
// URLs are ignored (fall back to defaults) rather than surfaced to candidates.
export function parseResourceOverride(raw: string | null): ResourceMap | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const out: ResourceMap = {};
  for (const [domain, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const items = value.filter(
      (v): v is RemediationResource =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as RemediationResource).title === 'string' &&
        typeof (v as RemediationResource).url === 'string' &&
        /^https?:\/\/.+/i.test((v as RemediationResource).url),
    );
    if (items.length > 0) out[domain] = items;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Resolve resources for a domain, preferring an admin override when present.
export function resourcesForDomainWith(
  domain: string,
  override: ResourceMap | null,
): RemediationResource[] {
  return override?.[domain] ?? resourcesForDomain(domain);
}
