import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';

// Type augmentation for `toHaveNoViolations` lives in ./vitest-axe.d.ts; this
// registers the matchers at runtime.
expect.extend(axeMatchers);

// ENF-11 — automated WCAG (axe-core) checks on representative UI. These catch
// the machine-detectable subset of WCAG 2.1 A/AA (roles, names, contrast-less
// issues like missing labels, ARIA misuse). A full AA sign-off still needs a
// manual audit, but this is a real, enforced regression gate in CI.

vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    // Return human-ish text (not raw keys) so axe checks real accessible names.
    t: (key: string) => key.split('.').pop() ?? key,
    ta: () => [],
  }),
}));

const quota = {
  active: true,
  plan: 'growth',
  status: 'active',
  contactQuota: 60,
  contactsUsed: 12,
  contactsRemaining: 48,
  quotaResetAt: null,
  endsAt: '2026-12-31T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  pastDueSince: null,
};
vi.mock('@/features/billing/queries', () => ({
  useContactQuota: () => ({ data: quota, isLoading: false }),
}));

// ENF-11 — a small, fixed exam so the interactive QCM (radio-like buttons) can
// be checked by axe without a network/query client.
const examPayload = {
  assessmentId: 'a1',
  specialtyName: 'Software Engineer',
  technicalCount: 1,
  psychotechnicalCount: 1,
  questions: [
    {
      id: 'q1',
      type: 'technical' as const,
      domain: 'HTTP',
      prompt: 'Que signifie le code HTTP 404 ?',
      options: ['Succès', 'Ressource introuvable'],
    },
    {
      id: 'q2',
      type: 'psychotechnical' as const,
      domain: 'Logique',
      prompt: 'Suite : 2, 6, 12, 20, ?',
      options: ['30', '28'],
    },
  ],
};
vi.mock('@/features/assessments/queries', () => ({
  useAssessmentExam: () => ({ data: examPayload, isLoading: false, isError: false }),
  useSubmitExam: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { CandidateScoreBadge } from '@/features/candidates/CandidateScoreBadge';
import { AnonymizedHint } from '@/features/candidates/AnonymizedHint';
import { SubscriptionStatusCard } from '@/features/billing/SubscriptionStatusCard';
import { ExamRunner } from '@/features/assessments/ExamRunner';

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

describe('a11y (ENF-11) — axe has no violations', () => {
  it('CandidateScoreBadge', async () => {
    await expectNoViolations(
      <CandidateScoreBadge score={82} percentile={90} rank={3} />,
    );
  });

  it('AnonymizedHint', async () => {
    await expectNoViolations(<AnonymizedHint />);
  });

  it('SubscriptionStatusCard (active)', async () => {
    await expectNoViolations(<SubscriptionStatusCard />);
  });

  it('ExamRunner (interactive QCM)', async () => {
    await expectNoViolations(
      <ExamRunner assessmentId="a1" onCompleted={() => {}} />,
    );
  });
});
