import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { paths } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

export type Subscription =
  paths['/api/v1/assinaturas/{id}/']['get']['responses'][200]['content']['application/json'];
export type SubscriptionPage =
  paths['/api/v1/assinaturas/']['get']['responses'][200]['content']['application/json'];
export type Schedule =
  paths['/api/v1/entregas-programadas/{id}/']['get']['responses'][200]['content']['application/json'];
export type SchedulePage =
  paths['/api/v1/entregas-programadas/']['get']['responses'][200]['content']['application/json'];
type SubscriptionQuery = NonNullable<
  paths['/api/v1/assinaturas/']['get']['parameters']['query']
>;
type ScheduleQuery = NonNullable<
  paths['/api/v1/entregas-programadas/']['get']['parameters']['query']
>;
const subscriptionOrderings = [
  'id',
  '-id',
  'data_assinatura',
  '-data_assinatura',
  'data_renovacao',
  '-data_renovacao',
  'status',
  '-status',
  'valor_contratado',
  '-valor_contratado',
] as const;
const scheduleOrderings = [
  'id',
  '-id',
  'dia_semana',
  '-dia_semana',
  'ordem',
  '-ordem',
] as const;
export type SubscriptionFilters = Pick<
  SubscriptionQuery,
  'status' | 'plano' | 'data_renovacao'
> & { ordering?: (typeof subscriptionOrderings)[number] };
export type ScheduleFilters = Pick<
  ScheduleQuery,
  'assinatura' | 'cesta' | 'dia_semana'
