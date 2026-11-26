import { z } from 'zod';
import type { components } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

export type Address = components['schemas']['Endereco'];
export type AddressInput = components['schemas']['EnderecoInput'];
export type AddressPage = components['schemas']['PaginatedEnderecoList'];
const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Preencha este campo.')
    .max(max, `Use até ${max} caracteres.`);
export const addressSchema = z.object({
  rua: required(255),
  bairro: required(120),
  cidade: required(120),
  estado: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Informe a UF com duas letras.')
    .transform((value) => value.toUpperCase()),
});
export const emptyAddress: AddressInput = {
  rua: '',
  bairro: '',
  cidade: '',
  estado: '',
};
export function addressId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
type Transport = <T>(
  path: string,
  options?: Omit<RequestOptions, 'accessToken'>,
) => Promise<T>;
export function createAddressApi(request: Transport) {
  const path = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('Endereço inválido.');
    return `enderecos/${id}/`;
  };
  return {
    list(page = 1, signal?: AbortSignal) {
      if (!Number.isSafeInteger(page) || page < 1)
        throw Error('Página inválida.');
      return request<AddressPage>(`enderecos/?page=${page}&page_size=20`, {
        signal,
      });
    },
    get(id: number, signal?: AbortSignal) {
      return request<Address>(path(id), { signal });
    },
    create(values: AddressInput, signal?: AbortSignal) {
      return request<Address>('enderecos/', {
        method: 'POST',
        body: addressSchema.parse(values),
        signal,
      });
    },
    update(id: number, values: AddressInput, signal?: AbortSignal) {
      return request<Address>(path(id), {
        method: 'PATCH',
        body: addressSchema.parse(values),
        signal,
      });
    },
    remove(id: number, signal?: AbortSignal) {
      return request<void>(path(id), { method: 'DELETE', signal });
    },
  };
}
export function mergeAddresses(current: Address[], incoming: Address[]) {
  return [
    ...new Map(
      [...current, ...incoming].map((item) => [item.id, item]),
    ).values(),
  ];
}
export function addressFailure(
  error: unknown,
  writing = false,
): {
  message: string;
  fields: Partial<Record<keyof AddressInput, string>>;
  missing: boolean;
  uncertain: boolean;
} {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: number; code?: string; details?: unknown })
      : {};
  const details =
    value.details && typeof value.details === 'object'
      ? (value.details as Record<string, unknown>)
      : {};
  const fields: Partial<Record<keyof AddressInput, string>> = {};
  for (const name of ['rua', 'bairro', 'cidade', 'estado'] as const) {
    const item = details[name];
    const message =
      typeof item === 'string'
        ? item
        : Array.isArray(item)
          ? item.filter((part) => typeof part === 'string').join(' ')
          : '';
    if (message) fields[name] = message;
  }
  const uncertain =
    writing &&
    (value.code === 'timeout' ||
      value.code === 'network_error' ||
      (value.status ?? 0) >= 500 ||
      value.code === 'invalid_response');
  return {
    fields,
    missing: value.status === 404,
    uncertain,
    message: uncertain
      ? 'Não foi possível confirmar a alteração. Consulte a lista antes de enviar novamente.'
      : value.status === 404
        ? 'Este endereço não está disponível. Volte à lista para atualizar seus endereços.'
        : value.status === 403
          ? 'Sua conta não tem permissão para esta ação.'
          : value.status === 409
            ? 'Não foi possível alterar este endereço agora. Atualize a lista e tente novamente.'
            : value.status === 429
              ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
              : Object.keys(fields).length
                ? 'Confira os campos indicados.'
                : 'Não foi possível carregar ou salvar o endereço. Verifique sua conexão e tente novamente.',
  };
}
