import { QueryClient } from '@tanstack/react-query';
import type { SessionState } from '../session/manager';

type SessionSource = {
  getSnapshot: () => SessionState;
  subscribe: (listener: () => void) => () => void;
};
export function privateScope(state: SessionState) {
  const session = state.session;
  return state.status === 'authenticated' && session
    ? `${session.generation}:${session.user.id}:${session.mode ?? 'none'}`
    : null;
}
export function createPrivateQueryCache(source: SessionSource) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
        gcTime: 300_000,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
  let scope = privateScope(source.getSnapshot());
  const unsubscribe = source.subscribe(() => {
    const next = privateScope(source.getSnapshot());
    if (next !== scope) {
      scope = next;
      // Cancela consultas pendentes e remove os caches de consultas e mutações.
      client.clear();
    }
  });
  return {
    client,
    dispose() {
      unsubscribe();
      client.clear();
    },
  };
}
