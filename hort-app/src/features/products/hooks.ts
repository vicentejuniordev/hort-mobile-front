import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { privateScope } from '@/shared/query/cache';
import { useSession } from '@/shared/session/SessionProvider';
import { authenticatedApi, sessionManager } from '@/shared/session/runtime';
import {
  createProductApi,
  createProductWriter,
  listedProducts,
  productFailure,
  productListOptions,
  type ProductCommand,
} from './model';

export const productApi = createProductApi(authenticatedApi);
export function useProducts(text: string) {
  const state = useSession();
  const focused = useIsFocused();
  const [search, setSearch] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useInfiniteQuery({
    ...productListOptions(productApi, privateScope(state) ?? 'guest', search),
    enabled: focused && state.session?.mode === 'produtor',
    subscribed: focused,
  });
  return {
    ...query,
    products: listedProducts(query.data?.pages),
    failure: query.error ? productFailure(query.error) : null,
    searchPending: search !== text,
    loadMore: () =>
      query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
  };
}
export function useProductWriter() {
  const client = useQueryClient();
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const writer = useMemo(
    () =>
      createProductWriter(
        productApi,
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
            // The command outcome is independent of the subsequent list refresh.
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
    async run(command: ProductCommand) {
      setBusy(true);
      try {
        return await writer.run(command);
      } finally {
        if (mounted.current) setBusy(writer.busy);
      }
    },
  };
}
