import { parseCvText, extractLinks } from '../cv-parsing.js';
import { ExperienceType } from '../entities/experience.entity.js';
import { LinkType } from '../entities/profile-link.entity.js';

describe('cv-parsing (§1)', () => {
  describe('extractLinks', () => {
    it('finds and classifies links, adding a scheme and de-duplicating', () => {
      const text = `Contact: https://johndoe.dev
        github.com/johndoe  www.linkedin.com/in/johndoe
        Encore: github.com/johndoe`;
      const links = extractLinks(text);
      const byType = Object.fromEntries(links.map((l) => [l.type, l.url]));
      expect(byType[LinkType.GITHUB]).toBe('https://github.com/johndoe');
      expect(byType[LinkType.LINKEDIN]).toContain('linkedin.com/in/johndoe');
      expect(byType[LinkType.OTHER]).toBe('https://johndoe.dev');
      // github.com/johndoe appeared twice → one entry.
      expect(links.filter((l) => l.type === LinkType.GITHUB)).toHaveLength(1);
    });
  });

  describe('parseCvText', () => {
    const cv = `John Doe
Ingénieur logiciel
https://github.com/johndoe

Expérience
Développeur Backend chez Acme
Stagiaire chez Beta

Formation
Ingénierie informatique — ENSIAS

Projets
Plateforme e-commerce https://github.com/johndoe/shop
API de paiement

Certifications
AWS Certified Developer

Compétences
Node.js, PostgreSQL, Docker`;

    it('extracts work + education experiences from their sections', () => {
      const s = parseCvText(cv);
      const titles = s.experiences.map((e) => e.title);
      expect(titles).toContain('Développeur Backend chez Acme');
      expect(titles).toContain('Ingénierie informatique — ENSIAS');
      expect(s.experiences.find((e) => e.title.includes('ENSIAS'))?.type).toBe(
        ExperienceType.EDUCATION,
      );
      expect(s.experiences.find((e) => e.title.includes('Acme'))?.type).toBe(
        ExperienceType.WORK,
      );
    });

    it('extracts projects (with an inline URL) and certifications', () => {
      const s = parseCvText(cv);
      expect(s.projects.some((p) => p.title.includes('Plateforme'))).toBe(true);
      expect(s.projects.find((p) => p.title.includes('Plateforme'))?.url).toBe(
        'https://github.com/johndoe/shop',
      );
      expect(s.certifications.map((c) => c.name)).toContain(
        'AWS Certified Developer',
      );
    });

    it('stops at the Compétences section (no skills leak into experiences)', () => {
      const s = parseCvText(cv);
      expect(s.experiences.some((e) => e.title.includes('Node.js'))).toBe(
        false,
      );
    });

    it('surfaces the CV links', () => {
      const s = parseCvText(cv);
      expect(s.links.some((l) => l.type === LinkType.GITHUB)).toBe(true);
    });
  });
});
