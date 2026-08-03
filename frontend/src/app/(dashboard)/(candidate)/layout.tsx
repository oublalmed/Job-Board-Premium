import type { Metadata } from 'next';

// Same reasoning as the recruiter group's layout — see its comment.
export const metadata: Metadata = {
  title: {
    template: '%s — Espace candidat | Job Board Premium',
    default: 'Espace candidat | Job Board Premium',
  },
};

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
