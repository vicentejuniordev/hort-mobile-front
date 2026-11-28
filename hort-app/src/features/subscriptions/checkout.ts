import type { paths } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';
import type { SessionStorage } from '../../shared/session/manager';

export type CheckoutPayload =
  paths['/api/v1/assinaturas/']['post']['requestBody']['content']['application/json'];
type Response =
  paths['/api/v1/assinaturas/']['post']['responses'][201]['content']['application/json'];
export type CheckoutOwner = { api: string; userId: number; scope: string };
export type CheckoutReceipt = Pick<Response, 'id' | 'valor_contratado'>;
export type CheckoutIntent = {
  version: 1;
  api: string;
  userId: number;
  key: string;
  payload: CheckoutPayload;
  phase: 'ready' | 'uncertain' | 'rejected' | 'confirmed';
  receipt?: CheckoutReceipt;
};
type Transport = <T>(path: string, options?: RequestOptions) => Promise<T>;
const fail = (code: string) => Object.assign(new Error(code), { code });
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
const id = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
function payloadFrom(value: unknown): CheckoutPayload {
  if (
    !record(value) ||
    !id(value.plano) ||
    !Array.isArray(value.programacoes) ||
    !value.programacoes.length ||
    value.programacoes.length > 7
  )
    throw fail('invalid_checkout');
  const days = new Set<number>();
  const baskets = new Set<number>();
  const programacoes = value.programacoes.map((entry: unknown) => {
    if (
      !record(entry) ||
      !id(entry.cesta) ||
      !id(entry.dia_semana) ||
      entry.dia_semana > 7 ||
      days.has(entry.dia_semana) ||
      baskets.has(entry.cesta)
    )
      throw fail('invalid_checkout');
    days.add(entry.dia_semana);
    baskets.add(entry.cesta);
    return {
      cesta: entry.cesta,
      dia_semana: entry.dia_semana as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    };
  });
  return { plano: value.plano, programacoes };
}
export function checkoutPayload(
  value: CheckoutPayload,
  basketIds: readonly number[],
) {
  const payload = payloadFrom(value);
  if (
    basketIds.some((value) => !id(value)) ||
    new Set(basketIds).size !== basketIds.length ||
    basketIds.length !== payload.programacoes.length ||
    payload.programacoes.some((entry) => !basketIds.includes(entry.cesta))
  )
    throw fail('invalid_checkout');
  return payload;
}
const validReceipt = (value: unknown): value is CheckoutReceipt =>
  record(value) &&
  id(value.id) &&
  typeof value.valor_contratado === 'string' &&
  /^\d+\.\d{2}$/.test(value.valor_contratado);
function intentFrom(raw: string): CheckoutIntent {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.version !== 1 ||
      typeof value.api !== 'string' ||
      !id(value.userId) ||
      typeof value.key !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(value.key) ||
      !['ready', 'uncertain', 'rejected', 'confirmed'].includes(
        String(value.phase),
      ) ||
      (value.phase === 'confirmed' && !validReceipt(value.receipt))
    )
      throw Error();
    return {
      version: 1,
      api: value.api,
      userId: value.userId,
      key: value.key,
      payload: payloadFrom(value.payload),
      phase: value.phase as CheckoutIntent['phase'],
      ...(value.phase === 'confirmed' && {
        receipt: value.receipt as CheckoutReceipt,
      }),
    };
  } catch {
    // Never silently replace an unreadable intention: it may already be committed.
    throw fail('checkout_storage_invalid');
  }
}

