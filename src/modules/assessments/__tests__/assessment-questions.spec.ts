import { examForSpecialty, PROFILE_NAMES } from '../assessment-questions.js';

describe('examForSpecialty (QCM bank)', () => {
  it('returns 30 questions: 20 technical + 10 psychotechnical', () => {
    const exam = examForSpecialty('Software Engineer', 'seed-1');
    expect(exam).toHaveLength(30);
    expect(exam.filter((q) => q.type === 'technical')).toHaveLength(20);
    expect(exam.filter((q) => q.type === 'psychotechnical')).toHaveLength(10);
  });

  it('every question carries options and a valid correct index', () => {
    const exam = examForSpecialty('Java / Backend', 'seed-1');
    for (const q of exam) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const a1 = examForSpecialty('Frontend', 'attempt-A').map((q) => q.id);
    const a2 = examForSpecialty('Frontend', 'attempt-A').map((q) => q.id);
    const b = examForSpecialty('Frontend', 'attempt-B').map((q) => q.id);
    expect(a1).toEqual(a2); // same seed → identical draw
    expect(a1).not.toEqual(b); // different seed → different draw
  });

  it('resolves a French alias to its canonical profile', () => {
    // "Cybersécurité" → "Cybersecurity": at least one cy-* question present.
    const exam = examForSpecialty('Cybersécurité', 'seed');
    expect(exam.some((q) => q.id.startsWith('cy-'))).toBe(true);
  });

  it('matches a profile case-insensitively', () => {
    const exam = examForSpecialty('frontend', 'seed');
    expect(exam.some((q) => q.id.startsWith('fe-'))).toBe(true);
  });

  it('falls back to Software Engineer for null or unknown specialties', () => {
    expect(
      examForSpecialty(null, 'seed').some((q) => q.id.startsWith('se-')),
    ).toBe(true);
    expect(
      examForSpecialty('Astrologie', 'seed').some((q) =>
        q.id.startsWith('se-'),
      ),
    ).toBe(true);
  });

  it('exposes the profile names', () => {
    expect(PROFILE_NAMES).toContain('Software Engineer');
    expect(PROFILE_NAMES.length).toBeGreaterThanOrEqual(10);
  });
});
