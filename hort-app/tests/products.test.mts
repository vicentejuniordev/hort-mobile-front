import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import {
  createProductApi,
  createProductWriter,
  emptyProduct,
  listedProducts,
  productFailure,
  productForm,
  productInput,
  productListOptions,
  productSchema,
  type Product,
  type ProductPage,
} from '../src/features/products/model.ts';
import { lettuce } from './fixtures/mobile-api.mts';
const values = {
  ...emptyProduct,
  name: ' Alface ',
  category: 'hortalica',
  price: '2,5',
  stock: '30',
  unit: 'unidade',
};
const page = (
  products: Product[],
  next: string | null = null,
): ProductPage => ({ count: 2, next, previous: null, results: products });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('preço é normalizado sem floats, incluindo zero e o máximo do contrato', () => {
  for (const [input, expected] of [
    ['0', '0.00'],
    ['0,10', '0.10'],
    ['99999999,99', '99999999.99'],
    ['2.5', '2.50'],
    ['2,', '2.00'],
  ])
    assert.equal(productInput({ ...values, price: input }).price, expected);
  assert.equal(productInput(values).name, 'Alface');
  assert.equal(productInput(values).stock, 30);
});
test('valida preço, estoque seguro, nome, categoria e unidade sem aceitar coerção silenciosa', () => {
  for (const price of ['-1', '1.234', '1.234,56', '1e2', '100000000', 'NaN'])
    assert.equal(productSchema.safeParse({ ...values, price }).success, false);
  for (const stock of ['-1', '0.5', '1e2', '9007199254740992', ''])
    assert.equal(productSchema.safeParse({ ...values, stock }).success, false);
  assert.equal(productInput({ ...values, stock: '0' }).stock, 0);
  assert.equal(
    productInput({ ...values, stock: '9007199254740991' }).stock,
    Number.MAX_SAFE_INTEGER,
  );
  for (const invalid of [
    { name: ' ' },
    { name: 'a'.repeat(121) },
    { category: 'inventada' },
    { unit: 'pacote' },
  ])
    assert.equal(
      productSchema.safeParse({ ...values, ...invalid }).success,
      false,
    );
});
test('edição conserva unidade e atividade; payload não grava produtor ou descrição ausente no Figma', async () => {
  const calls: { path: string; options: unknown }[] = [];
  const api = createProductApi(async <T,>(path, options) => {
    calls.push({ path, options });
    return lettuce as T;
  });
  const edited = {
    ...productForm(lettuce),
    is_active: false,
    unit: 'kg',
    name: 'Outra alface',
  };
  await api.create({
    ...values,
    produtor: 999,
    description: 'extra',
  } as typeof values);
  await api.update(lettuce.id, edited);
  await api.remove(lettuce.id);
  assert.equal(calls[0].path, 'products/');
  assert.deepEqual(
    Object.keys((calls[0].options as { body: object }).body).sort(),
    ['category', 'is_active', 'name', 'price', 'stock', 'unit'],
  );
  assert.equal((calls[1].options as { method: string }).method, 'PATCH');
  assert.equal(
    (calls[1].options as { body: { is_active: boolean } }).body.is_active,
    false,
  );
  assert.equal((calls[2].options as { method: string }).method, 'DELETE');
});
test('IDs e páginas inválidos impedem a chamada, busca é codificada e next externo não é seguido', async () => {
  const calls: string[] = [];
  const api = createProductApi(async <T,>(path) => {
    calls.push(path);
    return page([lettuce]) as T;
  });
  for (const id of [0, -1, 1.5, NaN]) assert.throws(() => api.get(id));
  assert.throws(() => api.list('', 0));
  assert.equal(calls.length, 0);
  await api.list(' couve & ervas ', 2);
  const url = new URL(calls[0], 'https://api.example.test/api/v1/');
  assert.equal(url.searchParams.get('search'), 'couve & ervas');
  assert.equal(url.searchParams.get('ordering'), 'name,id');
  assert.equal(url.searchParams.get('page'), '2');
});
test('consulta infinita preserva IDs, deduplica páginas e isola busca e sessão', async () => {
  const client = new QueryClient();
  const paths: string[] = [];
  const updated = { ...lettuce, name: 'Nome atualizado' };
  const api = createProductApi(async <T,>(path) => {
    paths.push(path);
    return (
      paths.length === 1
        ? page([lettuce], 'https://untrusted.example/page')
        : page([updated, { ...lettuce, id: 202 }])
    ) as T;
  });
  const options = productListOptions(api, 'one');
  const observer = new InfiniteQueryObserver(client, options);
  try {
    await observer.fetchNextPage();
    const second = await observer.fetchNextPage();
    assert.equal(second.hasNextPage, false);
    assert.equal(
      new URL(paths[1], 'https://api.example.test').searchParams.get('page'),
      '2',
    );
    assert.deepEqual(
      listedProducts(second.data?.pages).map((p) => p.id),
      [201, 202],
    );
    assert.equal(listedProducts(second.data?.pages)[0].name, 'Nome atualizado');
    assert.notDeepEqual(
      options.queryKey,
      productListOptions(api, 'two').queryKey,
    );
    assert.notDeepEqual(
      options.queryKey,
      productListOptions(api, 'one', 'alface').queryKey,
    );
  } finally {
    observer.destroy();
    client.clear();
  }
});
test('falha de outra página conserva produtos anteriores e só repete por ação explícita', async () => {
  const client = new QueryClient();
  let calls = 0;
  const api = createProductApi(async <T,>() => {
    calls++;
    if (calls === 2) throw { status: 429 };
    return page([lettuce], calls === 1 ? '/?page=2' : null) as T;
  });
  const observer = new InfiniteQueryObserver(
    client,
    productListOptions(api, 'one'),
  );
  try {
    await observer.fetchNextPage();
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.equal(listedProducts(failed.data?.pages).length, 1);
    assert.equal(calls, 2);
    await observer.fetchNextPage();
    assert.equal(calls, 3);
  } finally {
    observer.destroy();
    client.clear();
  }
});
test('erros mostram conflitos úteis, validações por campo e incerteza em escritas', () => {
  const protectedDelete = productFailure(
    { status: 409, code: 'hortalica_em_cesta' },
    true,
  );
  assert.equal(protectedDelete.blocked, true);
  assert.match(protectedDelete.message, /desative/);
  assert.match(
    productFailure({ status: 409, code: 'quantidade_fracionada_em_cesta' })
      .message,
    /fracionadas/,
  );
  assert.deepEqual(
    productFailure({
      status: 400,
      details: { price: ['Preço inválido'], produtor: ['Não editar'] },
    }).fields,
    { price: 'Preço inválido' },
  );
  for (const error of [
    { code: 'timeout' },
    { status: 503 },
    { code: 'network_error' },
    { code: 'invalid_response' },
  ])
    assert.equal(productFailure(error, true).uncertain, true);
  for (const status of [401, 403, 404])
    assert.equal(productFailure({ status }).canRetry, false);
});
test('gravação bloqueia toque duplicado e só confirma após resposta', async () => {
  const response = deferred<Product>();
  let calls = 0;
  const phases: string[] = [];
  const api = createProductApi(async <T,>() => {
    calls++;
    return (await response.promise) as T;
  });
  const writer = createProductWriter(
    api,
    () => 'one',
    async (_scope, phase) => {
      phases.push(phase);
    },
  );
  const pending = writer.run({ kind: 'create', values });
  await assert.rejects(writer.run({ kind: 'create', values }), {
    code: 'operation_in_progress',
  });
  assert.equal(writer.busy, true);
  response.resolve(lettuce);
  assert.equal((await pending)?.id, lettuce.id);
  assert.equal(calls, 1);
  assert.equal(writer.busy, false);
  assert.deepEqual(phases, ['before', 'after']);
});
test('timeout não repete POST e invalida a leitura para reconciliação', async () => {
  let calls = 0;
  const phases: string[] = [];
  const api = createProductApi(async () => {
    calls++;
    throw { code: 'timeout' };
  });
  const writer = createProductWriter(
    api,
    () => 'one',
    async (_scope, phase) => {
      phases.push(phase);
    },
  );
  await assert.rejects(writer.run({ kind: 'create', values }), {
    code: 'timeout',
  });
  assert.equal(calls, 1);
  assert.equal(writer.busy, false);
  assert.deepEqual(phases, ['before', 'after']);
});
test('resposta tardia depois de trocar conta/modo é descartada sem atualizar cache antigo', async () => {
  const response = deferred<Product>();
  let scope: string | null = 'one';
  const phases: string[] = [];
  const writer = createProductWriter(
    createProductApi(async <T,>() => (await response.promise) as T),
    () => scope,
    async (_owner, phase) => {
      phases.push(phase);
    },
  );
  const pending = writer.run({ kind: 'update', id: 201, values });
  await Promise.resolve();
  scope = 'two';
  response.resolve(lettuce);
  await assert.rejects(pending, { code: 'cancelled' });
  assert.deepEqual(phases, ['before']);
  scope = null;
  await assert.rejects(writer.run({ kind: 'create', values }), {
    code: 'unauthenticated',
  });
});
test('cancelamento impede confirmação tardia mesmo quando transporte ignora AbortSignal', async () => {
  const response = deferred<Product>();
  const writer = createProductWriter(
    createProductApi(async <T,>() => (await response.promise) as T),
    () => 'one',
    async () => {},
  );
  const pending = writer.run({ kind: 'update', id: 201, values });
  await Promise.resolve();
  writer.cancel();
  response.resolve(lettuce);
  await assert.rejects(pending, { code: 'cancelled' });
  assert.equal(writer.busy, false);
});
