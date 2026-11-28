import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  ApiError,
  createHttpClient,
  type RequestOptions,
} from '../src/shared/api/http.ts';
import { SessionManager } from '../src/shared/session/manager.ts';
import {
  SubscriptionCheckout,
  checkoutPayload,
  checkoutFailure,
  type CheckoutOwner,
} from '../src/features/subscriptions/checkout.ts';
import {
  subscribeInput,
  subscription,
  customer,
  loginResponse,
} from './fixtures/mobile-api.mts';
const baskets = subscribeInput.programacoes.map((entry) => entry.cesta);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function harness() {
  const disk = {
    value: null as string | null,
    failWrite: false,
    failRead: false,
    failClear: false,
  };
  const storage = {
    async read() {
      if (disk.failRead) throw Error();
      return disk.value;
    },
    async write(value: string) {
      if (disk.failWrite) throw Error();
      disk.value = value;
    },
    async clear() {
      if (disk.failClear) throw Error();
      disk.value = null;
    },
  };
  let owner: CheckoutOwner | null = {
    api: 'https://api.example.test/api/v1/',
    userId: customer.id,
    scope: '1:9:cliente',
  };
  let sequence = 0;
  const calls: RequestOptions[] = [];
  let handler = async (): Promise<unknown> => subscription;
  const transport = async <T,>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> => {
    assert.equal(path, 'assinaturas/');
    assert.ok(disk.value, 'must persist before POST');
    const saved = JSON.parse(disk.value!);
    assert.equal(saved.phase, 'uncertain');
    assert.equal(saved.key, options.idempotencyKey);
    assert.deepEqual(saved.payload, options.body);
    calls.push(structuredClone({ ...options, signal: undefined }));
    return (await handler()) as T;
  };
  const build = () =>
    new SubscriptionCheckout(
      storage,
      transport,
      () => owner,
      () => `key-${++sequence}`,
    );
  const checkout = build();
  return {
    disk,
    storage,
    calls,
    checkout,
    build,
    setOwner(value: CheckoutOwner | null) {
      owner = value;
    },
    getOwner: () => owner,
    setHandler(value: typeof handler) {
      handler = value;
    },
  };
}
const code = (value: string) => (error: unknown) =>
  (error as { code: string }).code === value;

test('valida uma programação por cesta, dias ISO distintos e preserva ordem/payload mínimo', () => {
  assert.deepEqual(checkoutPayload(subscribeInput, baskets), subscribeInput);
  const extra = {
    ...subscribeInput,
    valor: '0.01',
    programacoes: subscribeInput.programacoes.map((entry) => ({
      ...entry,
      ordem: 99,
    })),
  };
  assert.deepEqual(checkoutPayload(extra, baskets), subscribeInput);
  for (const input of [
    { ...subscribeInput, plano: 0 },
    { ...subscribeInput, programacoes: [] },
    { ...subscribeInput, programacoes: [{ cesta: baskets[0], dia_semana: 0 }] },
    { ...subscribeInput, programacoes: [{ cesta: baskets[0], dia_semana: 8 }] },
    {
      ...subscribeInput,
      programacoes: [{ cesta: baskets[0], dia_semana: 1.5 }],
    },
    {
      ...subscribeInput,
      programacoes: [
        { cesta: baskets[0], dia_semana: 1 },
        { cesta: baskets[0], dia_semana: 2 },
      ],
    },
    {
      ...subscribeInput,
      programacoes: [
        { cesta: 1, dia_semana: 1 },
        { cesta: 2, dia_semana: 1 },
      ],
    },
    {
      ...subscribeInput,
      programacoes: Array.from({ length: 8 }, (_, index) => ({
        cesta: index + 1,
        dia_semana: index + 1,
      })),
    },
  ])
    assert.throws(
      () => checkoutPayload(input as typeof subscribeInput, baskets),
      code('invalid_checkout'),
    );
  assert.throws(
    () => checkoutPayload(subscribeInput, [999]),
    code('invalid_checkout'),
  );
  assert.throws(
    () => checkoutPayload(subscribeInput, [...baskets, baskets[0]]),
    code('invalid_checkout'),
  );
});

