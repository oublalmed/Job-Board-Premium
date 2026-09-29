import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExamRunner } from './ExamRunner';
import type { ExamPayload } from './queries';

// t() echoes the key so assertions don't depend on locale content.
vi.mock('@/i18n/locale-context', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'fr' }),
}));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));

const submitMutate = vi.fn();
const examData: { current: ExamPayload | undefined } = { current: undefined };
vi.mock('./queries', () => ({
  useAssessmentExam: () => ({
    data: examData.current,
    isLoading: false,
    isError: false,
  }),
  useSubmitExam: () => ({ mutate: submitMutate, isPending: false }),
}));

function makeExam(): ExamPayload {
  return {
    assessmentId: 'a1',
    specialtyName: 'Software Engineer',
    technicalCount: 1,
    psychotechnicalCount: 1,
    totalTimeSeconds: 150,
    questions: [
      {
        id: 'q1',
        type: 'technical',
        domain: 'Algorithmes',
        prompt: 'Question un ?',
        options: ['A', 'B', 'C'],
        timeLimitSeconds: 90,
      },
      {
        id: 'q2',
        type: 'psychotechnical',
        domain: 'Logique',
        prompt: 'Question deux ?',
        options: ['X', 'Y', 'Z'],
        timeLimitSeconds: 60,
      },
    ],
  };
}

describe('ExamRunner (§1 — question-by-question + per-question timer)', () => {
  beforeEach(() => {
    examData.current = makeExam();
    submitMutate.mockReset();
    toast.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one question at a time and advances on Next', () => {
    render(<ExamRunner assessmentId="a1" onCompleted={vi.fn()} />);
    expect(screen.getByText('Question un ?')).toBeInTheDocument();
    expect(screen.queryByText('Question deux ?')).not.toBeInTheDocument();

    // Answer, then advance.
    fireEvent.click(screen.getByText('B'));
    fireEvent.click(
      screen.getByRole('button', { name: 'assessments.exam.next' }),
    );

    expect(screen.getByText('Question deux ?')).toBeInTheDocument();
    expect(screen.queryByText('Question un ?')).not.toBeInTheDocument();
  });

  it('submits all answers when finishing the last question', () => {
    render(<ExamRunner assessmentId="a1" onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByText('B')); // q1 -> option index 1
    fireEvent.click(
      screen.getByRole('button', { name: 'assessments.exam.next' }),
    );
    fireEvent.click(screen.getByText('Z')); // q2 -> option index 2
    fireEvent.click(
      screen.getByRole('button', { name: 'assessments.exam.finish' }),
    );

    expect(submitMutate).toHaveBeenCalledTimes(1);
    expect(submitMutate.mock.calls[0][0]).toEqual({
      assessmentId: 'a1',
      answers: { q1: 1, q2: 2 },
    });
  });

  it('auto-advances to the next question when the timer expires', () => {
    vi.useFakeTimers();
    render(<ExamRunner assessmentId="a1" onCompleted={vi.fn()} />);
    expect(screen.getByText('Question un ?')).toBeInTheDocument();

    // First question's budget is 90s — run it out.
    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(screen.getByText('Question deux ?')).toBeInTheDocument();
  });

  it('submits when the last question timer expires', () => {
    vi.useFakeTimers();
    render(<ExamRunner assessmentId="a1" onCompleted={vi.fn()} />);
    // Run out q1 (90s) then q2 (60s).
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(submitMutate).toHaveBeenCalledTimes(1);
  });
});
