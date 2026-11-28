import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { privateScope } from '@/shared/query/cache';
import { useSession } from '@/shared/session/SessionProvider';
import { authenticatedApi, sessionManager } from '@/shared/session/runtime';
import {
  createSubscriptionApi,
  readRows,
  scheduleDetailOptions,
  scheduleListOptions,
  subscriptionDetailOptions,
  subscriptionFailure,
  subscriptionListOptions,
  validReadId,
  type ScheduleFilters,
  type SubscriptionFilters,
} from './model';

const api = createSubscriptionApi((path, options) => {
  const state = sessionManager.getSnapshot();
  if (state.status !== 'authenticated')
    return Promise.reject(
      Object.assign(new Error('Entre novamente.'), { code: 'unauthenticated' }),
    );
  if (
    state.session?.mode !== 'cliente' ||
    !state.session.user.perfis.includes('cliente')
  )
    return Promise.reject(
      Object.assign(new Error('Use o modo Cliente.'), { status: 403 }),
    );
  return authenticatedApi(path, options);
});
function useCustomerScope() {
  const state = useSession();
  const focused = useIsFocused();
  return {
    scope: privateScope(state) ?? 'guest',
    enabled:
      focused &&
      state.status === 'authenticated' &&
      state.session?.mode === 'cliente' &&
      state.session.user.perfis.includes('cliente'),
  };
}
export function useSubscriptions(filters: SubscriptionFilters = {}) {
  const { scope, enabled } = useCustomerScope();
  const query = useInfiniteQuery({
    ...subscriptionListOptions(api, scope, filters),
    enabled,
    subscribed: enabled,
  });
  return {
    ...query,
    subscriptions: readRows(query.data?.pages),
    failure: query.error ? subscriptionFailure(query.error) : null,
    loadMore: () =>
      enabled && query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
  };
}
export function useSubscription(id: number | null) {
  const { scope, enabled } = useCustomerScope();
  const validId = validReadId(id);
  const query = useQuery({
    ...subscriptionDetailOptions(api, scope, id ?? 0),
    enabled: enabled && validId,
    subscribed: enabled,
  });
  return {
    ...query,
    validId,
    failure: !validId
      ? subscriptionFailure({ code: 'invalid_filter' })
      : query.error
        ? subscriptionFailure(query.error)
        : null,
  };
}
export function useSchedules(filters: ScheduleFilters = {}) {
  const { scope, enabled } = useCustomerScope();
  const query = useInfiniteQuery({
    ...scheduleListOptions(api, scope, filters),
    enabled,
    subscribed: enabled,
  });
  return {
    ...query,
    schedules: readRows(query.data?.pages),
    failure: query.error ? subscriptionFailure(query.error) : null,
    loadMore: () =>
      enabled && query.hasNextPage && !query.isFetching
        ? query.fetchNextPage({ cancelRefetch: false })
        : Promise.resolve(),
  };
}
export function useSchedule(id: number | null) {
  const { scope, enabled } = useCustomerScope();
  const validId = validReadId(id);
  const query = useQuery({
    ...scheduleDetailOptions(api, scope, id ?? 0),
    enabled: enabled && validId,
    subscribed: enabled,
  });
  return {
    ...query,
    validId,
    failure: !validId
      ? subscriptionFailure({ code: 'invalid_filter' })
      : query.error
        ? subscriptionFailure(query.error)
        : null,
  };
}
