import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { components, paths } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

export type Offer = components['schemas']['PlanoCatalogo'];
export type CatalogPage = components['schemas']['PaginatedPlanoCatalogoList'];
type Query = NonNullable<
  paths['/api/v1/catalogo-planos/']['get']['parameters']['query']
>;
const orderings = [
  'id',
  '-id',
  'nome',
  '-nome',
  'categoria',
  '-categoria',
  'periodicidade_semanal',
  '-periodicidade_semanal',
] as const;
export type CatalogFilters = Pick<Query, 'search'> & {
  ordering?: (typeof orderings)[number];
};
export function normalizeCatalogFilters(filters: CatalogFilters = {}) {
  const search = filters.search?.trim() ?? '';
  const ordering = filters.ordering ?? 'id';
  if (!orderings.includes(ordering)) throw Error('Ordenação inválida.');
  return { search, ordering };
}
type Transport = <T>(
  path: string,
  options?: Omit<RequestOptions, 'accessToken'>,
) => Promise<T>;
export function createCatalogApi(request: Transport) {
  return {
    list(filters: CatalogFilters = {}, page = 1, signal?: AbortSignal) {
      if (!Number.isSafeInteger(page) || page <= 0)
        throw Error('Página inválida.');
      const normalized = normalizeCatalogFilters(filters);
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
        ordering:
          normalized.ordering === 'id' || normalized.ordering === '-id'
            ? normalized.ordering
            : `${normalized.ordering},id`,
      });
      if (normalized.search) params.set('search', normalized.search);
      return request<CatalogPage>(`catalogo-planos/?${params}`, { signal });
    },
    detail(id: number, signal?: AbortSignal) {
      if (!Number.isSafeInteger(id) || id <= 0) throw Error('Oferta inválida.');
      return request<Offer>(`catalogo-planos/${id}/`, { signal });
    },
  };
}
export function catalogOffers(pages: CatalogPage[] = []): Offer[] {
  return [
    ...new Map(
      pages.flatMap((page) => page.results).map((offer) => [offer.id, offer]),
    ).values(),
  ];
}
export function nextCatalogPage(last: CatalogPage, current: number) {
  return last.next && last.results.length ? current + 1 : undefined;
}
export function catalogFailure(error: unknown) {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: number; code?: string })
      : {};
  const kind =
    value.status === 401 ||
    value.code === 'unauthenticated' ||
    value.code === 'session_expired'
      ? 'auth'
      : value.status === 403
        ? 'forbidden'
        : value.status === 404
          ? 'missing'
          : value.status === 429
            ? 'throttled'
            : value.code === 'cancelled'
              ? 'cancelled'
              : 'unavailable';
  const messages = {
    auth: 'Entre novamente para consultar os planos.',
    forbidden: 'Sua conta não tem acesso a este catálogo.',
    missing: 'Esta oferta não está mais disponível. Atualize o catálogo.',
    throttled: 'Muitas consultas. Aguarde antes de tentar novamente.',
    cancelled: 'Consulta cancelada.',
    unavailable:
      'Não foi possível consultar os planos. Verifique sua conexão e tente novamente.',
  };
  return {
    kind,
    message: messages[kind],
    canRetry: kind === 'unavailable' || kind === 'throttled',
  };
}

type Api = ReturnType<typeof createCatalogApi>;
export const catalogKeys = {
  all: (scope: string) => ['private', scope, 'catalog'] as const,
  list: (scope: string, filters: CatalogFilters = {}) =>
    [
      'private',
      scope,
      'catalog',
      'list',
      normalizeCatalogFilters(filters),
    ] as const,
  detail: (scope: string, id: number) =>
    ['private', scope, 'catalog', 'detail', id] as const,
};
export function catalogListOptions(
  api: Api,
  scope: string,
  filters: CatalogFilters = {},
) {
  const normalized = normalizeCatalogFilters(filters);
  return infiniteQueryOptions({
    queryKey: catalogKeys.list(scope, normalized),
    queryFn: ({ pageParam, signal }) => api.list(normalized, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, current) => nextCatalogPage(last, current),
    retry: false,
  });
}
export function catalogDetailOptions(api: Api, scope: string, id: number) {
  return queryOptions({
    queryKey: catalogKeys.detail(scope, id),
    queryFn: ({ signal }) => api.detail(id, signal),
    retry: false,
  });
}
