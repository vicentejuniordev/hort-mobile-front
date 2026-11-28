import type { paths } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

type Cancelled =
  paths['/api/v1/assinaturas/{id}/cancelar/']['post']['responses'][200]['content']['application/json'];
type Transport = <T>(path: string, options?: RequestOptions) => Promise<T>;
const failure = (code: string) => Object.assign(new Error(code), { code });
export function createSubscriptionCanceller(
  request: Transport,
  currentScope: () => string | null,
) {
  let busy = false;
  let controller: AbortController | null = null;
  return {
    get busy() {
      return busy;
    },
    cancel() {
      controller?.abort();
    },
    async run(id: number) {
      if (!Number.isSafeInteger(id) || id <= 0)
        throw failure('invalid_identifier');
      if (busy) throw failure('command_busy');
      const scope = currentScope();
      if (!scope) throw failure('unauthenticated');
      busy = true;
      const active = new AbortController();
      controller = active;
      try {
        const value = await request<Cancelled>(`assinaturas/${id}/cancelar/`, {
          method: 'POST',
          signal: active.signal,
        });
        if (active.signal.aborted || scope !== currentScope())
          throw failure('cancelled');
        if (
          !value ||
          value.id !== id ||
          value.status !== 'cancelada' ||
          typeof value.data_cancelamento !== 'string' ||
          !Number.isFinite(Date.parse(value.data_cancelamento)) ||
          typeof value.valor_contratado !== 'string' ||
          !/^\d+\.\d{2}$/.test(value.valor_contratado) ||
          !Array.isArray(value.programacoes)
        )
          throw failure('contract_mismatch');
        return value;
      } finally {
        busy = false;
        controller = null;
      }
    },
  };
}
export function cancellationFailure(error: unknown) {
  const value = (error && typeof error === 'object' ? error : {}) as {
    code?: string;
    status?: number;
  };
  const uncertain =
    value.code === 'invalid_response' ||
    value.code === 'contract_mismatch' ||
    value.code === 'cancelled' ||
    (!value.status &&
      !['invalid_identifier', 'command_busy', 'unauthenticated'].includes(
        value.code ?? '',
      )) ||
    (value.status ?? 0) >= 500;
  return {
    uncertain,
    message: uncertain
      ? 'Não foi possível confirmar o cancelamento. Consulte a situação atual antes de tentar novamente.'
      : value.status === 403
        ? 'Sua conta não tem permissão para cancelar esta assinatura.'
        : value.status === 404
          ? 'Esta assinatura não está disponível para sua conta.'
          : value.status === 429
            ? 'Muitas solicitações. Aguarde antes de tentar novamente.'
            : 'O cancelamento não foi concluído. Tente novamente após revisar a assinatura.',
  };
}
