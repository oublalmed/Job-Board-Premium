import { matchGrandeEcole } from '../grande-ecoles.constant.js';

describe('matchGrandeEcole', () => {
  it('matches a known school by its acronym', () => {
    const result = matchGrandeEcole(
      "DIPLOME NATIONAL\nEcole Nationale Superieure d'Informatique et d'Analyse des Systemes\nENSIAS - Rabat",
    );
    expect(result?.school).toBe('ENSIAS');
  });

  it('matches a known school by its full name, case- and accent-insensitive', () => {
    const result = matchGrandeEcole("École Mohammadia d'Ingénieurs — Rabat");
    expect(result?.school).toBe("EMI — École Mohammadia d'Ingénieurs");
  });

  it('returns null when no known school appears in the text', () => {
    const result = matchGrandeEcole(
      'CERTIFICATE OF GRADUATION\nUniversite privee\nProgramme non reconnu',
    );
    expect(result).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(matchGrandeEcole('')).toBeNull();
  });
});