> & { ordering?: (typeof scheduleOrderings)[number] };
const failure = (code: string) => Object.assign(new Error(code), { code });
export function validReadId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
const requireId = (id: number) => {
  if (!validReadId(id)) throw failure('invalid_filter');
  return id;
};
export function normalizeSubscriptionFilters(
  filters: SubscriptionFilters = {},
) {
  if (
    filters.status !== undefined &&
    !['ativa', 'cancelada'].includes(filters.status)
  )
    throw failure('invalid_filter');
  if (filters.plano !== undefined) requireId(filters.plano);
  const date = filters.data_renovacao?.trim();
  if (
    date !== undefined &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date.startsWith('0000') ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
  )
    throw failure('invalid_filter');
  const ordering = filters.ordering ?? '-data_assinatura';
  if (!subscriptionOrderings.includes(ordering))
    throw failure('invalid_filter');
  return {
    status: filters.status,
    plano: filters.plano,
    data_renovacao: date,
    ordering,
  };
}
export function normalizeScheduleFilters(filters: ScheduleFilters = {}) {
  if (filters.assinatura !== undefined) requireId(filters.assinatura);
  if (filters.cesta !== undefined) requireId(filters.cesta);
  if (
    filters.dia_semana !== undefined &&
    (!Number.isInteger(filters.dia_semana) ||
      filters.dia_semana < 1 ||
      filters.dia_semana > 7)
  )
    throw failure('invalid_filter');
  const ordering = filters.ordering ?? 'dia_semana';
  if (!scheduleOrderings.includes(ordering)) throw failure('invalid_filter');
  return {
    assinatura: filters.assinatura,
    cesta: filters.cesta,
    dia_semana: filters.dia_semana,
    ordering,
  };
}
function parameters(
  filters: Record<string, string | number | undefined>,
  page: number,
) {
  requireId(page);
  const params = new URLSearchParams({ page: String(page), page_size: '20' });
  for (const [name, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    params.set(
      name,
      name === 'ordering' && value !== 'id' && value !== '-id'
        ? `${value},${String(value).startsWith('-') ? '-id' : 'id'}`
        : String(value),
    );
  }
  return params;
}
function readSubscription(value: Subscription): Subscription {
  if (
    !value ||
    !validReadId(value.id) ||
    !value.plano_atual ||
    typeof value.plano_atual.is_ativo !== 'boolean' ||
    typeof value.valor_contratado !== 'string' ||
    !Array.isArray(value.plano_atual.cestas) ||
    !Array.isArray(value.programacoes)
  )
    throw failure('contract_mismatch');
  return value;
}
function readSchedule(value: Schedule): Schedule {
  if (
    !value ||
    !validReadId(value.id) ||
    !validReadId(value.assinatura) ||
    !validReadId(value.cesta) ||
    !validReadId(value.ordem) ||
    !Number.isInteger(value.dia_semana) ||
    value.dia_semana < 1 ||
    value.dia_semana > 7
  )
    throw failure('contract_mismatch');
  return value;
}
function readPage<T>(
  page: { count: number; results: T[] },
  item: (value: T) => T,
) {
  if (
    !page ||
    !Number.isSafeInteger(page.count) ||
    page.count < 0 ||
    !Array.isArray(page.results)
  )
    throw failure('contract_mismatch');
  page.results.forEach(item);
  return page;
}
type Transport = <T>(
  path: string,
  options?: Omit<RequestOptions, 'accessToken'>,
) => Promise<T>;
export function createSubscriptionApi(request: Transport) {
  return {
    async list(
      filters: SubscriptionFilters = {},
      page = 1,
      signal?: AbortSignal,
    ) {
      const response = await request<SubscriptionPage>(
        `assinaturas/?${parameters(normalizeSubscriptionFilters(filters), page)}`,
        { signal },
      );
      readPage(response, readSubscription);
      return response;
    },
    async detail(id: number, signal?: AbortSignal) {
      return readSubscription(
        await request<Subscription>(`assinaturas/${requireId(id)}/`, {
          signal,
        }),
      );
    },
    async schedules(
      filters: ScheduleFilters = {},
      page = 1,
      signal?: AbortSignal,
    ) {
      const response = await request<SchedulePage>(
        `entregas-programadas/?${parameters(normalizeScheduleFilters(filters), page)}`,
        { signal },
      );
      readPage(response, readSchedule);
      return response;
    },
    async schedule(id: number, signal?: AbortSignal) {
      return readSchedule(
        await request<Schedule>(`entregas-programadas/${requireId(id)}/`, {
          signal,
        }),
      );
    },
  };
}
export function subscriptionFailure(error: unknown) {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: number; code?: string })
      : {};
  const kind =
    value.code === 'contract_mismatch'
      ? 'contract'
      : value.code === 'invalid_filter' || value.status === 400
        ? 'invalid'
        : value.status === 401 ||
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
    contract:
      'O serviço de assinaturas e programações precisa ser atualizado. Entre em contato com o responsável pelo app.',
    invalid: 'Confira os filtros ou o identificador informado.',
    auth: 'Entre novamente para consultar suas assinaturas.',
    forbidden: 'Sua conta não tem acesso a esta consulta.',
    missing:
      'Esta assinatura ou programação não está disponível. Atualize a lista.',
    throttled: 'Muitas consultas. Aguarde antes de tentar novamente.',
    cancelled: 'Consulta cancelada.',
    unavailable:
      'Não foi possível consultar suas assinaturas ou programações. Verifique sua conexão e tente novamente.',
  };
  return {
    kind,
    message: messages[kind],
    canRetry: kind === 'unavailable' || kind === 'throttled',
  };
}
export function readRows<T extends { id: number }>(
  pages: { results: T[] }[] = [],
): T[] {
  return [
    ...new Map(
      pages.flatMap((page) => page.results).map((item) => [item.id, item]),
    ).values(),
  ];
}
const nextPage = (
  last: { next?: string | null; results: unknown[] },
  current: number,
) => (last.next && last.results.length ? current + 1 : undefined);
export const subscriptionKeys = {
  all: (scope: string) => ['private', scope, 'subscriptions'] as const,
  list: (scope: string, filters: SubscriptionFilters = {}) =>
    [
      'private',
      scope,
      'subscriptions',
      'list',
      normalizeSubscriptionFilters(filters),
    ] as const,
  detail: (scope: string, id: number) =>
    ['private', scope, 'subscriptions', 'detail', id] as const,
  schedules: (scope: string, filters: ScheduleFilters = {}) =>
    [
      'private',
      scope,
      'subscriptions',
      'schedules',
      'list',
      normalizeScheduleFilters(filters),
    ] as const,
  schedule: (scope: string, id: number) =>
    ['private', scope, 'subscriptions', 'schedules', 'detail', id] as const,
};
type Api = ReturnType<typeof createSubscriptionApi>;
export function subscriptionListOptions(
  api: Api,
  scope: string,
  filters: SubscriptionFilters = {},
) {
  const normalized = normalizeSubscriptionFilters(filters);
  return infiniteQueryOptions({
    queryKey: subscriptionKeys.list(scope, normalized),
    queryFn: ({ pageParam, signal }) => api.list(normalized, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => nextPage(last, page),
    retry: false,
  });
}
export function subscriptionDetailOptions(api: Api, scope: string, id: number) {
  return queryOptions({
    queryKey: subscriptionKeys.detail(scope, id),
    queryFn: ({ signal }) => api.detail(id, signal),
    retry: false,
  });
}
export function scheduleListOptions(
  api: Api,
  scope: string,
  filters: ScheduleFilters = {},
) {
  const normalized = normalizeScheduleFilters(filters);
  return infiniteQueryOptions({
    queryKey: subscriptionKeys.schedules(scope, normalized),
    queryFn: ({ pageParam, signal }) =>
      api.schedules(normalized, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) => nextPage(last, page),
    retry: false,
  });
}
export function scheduleDetailOptions(api: Api, scope: string, id: number) {
  return queryOptions({
    queryKey: subscriptionKeys.schedule(scope, id),
    queryFn: ({ signal }) => api.schedule(id, signal),
    retry: false,
  });
}