test('persistência antes de enviar, cópia do formulário e confirmação somente após resposta', async () => {
  const h = harness();
  const draft = structuredClone(subscribeInput);
  const gate = deferred<unknown>();
  h.setHandler(() => gate.promise);
  const pending = h.checkout.prepare(draft, baskets);
  draft.plano = 999;
  const intent = await pending;
  assert.equal(intent!.payload.plano, subscribeInput.plano);
  assert.equal(h.calls.length, 0);
  let done = false;
  const send = h.checkout.submit().then((value) => {
    done = true;
    return value;
  });
  await setImmediate();
  assert.equal(done, false);
  gate.resolve(subscription);
  assert.deepEqual(await send, {
    id: subscription.id,
    valor_contratado: subscription.valor_contratado,
    saved: true,
  });
  assert.equal((await h.checkout.restore())!.phase, 'confirmed');
  await h.checkout.submit();
  assert.equal(
    h.calls.length,
    1,
    'confirmed intent cannot create a second purchase',
  );
});

test('timeout e reinício repetem chave/payload e criam exatamente uma assinatura', async () => {
  const h = harness();
  const writes = new Map<string, unknown>();
  h.setHandler(async () => {
    const key = h.calls.at(-1)!.idempotencyKey!;
    if (!writes.has(key)) {
      writes.set(key, subscription);
      throw new ApiError('timeout', 0, 'timeout');
    }
    return writes.get(key);
  });
  await h.checkout.prepare(subscribeInput, baskets);
  await assert.rejects(h.checkout.submit(), code('timeout'));
  const restarted = h.build();
  assert.equal((await restarted.restore())!.phase, 'uncertain');
  assert.equal(h.calls.length, 1, 'restore never sends');
  await restarted.prepare(subscribeInput, baskets);
  await restarted.submit();
  assert.deepEqual(h.calls[0].body, h.calls[1].body);
  assert.equal(h.calls[0].idempotencyKey, h.calls[1].idempotencyKey);
  assert.equal(writes.size, 1);
});

test('falha de armazenamento impede POST; dados corrompidos não são substituídos', async () => {
  const h = harness();
  h.disk.failWrite = true;
  await assert.rejects(
    h.checkout.prepare(subscribeInput, baskets),
    code('checkout_storage_error'),
  );
  h.disk.failWrite = false;
  await h.checkout.prepare(subscribeInput, baskets);
  h.disk.failWrite = true;
  await assert.rejects(h.checkout.submit(), code('checkout_storage_error'));
  assert.equal(h.calls.length, 0);
  h.disk.failWrite = false;
  h.disk.value = '{broken';
  await assert.rejects(
    h.checkout.prepare(subscribeInput, baskets),
    code('checkout_storage_invalid'),
  );
  assert.equal(h.disk.value, '{broken');
  h.disk.failRead = true;
  await assert.rejects(h.checkout.restore(), code('checkout_storage_error'));
});

test('alteração gera nova chave; tentativa incerta bloqueia substituição, mesmo explícita', async () => {
  const h = harness();
  const first = await h.checkout.prepare(subscribeInput, baskets);
  const changed = { ...subscribeInput, plano: subscribeInput.plano + 1 };
  const second = await h.checkout.prepare(changed, baskets);
  assert.notEqual(first!.key, second!.key);
  h.setHandler(async () => {
    throw new ApiError('offline');
  });
  await assert.rejects(h.checkout.submit());
  await assert.rejects(
    h.checkout.prepare(subscribeInput, baskets),
    code('checkout_unresolved'),
  );
  await assert.rejects(
    h.checkout.prepare(changed, baskets, true),
    code('checkout_unresolved'),
  );
  assert.equal((await h.checkout.restore())!.key, second!.key);
});

test('compra adicional idêntica exige intenção explícita após confirmação', async () => {
  const h = harness();
  const first = await h.checkout.prepare(subscribeInput, baskets);
  await h.checkout.submit();
  assert.equal(
    (await h.checkout.prepare(subscribeInput, baskets))!.phase,
    'confirmed',
  );
  const next = await h.checkout.prepare(subscribeInput, baskets, true);
  assert.notEqual(next!.key, first!.key);
  assert.equal(next!.phase, 'ready');
});

for (const status of [400, 403, 404, 409, 429, 500]) {
  test(`HTTP ${status}: não repete e preserva erro; somente rejeição conhecida permite edição`, async () => {
    const h = harness();
    await h.checkout.prepare(subscribeInput, baskets);
    h.setHandler(async () => {
      throw new ApiError('erro', status, 'validation_error', {
        programacoes: ['inválidas'],
      });
    });
    await assert.rejects(h.checkout.submit(), (error: unknown) => {
      assert.equal((error as ApiError).status, status);
      assert.deepEqual(checkoutFailure(error).details, {
        programacoes: ['inválidas'],
      });
      return true;
    });
    assert.equal(h.calls.length, 1);
    assert.equal(
      (await h.checkout.restore())!.phase,
      status === 500 ? 'uncertain' : 'rejected',
    );
  });
}

