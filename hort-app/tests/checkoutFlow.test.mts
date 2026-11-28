import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ApiError } from '../src/shared/api/http.ts';
import {
  checkoutFieldMessages,
  matchesCheckoutBaskets,
  selectCheckoutDays,
  selectionFrom,
} from '../src/features/subscriptions/checkoutPresentation.ts';
import {
  cancellationFailure,
  createSubscriptionCanceller,
} from '../src/features/subscriptions/cancellation.ts';
import {
  offer,
  subscribeInput,
  cancelledSubscription,
} from './fixtures/mobile-api.mts';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test('seleção e revisão usam IDs reais na ordem das cestas, com dias distintos', () => {
  const days = { 402: 4, 401: 1, 999: 7 };
  assert.deepEqual(selectCheckoutDays(offer, days), subscribeInput);
  const reordered = { ...offer, cestas: [...offer.cestas].reverse() };
  assert.deepEqual(
    selectCheckoutDays(reordered, days).programacoes,
    [...subscribeInput.programacoes].reverse(),
  );
  assert.ok(matchesCheckoutBaskets(reordered, subscribeInput));
  assert.equal(
    matchesCheckoutBaskets(
      { ...offer, cestas: offer.cestas.slice(1) },
      subscribeInput,
    ),
    false,
  );
  assert.equal(
    matchesCheckoutBaskets({ ...offer, id: 999 }, subscribeInput),
    false,
  );
  assert.deepEqual(selectionFrom(null), {});
});
test('falta de dia, dias repetidos, oferta vazia/zero/mais de sete cestas impedem revisão', () => {
  for (const days of [{}, { 401: 1 }, { 401: 1, 402: 1 }, { 401: 1, 402: 8 }])
    assert.throws(() => selectCheckoutDays(offer, days));
  for (const changed of [
    { ...offer, cestas: [] },
    { ...offer, valor: '0.00' },
    { ...offer, valor: 'invalid' },
    {
      ...offer,
      cestas: Array.from({ length: 8 }, (_, index) => ({
        ...offer.cestas[0],
        id: index + 1,
      })),
    },
  ])
    assert.throws(() => selectCheckoutDays(changed, {}));
});
test('revisão preserva precisão de dinheiro e não multiplica pela periodicidade', () => {
  const changed = { ...offer, valor: '99999999.99', periodicidade_semanal: 77 };
  assert.deepEqual(
    selectCheckoutDays(changed, { 401: 1, 402: 4 }),
    subscribeInput,
  );
});
test('erros de campo incluem plano e programação aninhada sem expor campos estranhos', () => {
  assert.deepEqual(
    checkoutFieldMessages({
      plano: ['Indisponível.'],
      programacoes: [{ dia_semana: ['Inválido.'] }, { cesta: ['Ausente.'] }],
      password: 'hidden',
    }),
    ['Plano: Indisponível.', 'Dia da cesta 1: Inválido.', 'Cesta 2: Ausente.'],
  );
  assert.deepEqual(
    checkoutFieldMessages({ programacoes: ['Dias repetidos.'] }),
    ['Programação: Dias repetidos.'],
  );
  assert.deepEqual(checkoutFieldMessages(null), []);
});
test('cancelamento usa endpoint próprio sem payload e confirma somente resposta cancelada', async () => {
  const calls: unknown[] = [];
  const writer = createSubscriptionCanceller(
    async <T,>(path, options) => {
      calls.push({ path, method: options?.method, body: options?.body });
      return cancelledSubscription as T;
    },
    () => 'scope',
  );
  const result = await writer.run(cancelledSubscription.id);
  assert.equal(result.status, 'cancelada');
  assert.deepEqual(calls, [
    {
      path: `assinaturas/${cancelledSubscription.id}/cancelar/`,
      method: 'POST',
      body: undefined,
    },
  ]);
});
test('cancelamento impede ID inválido, ausência de perfil e duplo envio', async () => {
  const gate = deferred<unknown>();
  let calls = 0;
  const writer = createSubscriptionCanceller(
    async <T,>() => {
      calls++;
      return (await gate.promise) as T;
    },
    () => 'scope',
  );
  for (const id of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(writer.run(id));
  const pending = writer.run(cancelledSubscription.id);
  await assert.rejects(
    writer.run(cancelledSubscription.id),
    (error: unknown) => error.code === 'command_busy',
  );
  gate.resolve(cancelledSubscription);
  await pending;
  assert.equal(calls, 1);
  const guest = createSubscriptionCanceller(
    async <T,>() => cancelledSubscription as T,
    () => null,
  );
  await assert.rejects(
    guest.run(1),
    (error: unknown) => error.code === 'unauthenticated',
  );
});
test('resposta tardia de cancelamento é recusada após mudança de sessão ou perda de foco', async () => {
  for (const abort of [false, true]) {
    const gate = deferred<unknown>();
    let scope = 'first';
    const writer = createSubscriptionCanceller(
      async <T,>() => (await gate.promise) as T,
      () => scope,
    );
    const pending = writer.run(cancelledSubscription.id);
    await setImmediate();
    if (abort) writer.cancel();
    else scope = 'other';
    gate.resolve(cancelledSubscription);
    await assert.rejects(
      pending,
      (error: unknown) => error.code === 'cancelled',
    );
  }
});
for (const status of [403, 404, 429, 500])
  test(`cancelamento HTTP ${status} não é repetido automaticamente`, async () => {
    let calls = 0;
    const writer = createSubscriptionCanceller(
      async () => {
        calls++;
        throw new ApiError('test', status, 'http_error');
      },
      () => 'scope',
    );
    await assert.rejects(writer.run(1), (error: unknown) => {
      assert.equal(cancellationFailure(error).uncertain, status >= 500);
      return true;
    });
    assert.equal(calls, 1);
  });
test('cancelamento perdido ou incompatível permanece incerto, sem sucesso antecipado', async () => {
  for (const response of [
    { ...cancelledSubscription, status: 'ativa' },
    { ...cancelledSubscription, id: 9 },
    { ...cancelledSubscription, data_cancelamento: null },
  ]) {
    const writer = createSubscriptionCanceller(
      async <T,>() => response as T,
      () => 'scope',
    );
    await assert.rejects(
      writer.run(cancelledSubscription.id),
      (error: unknown) => {
        assert.equal(cancellationFailure(error).uncertain, true);
        return true;
      },
    );
  }
  assert.equal(
    cancellationFailure(new ApiError('timeout', 0, 'timeout')).uncertain,
    true,
  );
});
