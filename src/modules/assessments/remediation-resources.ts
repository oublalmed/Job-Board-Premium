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
