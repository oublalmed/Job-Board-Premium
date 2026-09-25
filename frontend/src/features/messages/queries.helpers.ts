// EF-MSG-02 — pure helpers for the messaging queries, kept in their own module
// so unit tests can exercise them without mocking the react-query hooks in
// queries.ts (which import the API client and token store).

// The total of unread incoming messages across every thread, used to surface a
// global "new messages" indicator (nav). Null-safe; negative counts are
// treated as zero so a bad payload can never subtract from the total.
export function sumUnread(
  conversations: { unreadCount: number }[] | undefined,
): number {
  return (conversations ?? []).reduce(
    (total, c) => total + (c.unreadCount > 0 ? c.unreadCount : 0),
    0,
  );
}
