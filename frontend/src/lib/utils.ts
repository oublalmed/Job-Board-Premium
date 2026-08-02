import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// The standard shadcn/ui helper: clsx resolves conditional class lists,
// tailwind-merge then dedupes conflicting Tailwind classes (e.g. a
// consumer's className="p-4" overriding a component's own "p-2") so the
// last one wins predictably instead of both landing in the DOM.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
