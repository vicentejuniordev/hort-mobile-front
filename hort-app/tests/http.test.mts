import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createHttpClient } from '../src/shared/api/http.ts';
const base = () => 'https://api.example.test/api/v1/';

test('envia JSON e Bearer apenas quando fornecidos', async () => {
  const calls: RequestInit[] = [];
  const request = createHttpClient(base, async (url, init) => {
    assert.equal(url, 'https://api.example.test/api/v1/auth/login/');
    calls.push(init!);
    return new Response('{"access":"test"}', { status: 200 });
  });
  assert.deepEqual(
    await request('auth/login/', {
      method: 'POST',
      body: { email: 'teste@example.test' },
    }),
    { access: 'test' },
  );
  assert.equal(
    (calls[0].headers as Record<string, string>).Authorization,
    undefined,
  );
  await request('auth/login/', { accessToken: 'test' });
  assert.equal(
    (calls[1].headers as Record<string, string>).Authorization,
    'Bearer test',
  );
});

test('preserva código, status e erros de campo sem repetir escritas', async () => {
  let count = 0;
  const request = createHttpClient(base, async () => {
    count++;
    return new Response(
      JSON.stringify({
        error: {
          code: 'validation_error',
          message: 'Dados inválidos.',
          details: { email: ['Inválido.'] },
        },
      }),
      { status: 400 },
    );
  });
  await assert.rejects(
    request('auth/login/', { method: 'POST', body: {} }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.deepEqual(error.details, { email: ['Inválido.'] });
      return true;
    },
  );
  assert.equal(count, 1);
});

for (const status of [401, 403, 409, 429]) {
  test(`não repete automaticamente uma resposta ${status}`, async () => {
    let count = 0;
    const request = createHttpClient(base, async () => {
      count++;
      return new Response('{}', { status });
    });
    await assert.rejects(
      request('private/'),
      (error: unknown) => error instanceof ApiError && error.status === status,
    );
    assert.equal(count, 1);
  });
}

test('trata HTML de infraestrutura sem expor a resposta', async () => {
  const request = createHttpClient(
    base,
    async () =>
      new Response('<html>internal proxy error</html>', { status: 502 }),
  );
  await assert.rejects(
    request('health/'),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === 'invalid_response' &&
      error.status === 502 &&
      !error.message.includes('proxy'),
  );
});

test('distingue indisponibilidade, timeout e cancelamento', async () => {
  const offline = createHttpClient(base, async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(
    offline('health/'),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'network_error',
  );
  const slow: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error('aborted'));
      else
        init?.signal?.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
    });
  await assert.rejects(
    createHttpClient(base, slow, 5)('health/'),
    (error: unknown) => error instanceof ApiError && error.code === 'timeout',
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    createHttpClient(base, slow)('health/', { signal: controller.signal }),
    (error: unknown) => error instanceof ApiError && error.code === 'cancelled',
  );
});

test('aceita 204 e impede caminhos externos', async () => {
  const request = createHttpClient(
    base,
    async () => new Response(null, { status: 204 }),
  );
  assert.equal(await request('auth/logout/', { method: 'POST' }), undefined);
  await assert.rejects(
    request('https://other.test/'),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'configuration_error',
  );
});