/** One instance per application: no automatic POSTs, including on restore. */
export class SubscriptionCheckout {
  private flight: Promise<unknown> | null = null;
  private controller: AbortController | null = null;
  private clearing = false;
  private revision = 0;
  private readonly storage: SessionStorage;
  private readonly transport: Transport;
  private readonly owner: () => CheckoutOwner | null;
  private readonly newKey: () => string;
  private readonly changed: (scope: string) => void;
  constructor(
    storage: SessionStorage,
    transport: Transport,
    owner: () => CheckoutOwner | null,
    newKey: () => string,
    changed: (scope: string) => void = () => {},
  ) {
    this.storage = storage;
    this.transport = transport;
    this.owner = owner;
    this.newKey = newKey;
    this.changed = changed;
  }
  async waitUntilIdle() {
    await this.flight?.catch(() => {});
  }
  get busy() {
    return !!this.flight || this.clearing;
  }
  cancel = () => {
    this.revision++;
    this.controller?.abort();
  };
  private exclusive<T>(
    operation: (owner: CheckoutOwner, assert: () => void) => Promise<T>,
  ): Promise<T> {
    if (this.busy) return Promise.reject(fail('checkout_busy'));
    const owner = this.owner();
    if (!owner) return Promise.reject(fail('unauthenticated'));
    const revision = this.revision;
    const assert = () => {
      const current = this.owner();
      if (
        revision !== this.revision ||
        !current ||
        current.scope !== owner.scope ||
        current.api !== owner.api ||
        current.userId !== owner.userId
      )
        throw fail('cancelled');
    };
    const flight = Promise.resolve().then(() => {
      assert();
      return operation(owner, assert);
    });
    this.flight = flight;
    void flight
      .finally(() => {
        if (this.flight === flight) this.flight = null;
      })
      .catch(() => {});
    return flight;
  }
  private async read(owner: CheckoutOwner) {
    let raw: string | null;
    try {
      raw = await this.storage.read();
    } catch {
      throw fail('checkout_storage_error');
    }
    if (!raw || raw === 'null') return null;
    const intent = intentFrom(raw);
    return intent.api === owner.api && intent.userId === owner.userId
      ? intent
      : null;
  }
  private async save(intent: CheckoutIntent) {
    try {
      await this.storage.write(JSON.stringify(intent));
    } catch {
      throw fail('checkout_storage_error');
    }
  }
  restore = () =>
    this.exclusive(async (owner, assert) => {
      const intent = await this.read(owner);
      assert();
      return intent;
    });
  prepare = (
    value: CheckoutPayload,
    basketIds: readonly number[],
    newPurchase = false,
  ) => {
    // Copy before any await so later form edits cannot mutate the persisted request.
    let payload: CheckoutPayload;
    try {
      payload = checkoutPayload(value, basketIds);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.exclusive(async (owner, assert) => {
      const previous = await this.read(owner);
      assert();
      const same =
        previous &&
        JSON.stringify(previous.payload) === JSON.stringify(payload);
      if (previous?.phase === 'uncertain' && (!same || newPurchase))
        throw fail('checkout_unresolved');
      if (same && !newPurchase) return previous;
      const key = this.newKey();
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(key) || key === previous?.key)
        throw fail('configuration_error');
      const intent: CheckoutIntent = {
        version: 1,
        api: owner.api,
        userId: owner.userId,
        key,
        payload,
        phase: 'ready',
      };
      await this.save(intent);
      assert();
      return intent;
    });
  };
  submit = () =>
    this.exclusive(async (owner, assert) => {
      const intent = await this.read(owner);
      assert();
      if (!intent) throw fail('checkout_missing');
      if (intent.phase === 'confirmed')
        return { ...intent.receipt!, saved: true };
      const wasUncertain = intent.phase === 'uncertain';
      // Write-ahead marker: crashes and cancellation must resume the same key/body.
      intent.phase = 'uncertain';
      await this.save(intent);
      assert();
      const controller = new AbortController();
      this.controller = controller;
      try {
        const value = await this.transport<Response>('assinaturas/', {
          method: 'POST',
          body: intent.payload,
          idempotencyKey: intent.key,
          signal: controller.signal,
        });
        assert();
        if (
          !validReceipt(value) ||
          value.plano !== intent.payload.plano ||
          !id(value.cliente) ||
          value.status !== 'ativa' ||
          typeof value.data_assinatura !== 'string' ||
          typeof value.data_renovacao !== 'string' ||
          !Array.isArray(value.programacoes) ||
          value.programacoes.length !== intent.payload.programacoes.length ||
          intent.payload.programacoes.some(
            (entry, index) =>
              !value.programacoes.some(
                (schedule) =>
                  schedule.cesta === entry.cesta &&
                  schedule.dia_semana === entry.dia_semana &&
                  schedule.ordem === index + 1 &&
                  schedule.assinatura === value.id,
              ),
          )
        )
          throw fail('contract_mismatch');
        const receipt = {
          id: value.id,
          valor_contratado: value.valor_contratado,
        };
        let saved = true;
        try {
          await this.save({ ...intent, phase: 'confirmed', receipt });
        } catch {
          saved = false;
        }
        assert();
        return { ...receipt, saved };
      } catch (error) {
        assert();
        const status = record(error) ? error.status : undefined;
        const code = record(error) ? error.code : undefined;
        // Only known domain/validation rejections prove no new write was committed.
        if (
          !wasUncertain &&
          code !== 'idempotency_conflict' &&
          code !== 'invalid_response' &&
          [400, 403, 404, 409, 429].includes(Number(status))
        ) {
          try {
            await this.save({ ...intent, phase: 'rejected' });
          } catch {
            /* Keep uncertain marker. */
          }
          assert();
        }
        throw error;
      } finally {
        this.controller = null;
        // Cache work cannot turn a confirmed write into a failed command.
        try {
          if (this.owner()?.scope === owner.scope) this.changed(owner.scope);
        } catch {
          /* Refetch on next focus. */
        }
      }
    });
  /** Explicit sign-out only; temporary expiry must keep recoverable intentions. */
  clear = async () => {
    this.clearing = true;
    this.cancel();
    try {
      await this.flight?.catch(() => {});
      await this.storage.clear();
    } finally {
      this.clearing = false;
    }
  };
}