test('conflito da chave não libera nova intenção; resposta incompatível continua incerta', async () => {
  const h = harness();
  await h.checkout.prepare(subscribeInput, baskets);
  h.setHandler(async () => {
    throw new ApiError('conflict', 409, 'idempotency_conflict');
  });
  await assert.rejects(h.checkout.submit());
  assert.equal((await h.checkout.restore())!.phase, 'uncertain');
  h.setHandler(async () => ({ ...subscription, plano: 999 }));
  await assert.rejects(h.checkout.submit(), code('contract_mismatch'));
  h.setHandler(async () => ({ ...subscription, programacoes: [] }));
  await assert.rejects(h.checkout.submit(), code('contract_mismatch'));
  assert.equal((await h.checkout.restore())!.phase, 'uncertain');
});

test('duplo envio, cancelamento e resposta tardia não confirmam sucesso', async () => {
  const h = harness();
  const gate = deferred<unknown>();
  h.setHandler(() => gate.promise);
  await h.checkout.prepare(subscribeInput, baskets);
  const pending = h.checkout.submit();
  await assert.rejects(h.checkout.submit(), code('checkout_busy'));
  await setImmediate();
  h.checkout.cancel();
  gate.resolve(subscription);
  await assert.rejects(pending, code('cancelled'));
  assert.equal(h.calls.length, 1);
  assert.equal((await h.checkout.restore())!.phase, 'uncertain');
});

test('isola usuário, API, modo e geração; restaura após novo login do mesmo usuário', async () => {
  const h = harness();
  await h.checkout.prepare(subscribeInput, baskets);
  const owner = h.getOwner()!;
  for (const other of [
    { ...owner, userId: owner.userId + 1 },
    { ...owner, api: 'https://other.test/api/v1/' },
  ]) {
    h.setOwner(other);
    assert.equal(await h.checkout.restore(), null);
    await assert.rejects(h.checkout.submit(), code('checkout_missing'));
  }
  h.setOwner(null);
  await assert.rejects(h.checkout.restore(), code('unauthenticated'));
  h.setOwner({ ...owner, scope: '2:9:cliente' });
  assert.equal((await h.checkout.restore())!.phase, 'ready');
  const gate = deferred<unknown>();
  h.setHandler(() => gate.promise);
  const pending = h.checkout.submit();
  await setImmediate();
  h.setOwner({ ...owner, scope: '2:9:produtor' });
  gate.resolve(subscription);
  await assert.rejects(pending, code('cancelled'));
});

test('confirmação com falha de persistência devolve recibo e mantém replay seguro', async () => {
  const h = harness();
  await h.checkout.prepare(subscribeInput, baskets);
  h.setHandler(async () => {
    h.disk.failWrite = true;
    return subscription;
  });
  assert.equal((await h.checkout.submit()).saved, false);
  assert.equal((await h.checkout.restore())!.phase, 'uncertain');
  h.disk.failWrite = false;
  h.setHandler(async () => subscription);
  await h.checkout.submit();
  assert.equal(h.calls[0].idempotencyKey, h.calls[1].idempotencyKey);
});

test('logout aguarda persistência em andamento e remove intenção sem restauração tardia', async () => {
  const h = harness();
  const gate = deferred<unknown>();
  h.setHandler(() => gate.promise);
  await h.checkout.prepare(subscribeInput, baskets);
  const pending = h.checkout.submit();
  await setImmediate();
  const clear = h.checkout.clear();
  await assert.rejects(
    h.checkout.prepare(subscribeInput, baskets),
    code('checkout_busy'),
  );
  gate.resolve(subscription);
  await assert.rejects(pending, code('cancelled'));
  await clear;
  assert.equal(h.disk.value, null);
});

