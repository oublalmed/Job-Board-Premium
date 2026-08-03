import { Skeleton } from '@/components/ui/skeleton';

// App Router's built-in loading-UI convention — shown automatically
// during navigation into this route group, before this segment's
// client bundle finishes mounting. Shape matches the search/list-heavy
// screens this group mostly contains (search bar + result rows), not
// a generic spinner.
export default function RecruiterLoading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-11 w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
