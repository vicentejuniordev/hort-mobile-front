import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import {
  basketBelongsToPlan,
  basketListOptions,
  createPlanApi,
  createPlanWriter,
  itemBelongsToBasket,
  planFailure,
  planInput,
  planListOptions,
  planResourceOptions,
  planRows,
  quantityInput,
  type Basket,
  type Plan,
} from '../src/features/plans/model.ts';
import { lettuce } from './fixtures/mobile-api.mts';
const values = {
  nome: ' Plano ',
  categoria: ' Horta ',
  periodicidade_semanal: '2',
};
const plan = {
  id: 301,
  produtor: 101,
  nome: 'Plano',
  categoria: 'Horta',
  periodicidade_semanal: 2,
  is_ativo: false,
  valor: '7.50',
} satisfies Plan;
const item = {
  id: 501,
  cesta: 401,
  hortalica: lettuce.id,
  quantidade: '3.000',
};
const basket = {
  id: 401,
  plano: plan.id,
  nome: 'Semanal',
  itens: [item],
} satisfies Basket;
const page = <T,>(results: T[], next: string | null = null) => ({
  count: 40,
  results,
  next,
  previous: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}

test('formulário preserva contrato e periodicidade positiva, sem enviar valor, descrição ou disponibilidade', () => {
  assert.deepEqual(
    planInput({ ...values, valor: '999', is_ativo: true } as typeof values),
    { nome: 'Plano', categoria: 'Horta', periodicidade_semanal: 2 },
  );
  for (const number of ['0', '-1', '1.5', '1e2', '9007199254740992', ''])
    assert.throws(() =>
      planInput({ ...values, periodicidade_semanal: number }),
    );
  for (const nome of ['', ' '.repeat(4), 'x'.repeat(151)])
    assert.throws(() => planInput({ ...values, nome }));
});
test('quantidades decimais mantêm precisão, limites e unidade sem float', () => {
  assert.equal(quantityInput('001,125', 'kg'), '1.125');
  assert.equal(quantityInput('0.001', 'maco'), '0.001');
  assert.equal(quantityInput('9999999.999', 'kg'), '9999999.999');
  assert.equal(quantityInput('2,000', 'unidade'), '2.000');
  for (const text of [
    '0',
    '-1',
    '0.000',
    '0.0001',
    '1e2',
    '10000000',
    '1.234,5',
    'NaN',
    '',
    '1.',
  ])
    assert.throws(() => quantityInput(text, 'kg'));
  assert.throws(() => quantityInput('1,500', 'unidade'), {
    code: 'invalid_quantity',
  });
});
test('comandos usam endpoints próprios e não permitem trocar vínculos em edição', async () => {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const api = createPlanApi(async <T,>(path, options) => {
    calls.push({ path, method: options?.method, body: options?.body });
    return (
      path.startsWith('planos')
        ? plan
        : path.startsWith('cestas')
          ? basket
          : item
    ) as T;
  });
  await api.execute({ kind: 'createPlan', values });
  await api.execute({ kind: 'updatePlan', id: 301, values });
  await api.execute({ kind: 'publishPlan', id: 301, active: true });
  await api.execute({ kind: 'createBasket', planId: 301, nome: ' Nova ' });
  await api.execute({ kind: 'renameBasket', id: 401, nome: 'Outra' });
  await api.execute({
    kind: 'createItem',
    basketId: 401,
    product: lettuce,
    quantity: '2',
  });
  await api.execute({
    kind: 'updateItem',
    id: 501,
    unit: 'unidade',
    quantity: '4',
  });
  await api.execute({ kind: 'removeItem', id: 501 });
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      'planos/',
      'planos/301/',
      'planos/301/',
      'cestas/',
      'cestas/401/',
      'itens-cesta/',
      'itens-cesta/501/',
      'itens-cesta/501/',
    ],
  );
  assert.deepEqual(calls[0].body, {
    nome: 'Plano',
    categoria: 'Horta',
    periodicidade_semanal: 2,
    is_ativo: false,
  });
  assert.deepEqual(calls[2].body, { is_ativo: true });
  assert.deepEqual(calls[3].body, { plano: 301, nome: 'Nova' });
  assert.deepEqual(calls[4].body, { nome: 'Outra' });
  assert.deepEqual(calls[5].body, {
    cesta: 401,
    hortalica: lettuce.id,
    quantidade: '2.000',
  });
  assert.deepEqual(calls[6].body, { quantidade: '4.000' });
  assert.equal(calls[7].method, 'DELETE');
});
test('IDs/páginas inválidos não chegam ao transporte, busca e filtro mantêm paginação local', async () => {
  const calls: string[] = [];
  const api = createPlanApi(async <T,>(path) => {
    calls.push(path);
    return page(path.startsWith('planos') ? [plan] : [basket]) as T;
  });
  for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(async () => api.plan(id));
    await assert.rejects(async () => api.baskets(id));
    await assert.rejects(async () => api.execute({ kind: 'removeItem', id }));
    await assert.rejects(async () => api.list('', id));
  }
  assert.equal(calls.length, 0);
  await api.list(' A&B ', 2);
  await api.baskets(301, 3);
  const params = new URL(calls[0], 'https://api.example.test/').searchParams;
  assert.equal(params.get('search'), 'A&B');
  assert.equal(params.get('page'), '2');
  assert.equal(
    new URL(calls[1], 'https://api.example.test/').searchParams.get('plano'),
    '301',
  );
});
test('rotas de composição validam cesta do plano e item da cesta, inclusive IDs coincidentes em recursos diferentes', async () => {
  assert.equal(basketBelongsToPlan(basket, 301), true);
  assert.equal(basketBelongsToPlan(basket, 401), false);
  assert.equal(itemBelongsToBasket(item, 401), true);
  assert.equal(itemBelongsToBasket(item, 501), false);
  const api = createPlanApi(
    async <T,>() => page([{ ...basket, plano: 999 }]) as T,
  );
  await assert.rejects(api.baskets(301), { code: 'contract_mismatch' });
});
test('respostas antigas sem valor calculado são recusadas, sem inventar preço zero', async () => {
  const { valor: _valor, ...old } = plan;
  for (const body of [
    old,
    { ...plan, valor: 7.5 },
    { ...plan, is_ativo: undefined },
  ]) {
    const api = createPlanApi(async <T,>() => body as T);
    await assert.rejects(api.plan(301), { code: 'contract_mismatch' });
  }
  assert.match(
    planFailure({ code: 'contract_mismatch' }).message,
    /serviço.*atualizado/,
  );
});
test('consultas infinitas preservam páginas, deduplicam e não seguem next externo', async () => {
  const calls: string[] = [];
  let failure = true;
  const api = createPlanApi(async <T,>(path) => {
    calls.push(path);
    if (path.includes('page=2') && failure) throw { code: 'network_error' };
    return (
      path.includes('page=1')
        ? page([plan], 'https://evil.example/next')
        : page([
            { ...plan, nome: 'Atual' },
            { ...plan, id: 302 },
          ])
    ) as T;
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const observer = new InfiniteQueryObserver(
    client,
    planListOptions(api, 'owner'),
  );
  try {
    await observer.refetch();
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.equal(planRows(failed.data?.pages).length, 1);
    failure = false;
    const result = await observer.fetchNextPage();
    assert.deepEqual(
      planRows(result.data?.pages).map((row) => row.id),
      [301, 302],
    );
    assert.equal(planRows(result.data?.pages)[0].nome, 'Atual');
    assert.equal(result.hasNextPage, false);
    assert.ok(calls.every((path) => path.startsWith('planos/?')));
    assert.notDeepEqual(
      planListOptions(api, 'owner').queryKey,
      planListOptions(api, 'other').queryKey,
    );
    assert.notDeepEqual(
      basketListOptions(api, 'owner', 301).queryKey,
      basketListOptions(api, 'owner', 302).queryKey,
    );
    assert.notDeepEqual(
      planResourceOptions('owner', 'plan', 301, api.plan).queryKey,
      planResourceOptions('owner', 'basket', 301, api.basket).queryKey,
    );
  } finally {
    observer.destroy();
    client.clear();
  }
});
test('gravação bloqueia duplo toque e só confirma após a resposta', async () => {
  const response = deferred<Plan>();
  let calls = 0;
  const phases: string[] = [];
  const api = createPlanApi(async <T,>() => {
    calls++;
    return (await response.promise) as T;
  });
  const writer = createPlanWriter(
    api,
    () => 'owner',
    async (_scope, phase) => {
      phases.push(phase);
    },
  );
  const pending = writer.run({ kind: 'createPlan', values });
  await assert.rejects(writer.run({ kind: 'createPlan', values }), {
    code: 'operation_in_progress',
  });
  response.resolve(plan);
  assert.equal((await pending)?.id, 301);
  assert.equal(calls, 1);
  assert.deepEqual(phases, ['before', 'after']);
  assert.equal(writer.busy, false);
});
test('timeout não repete POST e invalida dados para reconciliação', async () => {
  let calls = 0;
  const phases: string[] = [];
  const writer = createPlanWriter(
    createPlanApi(async () => {
      calls++;
      throw { code: 'timeout' };
    }),
    () => 'owner',
    async (_scope, phase) => {
      phases.push(phase);
    },
  );
  await assert.rejects(
    writer.run({ kind: 'createBasket', planId: 301, nome: 'Nova' }),
    { code: 'timeout' },
  );
  assert.equal(calls, 1);
  assert.deepEqual(phases, ['before', 'after']);
  assert.equal(planFailure({ code: 'timeout' }, true).uncertain, true);
});
test('troca de conta/modo/geração e cancelamento descartam sucesso tardio', async () => {
  for (const next of ['2:1:produtor', '1:2:produtor', '1:1:cliente', null]) {
    const response = deferred<Plan>();
    let scope: string | null = '1:1:produtor';
    const phases: string[] = [];
    const writer = createPlanWriter(
      createPlanApi(async <T,>() => (await response.promise) as T),
      () => scope,
      async (_scope, phase) => {
        phases.push(phase);
      },
    );
    const pending = writer.run({ kind: 'updatePlan', id: 301, values });
    await Promise.resolve();
    scope = next;
    response.resolve(plan);
    await assert.rejects(pending, { code: 'cancelled' });
    assert.deepEqual(phases, ['before']);
  }
  const response = deferred<Plan>();
  const writer = createPlanWriter(
    createPlanApi(async <T,>() => (await response.promise) as T),
    () => 'owner',
    async () => {},
  );
  const pending = writer.run({ kind: 'createPlan', values });
  await Promise.resolve();
  writer.cancel();
  response.resolve(plan);
  await assert.rejects(pending, { code: 'cancelled' });
});
test('falha ao atualizar consulta depois da gravação não transforma sucesso em falha de comando', async () => {
  const writer = createPlanWriter(
    createPlanApi(async <T,>() => plan as T),
    () => 'owner',
    async (_scope, phase) => {
      if (phase === 'after') throw Error('refresh failed');
    },
  );
  assert.equal((await writer.run({ kind: 'createPlan', values }))?.id, 301);
});
test('conflitos orientam desativação/histórico e erros de campos são preservados', () => {
  for (const code of [
    'publicacao_cestas_invalidas',
    'publicacao_valor_invalido',
    'plano_com_assinaturas',
    'cesta_com_programacoes',
  ])
    assert.match(planFailure({ status: 409, code }).message, /[Dd]esativ/);
  assert.deepEqual(
    planFailure({
      status: 400,
      details: {
        nome: ['Informe o nome'],
        quantidade: ['Inválida'],
        produtor: ['não editar'],
      },
    }).fields,
    { nome: 'Informe o nome', quantidade: 'Inválida' },
  );
  for (const status of [401, 403, 404])
    assert.equal(planFailure({ status }).canRetry, false);
  assert.equal(planFailure({ status: 500 }, true).uncertain, true);
});
