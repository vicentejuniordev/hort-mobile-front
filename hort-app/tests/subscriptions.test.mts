import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { InfiniteQueryObserver } from '@tanstack/react-query';
import { createHttpClient } from '../src/shared/api/http.ts';
import {
  SessionManager,
  type SessionState,
} from '../src/shared/session/manager.ts';
import {
  createPrivateQueryCache,
  privateScope,
} from '../src/shared/query/cache.ts';
import {
  createSubscriptionApi,
  normalizeScheduleFilters,
  normalizeSubscriptionFilters,
  readRows,
  scheduleDetailOptions,
  scheduleListOptions,
  subscriptionDetailOptions,
  subscriptionFailure,
  subscriptionKeys,
  subscriptionListOptions,
} from '../src/features/subscriptions/model.ts';
import {
  customer,
  inactiveSubscriptionRead as subscription,
  legacySubscriptionRead,
  loginResponse,
} from './fixtures/mobile-api.mts';
const schedule = subscription.programacoes[0];
const page = <T,>(results: T[], next: string | null = null) => ({
  count: 2,
  next,
  previous: null,
  results,
});
function source() {
  let state: SessionState = {
    status: 'authenticated',
    session: { user: customer, mode: 'cliente', generation: 1 },
    error: '',
    notice: '',
  };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    update(next: Partial<SessionState>) {
      state = { ...state, ...next };
      listeners.forEach((fn) => fn());
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('filtros tipados chegam às rotas de leitura, com paginação e ordenação estável', async () => {
  const calls: string[] = [];
  const api = createSubscriptionApi(async <T,>(path, options) => {
    calls.push(path);
    assert.equal(options?.method, undefined);
    assert.equal(options?.body, undefined);
    return (
      path.startsWith('assinaturas') ? page([subscription]) : page([schedule])
    ) as T;
  });
  await api.list(
    {
      status: 'cancelada',
      plano: 301,
      data_renovacao: '2026-12-19',
      ordering: '-valor_contratado',
    },
    2,
  );
  let url = new URL(calls[0], 'https://api.example.test/api/v1/');
  assert.equal(url.pathname, '/api/v1/assinaturas/');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: '2',
    page_size: '20',
    status: 'cancelada',
    plano: '301',
    data_renovacao: '2026-12-19',
    ordering: '-valor_contratado,-id',
  });
  await api.schedules({ assinatura: 601, cesta: 401, dia_semana: 4 });
  url = new URL(calls[1], 'https://api.example.test/api/v1/');
  assert.equal(url.pathname, '/api/v1/entregas-programadas/');
  assert.equal(url.searchParams.get('assinatura'), '601');
  assert.equal(url.searchParams.get('cesta'), '401');
  assert.equal(url.searchParams.get('dia_semana'), '4');
  assert.equal(url.searchParams.get('ordering'), 'dia_semana,id');
});
test('normalização rejeita IDs, dias e datas inválidos antes do transporte', async () => {
  let calls = 0;
  const api = createSubscriptionApi(async <T,>() => {
    calls++;
    return {} as T;
  });
  for (const id of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(api.detail(id), { code: 'invalid_filter' });
    await assert.rejects(api.schedule(id), { code: 'invalid_filter' });
  }
  for (const filters of [
    { status: 'pausada' },
    { plano: 0 },
    { data_renovacao: '2026-02-30' },
    { data_renovacao: '2025-02-29' },
    { data_renovacao: '0000-01-01' },
    { ordering: 'nome' },
  ])
    await assert.rejects(api.list(filters as never), {
      code: 'invalid_filter',
    });
  for (const filters of [
    { assinatura: 0 },
    { cesta: -1 },
    { dia_semana: 0 },
    { dia_semana: 8 },
    { dia_semana: 1.5 },
    { ordering: 'status' },
  ])
    await assert.rejects(api.schedules(filters as never), {
      code: 'invalid_filter',
    });
  await assert.rejects(api.list({}, 0), { code: 'invalid_filter' });
  assert.equal(calls, 0);
  assert.equal(
    normalizeSubscriptionFilters({ data_renovacao: '2028-02-29' })
      .data_renovacao,
    '2028-02-29',
  );
  assert.equal(normalizeScheduleFilters({ dia_semana: 7 }).dia_semana, 7);
});
test('plano desativado preserva valores decimais, composição atual e programação histórica', async () => {
  const api = createSubscriptionApi(async <T,>() => subscription as T);
  const result = await api.detail(601);
  assert.equal(result.plano_atual.is_ativo, false);
  assert.equal(result.valor_contratado, '17.50');
  assert.equal(result.plano_atual.valor, '22.00');
  assert.equal(result.programacoes[0].cesta, 401);
  assert.deepEqual(result, subscription);
  const legacy = createSubscriptionApi(
    async <T,>() => legacySubscriptionRead as T,
  );
  assert.deepEqual((await legacy.detail(601)).programacoes, []);
});
test('contrato antigo ou JSON incompatível falha claramente antes de entrar no cache', async () => {
  const old = { ...subscription };
  delete (old as Partial<typeof old>).plano_atual;
  for (const body of [old, {}, null]) {
    const api = createSubscriptionApi(async <T,>() => body as T);
    await assert.rejects(api.detail(601), { code: 'contract_mismatch' });
  }
  const api = createSubscriptionApi(
    async <T,>() => ({ count: 1, results: [old] }) as T,
  );
  await assert.rejects(api.list(), { code: 'contract_mismatch' });
  const malformedSchedule = createSubscriptionApi(
    async <T,>() => ({ ...schedule, dia_semana: 8 }) as T,
  );
  await assert.rejects(malformedSchedule.schedule(701), {
    code: 'contract_mismatch',
  });
  assert.equal(
    subscriptionFailure({ code: 'contract_mismatch' }).canRetry,
    false,
  );
});
test('listas percorrem páginas sem seguir next externo e deduplicam por ID', async () => {
  for (const kind of ['subscriptions', 'schedules']) {
    const state = source();
    const cache = createPrivateQueryCache(state);
    const calls: string[] = [];
    const api = createSubscriptionApi(async <T,>(path) => {
      calls.push(path);
      const item = kind === 'subscriptions' ? subscription : schedule;
      return (
        calls.length === 1
          ? page([item], 'https://untrusted.example/page')
          : page([item, { ...item, id: 999 }])
      ) as T;
    });
    const options =
      kind === 'subscriptions'
        ? subscriptionListOptions(api, 'one')
        : scheduleListOptions(api, 'one');
    // Each branch has its own typed observer because the resource shapes differ.
    if (kind === 'subscriptions') {
      const observer = new InfiniteQueryObserver(
        cache.client,
        subscriptionListOptions(api, 'one'),
      );
      try {
        await observer.fetchNextPage();
        const result = await observer.fetchNextPage();
        assert.equal(readRows(result.data?.pages).length, 2);
        assert.equal(result.hasNextPage, false);
      } finally {
        observer.destroy();
      }
    } else {
      const observer = new InfiniteQueryObserver(
        cache.client,
        scheduleListOptions(api, 'one'),
      );
      try {
        await observer.fetchNextPage();
        const result = await observer.fetchNextPage();
        assert.equal(readRows(result.data?.pages).length, 2);
        assert.equal(result.hasNextPage, false);
      } finally {
        observer.destroy();
      }
    }
    assert.equal(options.retry, false);
    assert.match(calls[1], /^assinaturas\/|^entregas-programadas\//);
    assert.match(calls[1], /page=2/);
    cache.dispose();
  }
});
test('página vazia encerra paginação e filtros/resources não compartilham chave', async () => {
  const state = source();
  const cache = createPrivateQueryCache(state);
  const api = createSubscriptionApi(async <T,>() => page([], '/?page=2') as T);
  const observer = new InfiniteQueryObserver(
    cache.client,
    subscriptionListOptions(api, 'one'),
  );
  try {
    const result = await observer.fetchNextPage();
    assert.equal(result.hasNextPage, false);
    assert.deepEqual(readRows(result.data?.pages), []);
  } finally {
    observer.destroy();
    cache.dispose();
  }
  assert.notDeepEqual(
    subscriptionKeys.list('one'),
    subscriptionKeys.list('one', { status: 'cancelada' }),
  );
  assert.notDeepEqual(
    subscriptionKeys.schedules('one'),
    subscriptionKeys.schedules('one', { assinatura: 601 }),
  );
  assert.notDeepEqual(
    subscriptionKeys.detail('one', 601),
    subscriptionKeys.schedule('one', 601),
  );
  assert.notDeepEqual(
    subscriptionKeys.list('one'),
    subscriptionKeys.list('two'),
  );
});
test('erro de outra página conserva dados e só repete por nova tentativa', async () => {
  const cache = createPrivateQueryCache(source());
  let calls = 0;
  const api = createSubscriptionApi(async <T,>() => {
    calls++;
    if (calls === 2) throw { status: 429 };
    return page([subscription], calls === 1 ? '/?page=2' : null) as T;
  });
  const observer = new InfiniteQueryObserver(
    cache.client,
    subscriptionListOptions(api, 'one'),
  );
  try {
    await observer.fetchNextPage();
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.equal(readRows(failed.data?.pages).length, 1);
    assert.equal(calls, 2);
    const recovered = await observer.fetchNextPage();
    assert.equal(recovered.isError, false);
    assert.equal(calls, 3);
  } finally {
    observer.destroy();
    cache.dispose();
  }
});
test('cache consulta novamente após invalidar, sem misturar lista e detalhe de programação', async () => {
  const cache = createPrivateQueryCache(source());
  let calls = 0;
  const api = createSubscriptionApi(async <T,>(path) => {
    calls++;
    return (path.startsWith('assinaturas') ? subscription : schedule) as T;
  });
  try {
    await cache.client.fetchQuery(subscriptionDetailOptions(api, 'one', 601));
    await cache.client.fetchQuery(subscriptionDetailOptions(api, 'one', 601));
    assert.equal(calls, 1);
    await cache.client.fetchQuery(scheduleDetailOptions(api, 'one', 601));
    assert.equal(calls, 2);
    await cache.client.invalidateQueries({
      queryKey: subscriptionKeys.all('one'),
    });
    await cache.client.fetchQuery(subscriptionDetailOptions(api, 'one', 601));
    assert.equal(calls, 3);
  } finally {
    cache.dispose();
  }
});
test('troca de conta, modo, geração ou logout remove listas e detalhes privados', async () => {
  for (const change of ['account', 'mode', 'generation', 'logout']) {
    const state = source();
    const cache = createPrivateQueryCache(state);
    const scope = privateScope(state.getSnapshot())!;
    const api = createSubscriptionApi(
      async <T,>(path) =>
        (path.includes('?')
          ? path.startsWith('assinaturas')
            ? page([subscription])
            : page([schedule])
          : path.startsWith('assinaturas')
            ? subscription
            : schedule) as T,
    );
    await Promise.all([
      cache.client.fetchInfiniteQuery(subscriptionListOptions(api, scope)),
      cache.client.fetchInfiniteQuery(scheduleListOptions(api, scope)),
      cache.client.fetchQuery(subscriptionDetailOptions(api, scope, 601)),
      cache.client.fetchQuery(scheduleDetailOptions(api, scope, 701)),
    ]);
    assert.equal(cache.client.getQueryCache().getAll().length, 4);
    const session = state.getSnapshot().session!;
    state.update(
      change === 'logout'
        ? { status: 'anonymous', session: null }
        : {
            session: {
              ...session,
              user:
                change === 'account' ? { ...customer, id: 999 } : session.user,
              mode: change === 'mode' ? 'produtor' : session.mode,
              generation: change === 'generation' ? 2 : session.generation,
            },
          },
    );
    assert.equal(cache.client.getQueryCache().getAll().length, 0);
    cache.dispose();
  }
});
test('resposta tardia de consulta não repopula cache após logout', async () => {
  const state = source();
  const cache = createPrivateQueryCache(state);
  const response = deferred<typeof subscription>();
  let signal: AbortSignal | undefined;
  const api = createSubscriptionApi(async <T,>(_path, options) => {
    signal = options?.signal;
    return (await response.promise) as T;
  });
  const pending = cache.client.fetchQuery(
    subscriptionDetailOptions(api, privateScope(state.getSnapshot())!, 601),
  );
  const rejected = pending.catch((error) => error);
  state.update({ status: 'anonymous', session: null });
  assert.equal(signal?.aborted, true);
  response.resolve(subscription);
  await rejected;
  await setImmediate();
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  cache.dispose();
});
test('401 de assinatura e programação compartilham renovação centralizada', async () => {
  let disk: string | null = null;
  let refreshes = 0;
  const http = createHttpClient(
    () => 'https://api.example.test/api/v1/',
    async (target, options) => {
      const path = new URL(String(target)).pathname;
      if (path.endsWith('/login/')) return Response.json(loginResponse);
      if (path.endsWith('/me/')) return Response.json(customer);
      if (path.endsWith('/refresh/')) {
        refreshes++;
        return Response.json({ access: 'new-access', refresh: 'new-refresh' });
      }
      if (
        new Headers(options?.headers).get('Authorization') !==
        'Bearer new-access'
      )
        return Response.json(
          {
            error: {
              code: 'token_not_valid',
              message: 'Expirado.',
              details: null,
            },
          },
          { status: 401 },
        );
      return Response.json(
        path.includes('entregas-programadas') ? schedule : subscription,
      );
    },
  );
  const manager = new SessionManager(
    http,
    {
      read: async () => disk,
      write: async (value) => {
        disk = value;
      },
      clear: async () => {
        disk = null;
      },
    },
    () => 'https://api.example.test/api/v1/',
  );
  await manager.signIn(customer.email, 'ExampleOnly!42');
  const cache = createPrivateQueryCache(manager);
  const api = createSubscriptionApi(manager.request);
  const scope = privateScope(manager.getSnapshot())!;
  try {
    await Promise.all([
      cache.client.fetchQuery(subscriptionDetailOptions(api, scope, 601)),
      cache.client.fetchQuery(scheduleDetailOptions(api, scope, 701)),
    ]);
    assert.equal(refreshes, 1);
    assert.equal(privateScope(manager.getSnapshot()), scope);
  } finally {
    cache.dispose();
  }
});
test('erros HTTP e de rede são adaptados sem repetição automática', async () => {
  const cache = createPrivateQueryCache(source());
  for (const status of [400, 401, 403, 404, 429, 503]) {
    let calls = 0;
    const api = createSubscriptionApi(async () => {
      calls++;
      throw { status };
    });
    await assert.rejects(
      cache.client.fetchQuery(
        subscriptionDetailOptions(api, String(status), 601),
      ),
    );
    assert.equal(calls, 1);
    assert.equal(
      subscriptionFailure({ status }).canRetry,
      [429, 503].includes(status),
    );
  }
  const http = createHttpClient(
    () => 'https://api.example.test/api/v1/',
    async () => new Response('<html>proxy</html>', { status: 502 }),
  );
  await assert.rejects(createSubscriptionApi(http).detail(601), {
    code: 'invalid_response',
  });
  cache.dispose();
});
