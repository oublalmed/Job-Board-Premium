import { matchGrandeEcole } from '../grande-ecoles.constant.js';

describe('matchGrandeEcole', () => {
  it('matches a known school by its acronym', () => {
    const result = matchGrandeEcole(
      "DIPLOME NATIONAL\nEcole Nationale Superieure d'Informatique et d'Analyse des Systemes\nENSIAS - Rabat",
    );
    expect(result?.school).toContain('ENSIAS');
  });

  it('matches a known school by its full name, case- and accent-insensitive', () => {
    const result = matchGrandeEcole("École Mohammadia d'Ingénieurs — Rabat");
    expect(result?.school).toBe("EMI — École Mohammadia d'Ingénieurs");
  });

  it('matches each of the 11 reference schools by acronym', () => {
    const cases: Array<[string, string]> = [
      ['ENSIAS', 'ENSIAS'],
      ['EMI', 'EMI'],
      ['INPT', 'INPT'],
      ['ENIM', 'ENIM'],
      ['EHTP', 'EHTP'],
      ['INSEA', 'INSEA'],
      ['UM6P', 'UM6P'],
      ['UIR', 'UIR'],
      ['ENSEM', 'ENSEM'],
      ['ESITH', 'ESITH'],
      ['EMSI', 'EMSI'],
    ];
    for (const [acronym, expected] of cases) {
      const result = matchGrandeEcole(
        `Formation : Diplôme d'ingénieur, ${acronym}, 2024`,
      );
      expect(result?.school).toContain(expected);
    }
  });

  it('does not false-match an acronym inside an ordinary word', () => {
    // "ensemble" must not match ENSEM; "académique" must not match EMI.
    expect(matchGrandeEcole('un projet en ensemble académique')).toBeNull();
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
