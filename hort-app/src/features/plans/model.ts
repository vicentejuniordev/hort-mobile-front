import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import type { components } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';
import type { Product } from '../products/model';

export type Plan = components['schemas']['Plano'];
export type Basket = components['schemas']['Cesta'];
export type BasketItem = components['schemas']['HortalicaCesta'];
type PlanPage = components['schemas']['PaginatedPlanoList'];
type BasketPage = components['schemas']['PaginatedCestaList'];
export const planSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome.')
    .max(150, 'Use até 150 caracteres.'),
  categoria: z
    .string()
    .trim()
    .min(1, 'Informe a categoria.')
    .max(120, 'Use até 120 caracteres.'),
  periodicidade_semanal: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)),
      'Informe uma periodicidade inteira e positiva.',
    ),
});
export type PlanForm = z.infer<typeof planSchema>;
export const emptyPlan: PlanForm = {
  nome: '',
  categoria: '',
  periodicidade_semanal: '1',
};
export const basketSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome da cesta.')
    .max(150, 'Use até 150 caracteres.'),
});
export function planInput(values: PlanForm) {
  const parsed = planSchema.parse(values);
  return {
    ...parsed,
    periodicidade_semanal: Number(parsed.periodicidade_semanal),
  };
}
export function validPlanId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}
function problem(code: string, details?: unknown) {
  return Object.assign(new Error(code), { code, details });
}
function requireId(id: number) {
  if (!validPlanId(id)) throw problem('invalid_identifier');
  return id;
}
export function quantityInput(text: string, unit: Product['unit']) {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,3})?$/.test(normalized))
    throw problem('invalid_quantity', {
      quantidade: ['Use de 0,001 a 9999999,999, com até três casas decimais.'],
    });
  const [integer, decimal = ''] = normalized.split('.');
  const fraction = decimal.padEnd(3, '0');
  if (BigInt(integer) * 1000n + BigInt(fraction) <= 0n)
    throw problem('invalid_quantity', {
      quantidade: ['Informe uma quantidade maior que zero.'],
    });
  if (unit === 'unidade' && fraction !== '000')
    throw problem('invalid_quantity', {
      quantidade: ['Produtos por unidade exigem quantidade inteira.'],
    });
  return `${integer.replace(/^0+(?=\d)/, '')}.${fraction}`;
}
type Transport = <T>(
  path: string,
  options?: Omit<RequestOptions, 'accessToken'>,
) => Promise<T>;
function readPlan(plan: Plan): Plan {
  if (
    !plan ||
    !validPlanId(plan.id) ||
    typeof plan.is_ativo !== 'boolean' ||
    typeof plan.valor !== 'string' ||
    !/^\d+\.\d{2}$/.test(plan.valor)
  )
    throw problem('contract_mismatch');
  return plan;
}
export function basketBelongsToPlan(basket: Basket, planId: number | null) {
  return validPlanId(planId) && basket.plano === planId;
}
export function itemBelongsToBasket(item: BasketItem, basketId: number | null) {
  return validPlanId(basketId) && item.cesta === basketId;
}
function readBasket(basket: Basket): Basket {
  if (
    !basket ||
    !validPlanId(basket.id) ||
    !validPlanId(basket.plano) ||
    typeof basket.nome !== 'string' ||
    !Array.isArray(basket.itens) ||
    basket.itens.some(
      (item) =>
        !validPlanId(item.id) ||
        !validPlanId(item.hortalica) ||
        !itemBelongsToBasket(item, basket.id) ||
        typeof item.quantidade !== 'string',
    )
  )
    throw problem('contract_mismatch');
  return basket;
}
function readPage<T extends { count: number; results: unknown[] }>(page: T) {
  if (
    !page ||
    !Number.isSafeInteger(page.count) ||
    page.count < 0 ||
    !Array.isArray(page.results)
  )
    throw problem('contract_mismatch');
  return page;
}
export type PlanCommand =
  | { kind: 'createPlan'; values: PlanForm }
  | { kind: 'updatePlan'; id: number; values: PlanForm }
  | { kind: 'publishPlan'; id: number; active: boolean }
  | { kind: 'removePlan'; id: number }
  | { kind: 'createBasket'; planId: number; nome: string }
  | { kind: 'renameBasket'; id: number; nome: string }
  | { kind: 'removeBasket'; id: number }
  | { kind: 'createItem'; basketId: number; product: Product; quantity: string }
  | { kind: 'updateItem'; id: number; unit: Product['unit']; quantity: string }
  | { kind: 'removeItem'; id: number };
