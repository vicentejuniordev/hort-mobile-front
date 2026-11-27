import { infiniteQueryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import type { components } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

const commandError = (message: string, status: number, code: string) =>
  Object.assign(new Error(message), { status, code });

export type Product = components['schemas']['Product'];
export type ProductPage = components['schemas']['PaginatedProductList'];
export const categories = [
  { value: 'hortalica', label: 'Hortaliça' },
  { value: 'fruta', label: 'Fruta' },
  { value: 'legume', label: 'Legume' },
  { value: 'outro', label: 'Outro' },
] satisfies { value: Product['category']; label: string }[];
export const units = [
  { value: 'kg', label: 'Kg' },
  { value: 'unidade', label: 'Unidade' },
  { value: 'g', label: 'Grama' },
  { value: 'l', label: 'Litro' },
  { value: 'maco', label: 'Maço' },
] satisfies { value: Product['unit']; label: string }[];
export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome.')
    .max(120, 'Use até 120 caracteres.'),
  category: z
    .string()
    .refine(
      (value) => categories.some((item) => item.value === value),
      'Selecione uma categoria.',
    ),
  unit: z
    .string()
    .refine(
      (value) => units.some((item) => item.value === value),
      'Selecione a unidade.',
    ),
  price: z
    .string()
    .trim()
    .regex(
      /^\d{1,8}(?:[,.]\d{0,2})?$/,
      'Informe um preço de 0 a 99999999,99, sem separador de milhares.',
    ),
  stock: z
    .string()
    .trim()
    .refine(
      (value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)),
      'Informe um estoque inteiro, positivo ou zero, dentro do limite suportado.',
    ),
  is_active: z.boolean(),
});
export type ProductForm = z.infer<typeof productSchema>;
export const emptyProduct: ProductForm = {
  name: '',
  category: '',
  unit: 'kg',
  price: '',
  stock: '0',
  is_active: true,
};
export function productInput(input: ProductForm) {
  const value = productSchema.parse(input);
  const [integer, decimal = ''] = value.price.replace(',', '.').split('.');
  return {
    ...value,
    category: value.category as Product['category'],
    unit: value.unit as Product['unit'],
    price: `${integer.replace(/^0+(?=\d)/, '')}.${decimal.padEnd(2, '0')}`,
    stock: Number(value.stock),
  };
}
export function productForm(product: Product): ProductForm {
  return {
    name: product.name,
    category: product.category,
    unit: product.unit,
    price: product.price.replace('.', ','),
    stock: String(product.stock ?? 0),
    is_active: product.is_active ?? true,
  };
}
type Transport = <T>(
  path: string,
  options?: Omit<RequestOptions, 'accessToken'>,
) => Promise<T>;
export function createProductApi(request: Transport) {
  const path = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('Produto inválido.');
    return `products/${id}/`;
  };
  return {
    list(search = '', page = 1, signal?: AbortSignal) {
      if (!Number.isSafeInteger(page) || page < 1)
        throw Error('Página inválida.');
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
        ordering: 'name,id',
      });
      if (search.trim()) params.set('search', search.trim());
      return request<ProductPage>(`products/?${params}`, { signal });
    },
    get(id: number, signal?: AbortSignal) {
      return request<Product>(path(id), { signal });
    },
    create(values: ProductForm, signal?: AbortSignal) {
      return request<Product>('products/', {
        method: 'POST',
        body: productInput(values),
        signal,
      });
    },
    update(id: number, values: ProductForm, signal?: AbortSignal) {
      return request<Product>(path(id), {
        method: 'PATCH',
        body: productInput(values),
        signal,
      });
    },
    remove(id: number, signal?: AbortSignal) {
      return request<void>(path(id), { method: 'DELETE', signal });
    },
  };
}
export const productKeys = {
  all: (scope: string) => ['private', scope, 'products'] as const,
};
export function listedProducts(pages: ProductPage[] = []) {
  return [
    ...new Map(
      pages.flatMap((page) => page.results).map((item) => [item.id, item]),
    ).values(),
  ];
}
export function productListOptions(
  api: ReturnType<typeof createProductApi>,
  scope: string,
  search = '',
) {
  const normalized = search.trim();
  return infiniteQueryOptions({
    queryKey: [...productKeys.all(scope), normalized],
    queryFn: ({ pageParam, signal }) => api.list(normalized, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, _pages, page) =>
      last.next && last.results.length ? page + 1 : undefined,
    retry: false,
  });
}
export function productFailure(error: unknown, writing = false) {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: number; code?: string; details?: unknown })
      : {};
  const details =
    value.details && typeof value.details === 'object'
      ? (value.details as Record<string, unknown>)
      : {};
  const fields: Partial<Record<keyof ProductForm, string>> = {};
  for (const name of Object.keys(emptyProduct) as (keyof ProductForm)[]) {
    const detail = details[name];
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.filter((item) => typeof item === 'string').join(' ')
          : '';
    if (message) fields[name] = message;
  }
  const uncertain =
    writing &&
    (value.code === 'timeout' ||
      value.code === 'network_error' ||
      value.code === 'invalid_response' ||
      (value.status ?? 0) >= 500);
  const missing = value.status === 404;
  const blocked = value.code === 'hortalica_em_cesta';
  const canRetry =
    ![401, 403, 404].includes(value.status ?? 0) &&
    !['unauthenticated', 'session_expired', 'cancelled'].includes(
      value.code ?? '',
    );
  const message = uncertain
    ? 'Não foi possível confirmar a alteração. Consulte seus produtos antes de enviar novamente.'
    : blocked
      ? 'Este produto está vinculado a cestas. Para retirá-lo de venda, edite o produto e desative “Disponível para venda”. Para excluir, remova antes os vínculos com as cestas.'
      : value.code === 'quantidade_fracionada_em_cesta'
        ? 'Há quantidades fracionadas deste produto em cestas. Ajuste essas quantidades antes de mudar a unidade para “Unidade”.'
        : missing
          ? 'Este produto não está mais disponível. Atualize a lista.'
          : value.status === 403
            ? 'Sua conta não tem permissão para esta ação.'
            : value.status === 401 ||
                ['unauthenticated', 'session_expired'].includes(
                  value.code ?? '',
                )
              ? 'Entre novamente para gerenciar seus produtos.'
              : value.status === 429
                ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
                : Object.keys(fields).length
                  ? 'Confira os campos indicados.'
                  : value.status === 409
                    ? 'Não foi possível concluir a alteração. Atualize o produto e tente novamente.'
                    : 'Não foi possível consultar ou alterar os produtos. Verifique sua conexão e tente novamente.';
  return { message, fields, uncertain, missing, blocked, canRetry };
}