test('401 renova uma vez e preserva Idempotency-Key e corpo no transporte HTTP real', async () => {
  let posts = 0;
  let refreshes = 0;
  const sent: RequestInit[] = [];
  const transport = createHttpClient(
    () => 'https://api.example.test/api/v1/',
    async (url, init) => {
      if (url.endsWith('auth/login/')) return Response.json(loginResponse);
      if (url.endsWith('auth/me/')) return Response.json(customer);
      if (url.endsWith('auth/refresh/')) {
        refreshes++;
        return Response.json({ access: 'rotated', refresh: 'next' });
      }
      sent.push(init!);
      posts++;
      if (posts === 1) return Response.json({}, { status: 401 });
      return Response.json(subscription, { status: 201 });
    },
  );
  const h = harness();
  const manager = new SessionManager(
    transport,
    {
      async read() {
        return null;
      },
      async write() {},
      async clear() {},
    },
    () => 'https://api.example.test/api/v1/',
  );
  await manager.signIn('test@example.test', 'test-password');
  const checkout = new SubscriptionCheckout(
    h.storage,
    manager.request,
    h.getOwner,
    () => 'unique-key',
  );
  await checkout.prepare(subscribeInput, baskets);
  await checkout.submit();
  assert.equal(refreshes, 1);
  assert.equal(posts, 2);
  assert.equal(sent[0].body, sent[1].body);
  for (const call of sent)
    assert.equal(
      (call.headers as Record<string, string>)['Idempotency-Key'],
      'unique-key',
    );
});

test('limpeza privada falha de forma fechada no logout e é retomada pelo bootstrap', async () => {
  const h = harness();
  let cleanupCalls = 0;
  const manager = new SessionManager(
    async <T,>(path: string): Promise<T> =>
      (path === 'auth/login/'
        ? loginResponse
        : path === 'auth/me/'
          ? customer
          : undefined) as T,
    {
      async read() {
        return null;
      },
      async write() {},
      async clear() {},
    },
    () => 'https://api.example.test/api/v1/',
    async () => {
      cleanupCalls++;
      await h.checkout.clear();
    },
  );
  await manager.signIn('test@example.test', 'test');
  await h.checkout.prepare(subscribeInput, baskets);
  h.disk.failClear = true;
  await assert.rejects(manager.signOut());
  assert.equal(manager.getSnapshot().status, 'unavailable');
  await assert.rejects(manager.signIn('test@example.test', 'test'));
  h.disk.failClear = false;
  await manager.bootstrap();
  assert.equal(cleanupCalls, 2);
  assert.equal(h.disk.value, null);
  assert.equal(manager.getSnapshot().status, 'anonymous');
});

test('rejeição de replay não comprova que tentativa incerta anterior não foi gravada', async () => {
  const h = harness();
  await h.checkout.prepare(subscribeInput, baskets);
  h.setHandler(async () => {
    throw new ApiError('timeout', 0, 'timeout');
  });
  await assert.rejects(h.checkout.submit());
  h.setHandler(async () => {
    throw new ApiError('new server validation', 400, 'validation_error');
  });
  await assert.rejects(h.checkout.submit());
  assert.equal((await h.checkout.restore())!.phase, 'uncertain');
  await assert.rejects(
    h.checkout.prepare(subscribeInput, baskets, true),
    code('checkout_unresolved'),
  );
});

test('expiração temporária não limpa intenção: novo login do mesmo usuário permite replay', async () => {
  const h = harness();
  let expired = false;
  let cleanups = 0;
  const manager = new SessionManager(
    async <T,>(path: string): Promise<T> => {
      if (path === 'auth/login/') return loginResponse as T;
      if (path === 'auth/me/' && !expired) return customer as T;
      throw new ApiError('expired', 401, 'token_not_valid');
    },
    {
      async read() {
        return null;
      },
      async write() {},
      async clear() {},
    },
    () => 'https://api.example.test/api/v1/',
    async () => {
      cleanups++;
      await h.checkout.clear();
    },
  );
  await manager.signIn('test@example.test', 'test');
  await h.checkout.prepare(subscribeInput, baskets);
  h.setHandler(async () => {
    throw new ApiError('timeout', 0, 'timeout');
  });
  await assert.rejects(h.checkout.submit());
  const original = h.disk.value;
  expired = true;
  await assert.rejects(manager.request('assinaturas/'));
  assert.equal(manager.getSnapshot().status, 'anonymous');
  assert.equal(cleanups, 0);
  assert.equal(h.disk.value, original);
  expired = false;
  await manager.signIn('test@example.test', 'test');
  assert.equal(h.disk.value, original);
});

test('logout durante escrita no disco aguarda conclusão antes de limpar', async () => {
  const h = harness();
  const gate = deferred<void>();
  const checkout = new SubscriptionCheckout(
    {
      ...h.storage,
      async write(value) {
        await gate.promise;
        await h.storage.write(value);
      },
    },
    async <T,>() => subscription as T,
    h.getOwner,
    () => 'write-race',
  );
  const pending = checkout.prepare(subscribeInput, baskets);
  await setImmediate();
  const clear = checkout.clear();
  gate.resolve();
  await assert.rejects(pending, code('cancelled'));
  await clear;
  assert.equal(h.disk.value, null);
});
