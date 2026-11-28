import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ApiError, createHttpClient } from '../src/shared/api/http.ts';
import { SessionManager } from '../src/shared/session/manager.ts';
import {
  SubscriptionCheckout,
  type CheckoutPayload,
} from '../src/features/subscriptions/checkout.ts';

type Account = { id: number; email: string; password: string };
type Scenario = { id: number; baskets: number[] };
type Manifest = {
  kind: string;
  accounts: Record<'producer' | 'customer' | 'other', Account>;
  productId: number;
  plans: Record<
    'purchase' | 'seven' | 'empty' | 'eight' | 'zero' | 'history',
    Scenario
  >;
  history: { active: number; cancelled: number };
};
type Receipt = {
  id: number;
  status: string;
  valor_contratado: string;
  programacoes: unknown[];
};
type Checkpoint = {
  kind: string;
  key: string;
  payload: CheckoutPayload;
  receipt: Receipt;
  userId: number;
};
const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    manifest: { type: 'string' },
    checkpoint: { type: 'string' },
    replay: { type: 'boolean', default: false },
    'allow-http': { type: 'boolean', default: false },
  },
});
async function run() {
  if (!values.url || !values.manifest || !values.checkpoint)
    throw new Error(
      'Informe --url, --manifest e --checkpoint; --replay verifica um banco restaurado.',
    );
  const base = new URL(values.url);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !base.pathname.endsWith('/api/v1/') ||
    (base.protocol !== 'https:' &&
      !(
        values['allow-http'] &&
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      ))
  )
    throw new Error(
      'URL inválida: HTTPS obrigatório; --allow-http permite somente loopback.',
    );
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await readFile(values.manifest, 'utf8'));
  } catch {
    throw new Error('Não foi possível ler o manifesto sintético.');
  }
  if (
    manifest.kind !== 'hort-mobile-beta-v1' ||
    !manifest.plans?.purchase?.id ||
    !manifest.productId ||
    !manifest.history?.active ||
    !manifest.history.cancelled ||
    ['producer', 'customer', 'other'].some((role) => {
      const account = manifest.accounts?.[role as keyof Manifest['accounts']];
      return (
        !account ||
        account.email !== `beta-${role}@example.test` ||
        !Number.isSafeInteger(account.id) ||
        typeof account.password !== 'string' ||
        account.password.length < 24
      );
    })
  )
    throw new Error(
      'Use o manifesto privado gerado por seed_mobile_beta em banco descartável.',
    );
  let loseResponse = false;
  let original: Receipt | null = null;
  const http = createHttpClient(
    () => base.toString(),
    async (url, options) => {
      const response = await fetch(url, { ...options, redirect: 'error' });
      if (
        loseResponse &&
        new URL(url.toString()).pathname.endsWith('/assinaturas/') &&
        options?.method === 'POST' &&
        response.status === 201
      ) {
        original = JSON.parse(await response.text()) as Receipt;
        loseResponse = false;
        throw new Error('Simulated lost response after commit');
      }
      return response;
    },
  );
  const accounts = {} as Record<
    'producer' | 'customer' | 'other',
    SessionManager
  >;
  for (const role of ['producer', 'customer', 'other'] as const) {
    const manager = new SessionManager(
      http,
      {
        async read() {
          return null;
        },
        async write() {},
        async clear() {},
      },
      () => base.toString(),
    );
    const account = manifest.accounts[role];
    await manager.signIn(account.email, account.password);
    assert.equal(
      manager.getSnapshot().session?.user.id,
      account.id,
      'Fixture owner mismatch',
    );
    accounts[role] = manager;
  }
  const { producer, customer, other } = accounts;
  const plan = manifest.plans.purchase;
  const current = await producer.request<{ nome: string }>(
    `planos/${plan.id}/`,
  );
  assert.equal(
    current.nome,
    'Beta MOB-23: contratação',
    'Fixture plan mismatch',
  );
  const count = async () =>
    (await customer.request<{ count: number }>('assinaturas/')).count;
  if (values.replay) {
    let checkpoint: Checkpoint;
    try {
      checkpoint = JSON.parse(await readFile(values.checkpoint, 'utf8'));
    } catch {
      throw new Error('Não foi possível ler o checkpoint privado.');
    }
    assert.equal(checkpoint.kind, 'hort-mobile-beta-verified-v1');
    assert.equal(checkpoint.userId, manifest.accounts.customer.id);
    assert.equal(checkpoint.payload.plano, plan.id);
    const before = await count();
    const receipt = await customer.request('assinaturas/', {
      method: 'POST',
      body: checkpoint.payload,
      idempotencyKey: checkpoint.key,
    });
    assert.deepEqual(
      receipt,
      checkpoint.receipt,
      'Restored idempotency receipt differs',
    );
    const detail = await customer.request<Receipt>(
      `assinaturas/${checkpoint.receipt.id}/`,
    );
    assert.equal(detail.status, 'cancelada');
    assert.equal(detail.valor_contratado, checkpoint.receipt.valor_contratado);
    assert.equal(
      detail.programacoes.length,
      checkpoint.payload.programacoes.length,
    );
    assert.equal(await count(), before, 'Restore replay created a duplicate');
    console.log(
      'Restauração aprovada: autenticação, recibo original, cancelamento, programações e replay sem duplicação.',
    );
    return;
  }
  // A fresh fixture and a new checkpoint are required for each mutation rehearsal.
  try {
    await readFile(values.checkpoint);
    throw new Error(
      'O checkpoint já existe; use --replay ou um novo banco de ensaio.',
    );
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
  }
  const before = await count();
  const key = `mob23-${randomUUID()}`;
  const payload: CheckoutPayload = {
    plano: plan.id,
    programacoes: plan.baskets.map((cesta, index) => ({
      cesta,
      dia_semana: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    })),
  };
  async function expectError(
    operation: () => Promise<unknown>,
    status: number,
    code: string,
  ) {
    await assert.rejects(
      operation,
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === status &&
        error.code === code,
    );
  }
  const post = (body: unknown, intentKey = key) =>
    customer.request<Receipt>('assinaturas/', {
      method: 'POST',
      body,
      idempotencyKey: intentKey,
    });
  for (const programacoes of [
    [],
    payload.programacoes.slice(1),
    payload.programacoes.map((entry) => ({ ...entry, dia_semana: 1 })),
    [{ cesta: plan.baskets[0], dia_semana: 0 }, payload.programacoes[1]],
  ])
    await expectError(
      () => post({ plano: plan.id, programacoes }),
      400,
      'validation_error',
    );
  assert.equal(await count(), before);
  for (const scenario of ['empty', 'eight', 'zero'] as const)
    await expectError(
      () =>
        producer.request(`planos/${manifest.plans[scenario].id}/`, {
          method: 'PATCH',
          body: { is_ativo: true },
        }),
      409,
      scenario === 'zero'
        ? 'publicacao_valor_invalido'
        : 'publicacao_cestas_invalidas',
    );
  const seven = await customer.request<{ cestas: unknown[] }>(
    `catalogo-planos/${manifest.plans.seven.id}/`,
  );
  assert.equal(seven.cestas.length, 7);
  const added = await producer.request<{ id: number }>('cestas/', {
    method: 'POST',
    body: { plano: plan.id, nome: 'Beta MOB-23: criada após revisão' },
  });
  await expectError(() => post(payload), 400, 'validation_error');
  await producer.request(`cestas/${added.id}/`, { method: 'DELETE' });
  const catalog = await customer.request<{ valor: string }>(
    `catalogo-planos/${plan.id}/`,
  );
  assert.equal(catalog.valor, '12.50', 'Use a fresh beta fixture');
  let disk: string | null = null;
  const storage = {
    async read() {
      return disk;
    },
    async write(value: string) {
      disk = value;
    },
    async clear() {
      disk = null;
    },
  };
  const build = () =>
    new SubscriptionCheckout(
      storage,
      customer.request,
      () => ({
        api: base.toString(),
        userId: manifest.accounts.customer.id,
        scope: 'beta-customer',
      }),
      () => key,
    );
  const checkout = build();
  await checkout.prepare(payload, plan.baskets);
  await producer.request(`products/${manifest.productId}/`, {
    method: 'PATCH',
    body: { price: '8.00' },
  });
  await expectError(
    () =>
      producer.request(`products/${manifest.productId}/`, {
        method: 'PATCH',
        body: { price: '0.00' },
      }),
    409,
    'publicacao_valor_invalido',
  );
  assert.equal(
    (
      await producer.request<{ price: string }>(
        `products/${manifest.productId}/`,
      )
    ).price,
    '8.00',
  );
  loseResponse = true;
  await expectError(checkout.submit, 0, 'network_error');
  const resumed = build();
  assert.equal((await resumed.restore())?.phase, 'uncertain');
  await producer.request(`planos/${plan.id}/`, {
    method: 'PATCH',
    body: { is_ativo: false },
  });
  await expectError(
    () => customer.request(`catalogo-planos/${plan.id}/`),
    404,
    'not_found',
  );
  const receipt = await resumed.submit();
  assert.equal(
    receipt.valor_contratado,
    '16.00',
    'Final value must come from server, not the reviewed price',
  );
  assert.equal(await count(), before + 1);
  await expectError(
    () =>
      post({ ...payload, programacoes: [...payload.programacoes].reverse() }),
    409,
    'idempotency_conflict',
  );
  await expectError(
    () => post(payload, `mob23-${randomUUID()}`),
    409,
    'plano_inativo',
  );
  await expectError(
    () => other.request(`assinaturas/${receipt.id}/`),
    404,
    'not_found',
  );
  await expectError(
    () =>
      other.request(`assinaturas/${receipt.id}/cancelar/`, { method: 'POST' }),
    404,
    'not_found',
  );
  for (const [name, status] of [
    ['active', 'ativa'],
    ['cancelled', 'cancelada'],
  ] as const)
    assert.equal(
      (
        await customer.request<Receipt>(
          `assinaturas/${manifest.history[name]}/`,
        )
      ).status,
      status,
    );
  const cancelled = await customer.request<Receipt>(
    `assinaturas/${receipt.id}/cancelar/`,
    { method: 'POST' },
  );
  assert.equal(cancelled.status, 'cancelada');
  assert.equal(cancelled.programacoes.length, plan.baskets.length);
  assert.deepEqual(
    await customer.request(`assinaturas/${receipt.id}/cancelar/`, {
      method: 'POST',
    }),
    cancelled,
  );
  assert.deepEqual(await post(payload), original);
  assert.equal(
    (await customer.request<Receipt>(`assinaturas/${receipt.id}/`)).status,
    'cancelada',
  );
  assert.equal(await count(), before + 1);
  await writeFile(
    values.checkpoint,
    JSON.stringify({
      kind: 'hort-mobile-beta-verified-v1',
      key,
      payload,
      receipt: original,
      userId: manifest.accounts.customer.id,
    }) + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    'Fluxo aprovado: 400/409, mudanças de cestas/preço, rollback de oferta, resposta perdida, replay com plano desativado, isolamento e cancelamento. Uma assinatura nova; checkpoint privado salvo.',
  );
}
run().catch((error: unknown) => {
  // Do not print request bodies, credentials or malformed JSON file contents.
  console.error(
    error instanceof ApiError
      ? `Verificação falhou: HTTP ${error.status}, código ${error.code}.`
      : error instanceof assert.AssertionError
        ? 'Verificação falhou: um resultado da API divergiu do cenário esperado. Confira o banco isolado e use uma fixture nova.'
        : error instanceof Error &&
            !['SyntaxError', 'TypeError'].includes(error.name)
          ? error.message
          : 'Verificação falhou: dados de ensaio ou resposta inválidos.',
  );
  process.exitCode = 1;
});
