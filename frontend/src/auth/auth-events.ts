// Tiny pub-sub so the API middleware (a plain module, no React tree
// access) can tell AuthProvider (a component, owns the `user` state) that
// the session just ended — refresh failed, or a request came back 401
// after an already-attempted refresh. Kept separate from token-store.ts:
// that module is "what is the current token", this one is "who needs to
// react when it becomes invalid".
type Listener = () => void;

let listeners: Listener[] = [];

export function onSessionExpired(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
  };
}

export function notifySessionExpired(): void {
  listeners.forEach((listener) => listener());
}
