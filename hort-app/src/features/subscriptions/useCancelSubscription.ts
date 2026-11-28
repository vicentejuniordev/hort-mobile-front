import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { privateScope } from '@/shared/query/cache';
import { authenticatedApi, sessionManager } from '@/shared/session/runtime';
import { subscriptionKeys, type Subscription } from './model';
import {
  cancellationFailure,
  createSubscriptionCanceller,
} from './cancellation';

function customerScope() {
  const state = sessionManager.getSnapshot();
  return state.session?.mode === 'cliente' &&
    state.session.user.perfis.includes('cliente')
    ? privateScope(state)
    : null;
}
export function useCancelSubscription() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<
    (ReturnType<typeof cancellationFailure> & { at: number }) | null
  >(null);
  const mounted = useRef(true);
  const running = useRef(false);
  const focused = useRef(false);
  const writer = useMemo(
    () => createSubscriptionCanceller(authenticatedApi, customerScope),
    [],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      writer.cancel();
    };
  }, [writer]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        writer.cancel();
      };
    }, [writer]),
  );
  return {
    busy,
    failure,
    async run(id: number) {
      const scope = customerScope();
      if (!scope || !focused.current || running.current) return null;
      running.current = true;
      setBusy(true);
      setFailure(null);
      try {
        await client.cancelQueries({ queryKey: subscriptionKeys.all(scope) });
        if (!mounted.current || !focused.current || scope !== customerScope())
          return null;
        const result = await writer.run(id);
        if (!mounted.current || !focused.current || scope !== customerScope())
          return null;
        // Preserve the enriched GET fields; the command is not its replacement.
        client.setQueryData<Subscription>(
          subscriptionKeys.detail(scope, id),
          (previous) =>
            previous
              ? {
                  ...previous,
                  status: result.status,
                  data_cancelamento: result.data_cancelamento,
                }
              : previous,
        );
        return result;
      } catch (error) {
        if (mounted.current && focused.current && scope === customerScope())
          setFailure({ ...cancellationFailure(error), at: Date.now() });
        return null;
      } finally {
        running.current = false;
        if (mounted.current) setBusy(false);
        if (scope === customerScope())
          void client
            .invalidateQueries({ queryKey: subscriptionKeys.all(scope) })
            .catch(() => {});
      }
    },
  };
}