export function createPlanApi(request: Transport) {
  const pageParams = (page: number) =>
    new URLSearchParams({
      page: String(requireId(page)),
      page_size: '20',
      ordering: 'id',
    });
  return {
    async list(search = '', page = 1, signal?: AbortSignal) {
      const params = pageParams(page);
      if (search.trim()) params.set('search', search.trim());
      const response = readPage(
        await request<PlanPage>(`planos/?${params}`, { signal }),
      );
      response.results.forEach(readPlan);
      return response;
    },
    async plan(id: number, signal?: AbortSignal) {
      return readPlan(
        await request<Plan>(`planos/${requireId(id)}/`, { signal }),
      );
    },
    async baskets(planId: number, page = 1, signal?: AbortSignal) {
      const params = pageParams(page);
      params.set('plano', String(requireId(planId)));
      const response = readPage(
        await request<BasketPage>(`cestas/?${params}`, { signal }),
      );
      for (const basket of response.results) {
        readBasket(basket);
        if (!basketBelongsToPlan(basket, planId))
          throw problem('contract_mismatch');
      }
      return response;
    },
    async basket(id: number, signal?: AbortSignal) {
      return readBasket(
        await request<Basket>(`cestas/${requireId(id)}/`, { signal }),
      );
    },
    item(id: number, signal?: AbortSignal) {
      return request<BasketItem>(`itens-cesta/${requireId(id)}/`, { signal });
    },
    product(id: number, signal?: AbortSignal) {
      return request<Product>(`products/${requireId(id)}/`, { signal });
    },
    async execute(
      command: PlanCommand,
      signal?: AbortSignal,
    ): Promise<Plan | Basket | BasketItem | void> {
      switch (command.kind) {
        case 'createPlan':
          return readPlan(
            await request<Plan>('planos/', {
              method: 'POST',
              body: { ...planInput(command.values), is_ativo: false },
              signal,
            }),
          );
        case 'updatePlan':
          return readPlan(
            await request<Plan>(`planos/${requireId(command.id)}/`, {
              method: 'PATCH',
              body: planInput(command.values),
              signal,
            }),
          );
        case 'publishPlan':
          return readPlan(
            await request<Plan>(`planos/${requireId(command.id)}/`, {
              method: 'PATCH',
              body: { is_ativo: command.active },
              signal,
            }),
          );
        case 'removePlan':
          return request<void>(`planos/${requireId(command.id)}/`, {
            method: 'DELETE',
            signal,
          });
        case 'createBasket':
          return request<Basket>('cestas/', {
            method: 'POST',
            body: {
              plano: requireId(command.planId),
              ...basketSchema.parse({ nome: command.nome }),
            },
            signal,
          });
        case 'renameBasket':
          return request<Basket>(`cestas/${requireId(command.id)}/`, {
            method: 'PATCH',
            body: basketSchema.parse({ nome: command.nome }),
            signal,
          });
        case 'removeBasket':
          return request<void>(`cestas/${requireId(command.id)}/`, {
            method: 'DELETE',
            signal,
          });
        case 'createItem':
          return request<BasketItem>('itens-cesta/', {
            method: 'POST',
            body: {
              cesta: requireId(command.basketId),
              hortalica: requireId(command.product.id),
              quantidade: quantityInput(command.quantity, command.product.unit),
            },
            signal,
          });
        case 'updateItem':
          return request<BasketItem>(`itens-cesta/${requireId(command.id)}/`, {
            method: 'PATCH',
            body: { quantidade: quantityInput(command.quantity, command.unit) },
            signal,
          });
        case 'removeItem':
          return request<void>(`itens-cesta/${requireId(command.id)}/`, {
            method: 'DELETE',
            signal,
          });
      }
    },
  };
}
export function planFailure(error: unknown, writing = false) {
  const value = (error && typeof error === 'object' ? error : {}) as {
    status?: number;
    code?: string;
    details?: unknown;
    issues?: { path: PropertyKey[]; message: string }[];
  };
  const fields: Record<string, string> = {};
  const details =
    value.details && typeof value.details === 'object'
      ? (value.details as Record<string, unknown>)
      : {};
  for (const field of [
    'nome',
    'categoria',
    'periodicidade_semanal',
    'quantidade',
    'hortalica',
    'cesta',
    'plano',
  ]) {
    const message = details[field];
    if (typeof message === 'string') fields[field] = message;
    else if (Array.isArray(message))
      fields[field] = message
        .filter((item) => typeof item === 'string')
        .join(' ');
  }
  for (const issue of value.issues ?? [])
    if (typeof issue.path[0] === 'string')
      fields[issue.path[0]] = issue.message;
  const uncertain =
    writing &&
    ([
      'timeout',
      'network_error',
      'invalid_response',
      'contract_mismatch',
    ].includes(value.code ?? '') ||
      (value.status ?? 0) >= 500);
  const conflicts: Record<string, string> = {
    publicacao_cestas_invalidas:
      'Para publicar, o plano precisa de 1 a 7 cestas. Desative antes de alterar uma composição que invalide o plano.',
    publicacao_valor_invalido:
      'O valor total do plano precisa ser positivo. Ajuste a composição ou desative o plano antes de editar.',
    plano_com_assinaturas:
      'Este plano possui assinaturas. Desative a oferta para preservar o histórico.',
    cesta_com_programacoes:
      'Esta cesta possui programações e não pode ser excluída. Você pode desativar o plano.',
    quantidade_fracionada_em_cesta:
      'A unidade do produto mudou. Consulte a composição antes de ajustar quantidades.',
  };
  const canRetry =
    ![401, 403, 404].includes(value.status ?? 0) &&
    ![
      'invalid_identifier',
      'unauthenticated',
      'session_expired',
      'contract_mismatch',
      'cancelled',
    ].includes(value.code ?? '');
  const message = uncertain
    ? 'Não foi possível confirmar a alteração. Consulte os dados atualizados antes de enviar novamente.'
    : value.code === 'contract_mismatch'
      ? 'O serviço de gestão de planos precisa ser atualizado para informar o valor calculado.'
      : (conflicts[value.code ?? ''] ??
        (Object.keys(fields).length
          ? 'Confira os campos indicados.'
          : value.status === 404
            ? 'Este plano, cesta ou item não está disponível. Atualize a consulta.'
            : value.status === 403
              ? 'Sua conta não tem acesso a esta operação.'
              : value.status === 401 ||
                  ['unauthenticated', 'session_expired'].includes(
                    value.code ?? '',
                  )
                ? 'Entre novamente no modo Produtor.'
                : value.code === 'invalid_identifier'
                  ? 'Identificador inválido.'
                  : value.status === 429
                    ? 'Muitas consultas. Aguarde antes de tentar novamente.'
                    : value.status === 409
                      ? 'A composição mudou. Atualize os dados antes de editar.'
                      : value.status === 400
                        ? 'Confira a composição e as quantidades. O produto pode já estar nesta cesta.'
                        : 'Não foi possível consultar ou alterar os planos. Verifique sua conexão e tente novamente.'));
  return { message, fields, uncertain, canRetry };
}
export function planRows<T extends { id: number }>(
  pages: { results: T[] }[] = [],
) {
  return [
    ...new Map(
      pages.flatMap((page) => page.results).map((row) => [row.id, row]),
    ).values(),
  ];
}
export const planKeys = {
  all: (scope: string) => ['private', scope, 'producer-plans'] as const,
};
export function planListOptions(
  api: ReturnType<typeof createPlanApi>,
  scope: string,
  search = '',
) {
  return infiniteQueryOptions({
    queryKey: [...planKeys.all(scope), 'list', search.trim()],
    queryFn: ({ pageParam, signal }) => api.list(search, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) =>
      last.next && last.results.length ? page + 1 : undefined,
    retry: false,
  });
}
export function basketListOptions(
  api: ReturnType<typeof createPlanApi>,
  scope: string,
  id: number,
) {
  return infiniteQueryOptions({
    queryKey: [...planKeys.all(scope), 'baskets', id],
    queryFn: ({ pageParam, signal }) => api.baskets(id, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) =>
      last.next && last.results.length ? page + 1 : undefined,
    retry: false,
  });
}
export function planResourceOptions<T>(
  scope: string,
  resource: 'plan' | 'basket' | 'item' | 'product',
  id: number,
  get: (id: number, signal?: AbortSignal) => Promise<T>,
) {
  return queryOptions({
    queryKey: [...planKeys.all(scope), resource, id],
    queryFn: ({ signal }) => get(id, signal),
    retry: false,
    staleTime: resource === 'product' ? 30_000 : 0,
  });
}
export function createPlanWriter(
  api: ReturnType<typeof createPlanApi>,
  scope: () => string | null,
  invalidate: (scope: string, phase: 'before' | 'after') => Promise<unknown>,
) {
  let flight: AbortController | null = null;
  return {
    get busy() {
      return !!flight;
    },
    cancel() {
      flight?.abort();
    },
    async run(command: PlanCommand) {
      if (flight) throw problem('operation_in_progress');
      const owner = scope();
      if (!owner) throw problem('unauthenticated');
      const controller = new AbortController();
      flight = controller;
      const assertOwner = () => {
        if (controller.signal.aborted || scope() !== owner)
          throw problem('cancelled');
      };
      try {
        await invalidate(owner, 'before');
        assertOwner();
        const result = await api.execute(command, controller.signal);
        assertOwner();
        return result;
      } finally {
        if (scope() === owner) void invalidate(owner, 'after').catch(() => {});
        if (flight === controller) flight = null;
      }
    },
  };
}
