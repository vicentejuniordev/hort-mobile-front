import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpClient,
  type RequestOptions,
} from '../src/shared/api/http.ts';
import {
  addressFailure,
  addressId,
  addressSchema,
  createAddressApi,
  mergeAddresses,
  type AddressInput,
} from '../src/features/addresses/model.ts';
const input = {
  rua: ' Rua das Flores, 123 ',
  bairro: ' Centro ',
  cidade: ' Fortaleza ',
  estado: 'ce',
};
const saved = {
  id: 12,
  rua: 'Rua das Flores, 123',
  bairro: 'Centro',
  cidade: 'Fortaleza',
  estado: 'CE',
};

test('endereço normaliza UF e espaços, respeitando os quatro campos do contrato', () => {
  assert.deepEqual(addressSchema.parse(input), {
    rua: saved.rua,
    bairro: saved.bairro,
    cidade: saved.cidade,
    estado: 'CE',
  });
  assert.equal(
    addressSchema.safeParse({ ...input, estado: 'Ceará' }).success,
    false,
  );
  assert.equal(addressSchema.safeParse({ ...input, rua: ' ' }).success, false);
  assert.equal(
    addressSchema.safeParse({ ...input, rua: 'x'.repeat(256) }).success,
    false,
  );
  assert.equal(
    addressSchema.safeParse({ ...input, bairro: 'x'.repeat(121) }).success,
    false,
  );
  assert.equal(
    addressSchema.safeParse({ ...input, cidade: 'x'.repeat(121) }).success,
    false,
  );
});
test('IDs de links rejeitam listas, frações, negativos e inteiros inseguros', () => {
  assert.equal(addressId('12'), 12);
  for (const value of [
    undefined,
    ['12'],
    '0',
    '-1',
    '01',
    '1.5',
    '1/2',
    '9007199254740992',
  ])
    assert.equal(addressId(value), null);
});
test('CRUD envia métodos e campos corretos; DELETE 204 não exige JSON', async () => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const transport: typeof fetch = async (url, options) => {
    calls.push({
      url: String(url),
      method: options!.method!,
      body: options!.body ? JSON.parse(options!.body as string) : undefined,
    });
    return options!.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json(saved, {
          status: options!.method === 'POST' ? 201 : 200,
        });
  };
  const api = createAddressApi(
    createHttpClient(() => 'https://api.example.test/api/v1/', transport),
  );
  const ownerInput = {
    ...input,
    usuario: 99,
    id: 999,
    cep: '00000000',
  } as AddressInput;
  await api.create(ownerInput);
  await api.update(12, ownerInput);
  await api.get(12);
  await api.remove(12);
  assert.deepEqual(
    calls.map((item) => item.method),
    ['POST', 'PATCH', 'GET', 'DELETE'],
  );
  assert.deepEqual(calls[0].body, {
    rua: saved.rua,
    bairro: saved.bairro,
    cidade: saved.cidade,
    estado: 'CE',
  });
  assert.deepEqual(calls[1].body, calls[0].body);
  assert.equal(calls[3].body, undefined);
  assert.ok(
    calls.slice(1).every((item) => item.url.endsWith('/enderecos/12/')),
  );
});
test('paginação usa páginas locais e mescla IDs repetidos sem duplicação', async () => {
  const paths: string[] = [];
  const api = createAddressApi(async <T,>(path: string) => {
    paths.push(path);
    return {
      count: 21,
      next: 'https://external.invalid/enderecos/?page=2',
      previous: null,
      results: [saved],
    } as T;
  });
  await api.list(1);
  await api.list(2);
  assert.deepEqual(paths, [
    'enderecos/?page=1&page_size=20',
    'enderecos/?page=2&page_size=20',
  ]);
  assert.deepEqual(
    mergeAddresses(
      [saved],
      [
        { ...saved, rua: 'Atualizada' },
        { ...saved, id: 13 },
      ],
    ),
    [
      { ...saved, rua: 'Atualizada' },
      { ...saved, id: 13 },
    ],
  );
});
test('IDs/páginas inválidos não enviam requisições', () => {
  let calls = 0;
  const api = createAddressApi(async <T,>() => {
    calls++;
    return undefined as T;
  });
  for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => api.get(id));
    assert.throws(() => api.update(id, input));
    assert.throws(() => api.remove(id));
    assert.throws(() => api.list(id));
  }
  assert.equal(calls, 0);
});
test('erros 400 voltam aos campos e 403/404/409/429 oferecem mensagens claras', () => {
  const failure = addressFailure(
    {
      status: 400,
      details: {
        rua: ['Rua inválida.'],
        estado: 'UF inválida.',
        usuario: ['Não permitido.'],
      },
    },
    true,
  );
  assert.deepEqual(failure.fields, {
    rua: 'Rua inválida.',
    estado: 'UF inválida.',
  });
  assert.equal(failure.uncertain, false);
  assert.match(addressFailure({ status: 403 }).message, /permissão/);
  assert.equal(addressFailure({ status: 404 }).missing, true);
  assert.match(addressFailure({ status: 409 }).message, /Atualize a lista/);
  assert.match(addressFailure({ status: 429 }).message, /Aguarde/);
});
test('resultado incerto exige consultar a lista; leituras podem ser repetidas', () => {
  for (const error of [
    { code: 'timeout' },
    { code: 'network_error' },
    { code: 'invalid_response' },
    { status: 503 },
  ]) {
    assert.equal(addressFailure(error, true).uncertain, true);
    assert.match(addressFailure(error, true).message, /Consulte a lista/);
    assert.equal(addressFailure(error).uncertain, false);
  }
});
test('PATCH/DELETE com falha não são repetidos pelo transporte HTTP', async () => {
  for (const method of ['PATCH', 'DELETE'] as const) {
    let calls = 0;
    const http = createHttpClient(
      () => 'https://api.example.test/api/v1/',
      async () => {
        calls++;
        return Response.json(
          { error: { code: 'conflict', message: 'Conflito.', details: null } },
          { status: 409 },
        );
      },
    );
    await assert.rejects(
      http('enderecos/12/', {
        method,
        ...(method === 'PATCH' && { body: input }),
      }),
      { status: 409 },
    );
    assert.equal(calls, 1);
  }
});
test('sinal de cancelamento acompanha consultas e mutações', async () => {
  const signals: (AbortSignal | undefined)[] = [];
  const api = createAddressApi(
    async <T,>(_path: string, options?: RequestOptions) => {
      signals.push(options?.signal);
      return saved as T;
    },
  );
  const controller = new AbortController();
  await api.list(1, controller.signal);
  await api.get(12, controller.signal);
  await api.create(input, controller.signal);
  await api.update(12, input, controller.signal);
  await api.remove(12, controller.signal);
  assert.ok(
    signals.length === 5 &&
      signals.every((signal) => signal === controller.signal),
  );
});
