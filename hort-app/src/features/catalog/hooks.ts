import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSession } from '@/shared/session/SessionProvider';
import { authenticatedApi } from '@/shared/session/runtime';
import { privateScope } from '@/shared/query/cache';
import {
  catalogFailure,
  catalogOffers,
  createCatalogApi,
  type CatalogFilters,
} from './model';
import { catalogDetailOptions, catalogListOptions } from './model';

const api = createCatalogApi(authenticatedApi);
export function useCatalog(filters: CatalogFilters = {}) {
  const session = useSession();
  const focused = useIsFocused();
  const [search, setSearch] = useState(filters.search ?? '');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search ?? ''), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const query = useInfiniteQuery({
    ...catalogListOptions(api, privateScope(session) ?? 'guest', {
      ...filters,
      search,
    }),
    enabled: !!session.session && focused,
    subscribed: focused,
  });
  return {
    ...query,
    offers: catalogOffers(query.data?.pages),
    failure: query.error ? catalogFailure(query.error) : null,
    loadMore: () =>
      query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
    searchPending: search !== (filters.search ?? ''),
  };
}
export function useCatalogOffer(id: number, fresh = false) {
  const session = useSession();
  const focused = useIsFocused();
  const query = useQuery({
    ...catalogDetailOptions(api, privateScope(session) ?? 'guest', id),
    ...(fresh && { staleTime: 0 }),
    enabled: !!session.session && focused && Number.isSafeInteger(id) && id > 0,
    subscribed: focused,
  });
  return {
    ...query,
    failure: query.error ? catalogFailure(query.error) : null,
  };
}