export type ProductCommand =
  | { kind: 'create'; values: ProductForm }
  | { kind: 'update'; id: number; values: ProductForm }
  | { kind: 'remove'; id: number };
// A write is never retried automatically. Cancellation cannot undo a server write.
export function createProductWriter(
  api: ReturnType<typeof createProductApi>,
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
    async run(command: ProductCommand) {
      if (flight)
        throw commandError(
          'Alteração em andamento.',
          0,
          'operation_in_progress',
        );
      const owner = scope();
      if (!owner)
        throw commandError('Entre como produtor.', 401, 'unauthenticated');
      const controller = new AbortController();
      flight = controller;
      const assertOwner = () => {
        if (controller.signal.aborted || scope() !== owner)
          throw commandError('Operação cancelada.', 0, 'cancelled');
      };
      let result: Product | void;
      try {
        await invalidate(owner, 'before');
        assertOwner();
        result =
          command.kind === 'create'
            ? await api.create(command.values, controller.signal)
            : command.kind === 'update'
              ? await api.update(command.id, command.values, controller.signal)
              : await api.remove(command.id, controller.signal);
        assertOwner();
      } finally {
        // Mark stale even after an uncertain response, but never populate an old session.
        try {
          if (scope() === owner) await invalidate(owner, 'after');
        } finally {
          if (flight === controller) flight = null;
        }
      }
      assertOwner();
      return result;
    },
  };
}