export function checkoutFailure(error: unknown) {
  const value = record(error) ? error : {};
  const messages: Record<string, string> = {
    checkout_busy: 'Aguarde a tentativa em andamento.',
    checkout_missing: 'Revise a contratação antes de confirmar.',
    invalid_checkout: 'Escolha um dia distinto para cada cesta do plano.',
    checkout_unresolved:
      'Confirme o resultado da tentativa anterior antes de alterar a contratação.',
    checkout_storage_error:
      'Não foi possível guardar a tentativa neste aparelho. Tente novamente antes de contratar.',
    checkout_storage_invalid:
      'A tentativa salva não pôde ser lida. Consulte suas assinaturas antes de iniciar outra contratação.',
    idempotency_conflict:
      'Esta chave está vinculada a outra contratação. Consulte suas assinaturas antes de continuar.',
    plano_inativo: 'Este plano foi desativado. Consulte o catálogo atualizado.',
    publicacao_cestas_invalidas:
      'As cestas desta oferta mudaram. Revise o catálogo.',
    publicacao_valor_invalido:
      'Esta oferta não possui valor válido para contratação.',
  };
  const localRejection = [
    'invalid_checkout',
    'checkout_busy',
    'checkout_missing',
    'configuration_error',
  ].includes(String(value.code));
  const uncertain =
    (!localRejection &&
      ![400, 403, 404, 409, 429].includes(Number(value.status))) ||
    value.code === 'invalid_response' ||
    value.code === 'idempotency_conflict';
  return {
    message:
      messages[String(value.code)] ??
      (uncertain
        ? 'Não foi possível confirmar a contratação. Retome a mesma tentativa para consultar o resultado com segurança.'
        : 'A contratação foi recusada. Revise os dados e tente novamente.'),
    uncertain,
    details: value.details ?? null,
  };
}
