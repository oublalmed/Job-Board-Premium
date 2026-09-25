import {
  resourcesForDomain,
  resourcesForDomainWith,
  parseResourceOverride,
} from '../remediation-resources.js';

describe('remediation resources (EF-REM-02)', () => {
  it('returns the curated static resources for a known domain', () => {
    expect(resourcesForDomain('Algorithmes').length).toBeGreaterThan(0);
    expect(resourcesForDomain('Inconnu')).toEqual([]);
  });

  describe('parseResourceOverride', () => {
    it('returns null for empty / invalid JSON / wrong shape', () => {
      expect(parseResourceOverride(null)).toBeNull();
      expect(parseResourceOverride('not json')).toBeNull();
      expect(parseResourceOverride('[]')).toBeNull();
      expect(parseResourceOverride('123')).toBeNull();
    });

    it('keeps only well-formed entries with http(s) URLs', () => {
      const raw = JSON.stringify({
        Algorithmes: [
          { title: 'Custom', url: 'https://example.com/algo' },
          { title: 'Bad', url: 'javascript:alert(1)' },
          { title: 'NoUrl' },
        ],
        Empty: [],
      });
      const parsed = parseResourceOverride(raw);
      expect(parsed).toEqual({
        Algorithmes: [{ title: 'Custom', url: 'https://example.com/algo' }],
      });
    });
  });

  describe('resourcesForDomainWith', () => {
    it('prefers the override when present, else the static table', () => {
      const override = {
        Algorithmes: [{ title: 'Override', url: 'https://x.example/a' }],
      };
      expect(resourcesForDomainWith('Algorithmes', override)).toEqual(
        override.Algorithmes,
      );
      // domain not in override falls back to the curated defaults
      expect(resourcesForDomainWith('Bases de données', override)).toEqual(
        resourcesForDomain('Bases de données'),
      );
      // no override at all → defaults
      expect(resourcesForDomainWith('Algorithmes', null)).toEqual(
        resourcesForDomain('Algorithmes'),
      );
    });
  });
});
