import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { privateScope } from '@/shared/query/cache';
import { useSession } from '@/shared/session/SessionProvider';
import { authenticatedApi, sessionManager } from '@/shared/session/runtime';
import {
  basketListOptions,
  createPlanApi,
  createPlanWriter,
  planFailure,
  planResourceOptions,
  planListOptions,
  planRows,
  validPlanId,
  type PlanCommand,
} from './model';

export const planApi = createPlanApi((path, options) => {
  const state = sessionManager.getSnapshot();
  if (state.status !== 'authenticated')
    return Promise.reject({ code: 'unauthenticated', status: 401 });
  if (
    state.session?.mode !== 'produtor' ||
    !state.session.user.perfis.includes('produtor')
  )
    return Promise.reject({ status: 403 });
  return authenticatedApi(path, options);
});
function useProducerScope() {
  const state = useSession();
  const focused = useIsFocused();
  return {
    scope: privateScope(state) ?? 'guest',
    enabled:
      focused &&
      state.status === 'authenticated' &&
      state.session?.mode === 'produtor' &&
      state.session.user.perfis.includes('produtor'),
  };
}
export function usePlans(text: string) {
  const { scope, enabled } = useProducerScope();
  const [search, setSearch] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useInfiniteQuery({
    ...planListOptions(planApi, scope, search),
    enabled,
    subscribed: enabled,
    staleTime: 0,
  });
  return {
    ...query,
    plans: planRows(query.data?.pages),
    searchPending: search !== text,
    failure: query.error ? planFailure(query.error) : null,
    loadMore: () =>
      enabled && query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
  };
}
export function usePlan(id: number | null) {
  return useResource('plan', id, planApi.plan);
}
export function useBasket(id: number | null) {
  return useResource('basket', id, planApi.basket);
}
export function useBasketItem(id: number | null) {
  return useResource('item', id, planApi.item);
}
export function usePlanProduct(id: number | null) {
  return useResource('product', id, planApi.product);
}
function useResource<T>(
  resource: 'plan' | 'basket' | 'item' | 'product',
  id: number | null,
  get: (id: number, signal?: AbortSignal) => Promise<T>,
) {
  const { scope, enabled } = useProducerScope();
  const validId = validPlanId(id);
  const query = useQuery({
    ...planResourceOptions(scope, resource, id ?? 0, get),
    enabled: enabled && validId,
    subscribed: enabled,
    retry: false,
  });
  return {
    ...query,
    validId,
    failure: !validId
      ? planFailure({ code: 'invalid_identifier' })
      : query.error
        ? planFailure(query.error)
        : null,
  };
}
export function useBaskets(id: number | null) {
  const { scope, enabled } = useProducerScope();
  const query = useInfiniteQuery({
    ...basketListOptions(planApi, scope, id ?? 0),
    enabled: enabled && validPlanId(id),
    subscribed: enabled,
    staleTime: 0,
  });
  return {
    ...query,
    baskets: planRows(query.data?.pages),
    failure: query.error ? planFailure(query.error) : null,
    loadMore: () =>
      enabled && query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
  };
}
export function usePlanCommand() {
  const client = useQueryClient();
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ReturnType<typeof planFailure> | null>(
    null,
  );
  const writer = useMemo(
    () =>
      createPlanWriter(
        planApi,
        () => {
          const state = sessionManager.getSnapshot();
          return state.session?.mode === 'produtor'
            ? privateScope(state)
            : null;
        },
        async (scope, phase) => {
          const queryKey = ['private', scope];
          if (phase === 'before') {
            await client.cancelQueries({ queryKey });
            await client.invalidateQueries({ queryKey, refetchType: 'none' });
          } else {
            void client.invalidateQueries({ queryKey });
          }
        },
      ),
    [client],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      writer.cancel();
    };
  }, [writer]);
  useFocusEffect(useCallback(() => () => writer.cancel(), [writer]));
  return {
    busy,
    failure,
    async run(command: PlanCommand) {
      if (failure?.uncertain || writer.busy) return null;
      setBusy(true);
      setFailure(null);
      try {
        return await writer.run(command);
      } catch (error) {
        if (
          (error as { code?: string })?.code !== 'cancelled' &&
          mounted.current
        )
          setFailure(planFailure(error, true));
        return null;
      } finally {
        if (mounted.current) setBusy(writer.busy);
      }
    },
  };
}
