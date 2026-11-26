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
  catalogDetailOptions,
  catalogFailure,
  catalogKeys,
  catalogListOptions,
  catalogOffers,
  createCatalogApi,
  nextCatalogPage,
  type CatalogFilters,
} from '../src/features/catalog/model.ts';
import {
  catalogPage1,
  catalogPage2,
  emptyCatalog,
  offer,
  customer,
  loginResponse,
} from './fixtures/mobile-api.mts';
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
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next: Partial<SessionState>) {
      state = { ...state, ...next };
      listeners.forEach((listener) => listener());
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

test('busca é codificada e ordenação recebe desempate por id, usando só o catálogo', async () => {
  const paths: string[] = [];
  const api = createCatalogApi(async <T,>(path) => {
    paths.push(path);
    return catalogPage1 as T;
  });
  await api.list({ search: ' couve & ervas/ç? ', ordering: 'nome' }, 2);
  const url = new URL(paths[0], 'https://api.example.test/api/v1/');
  assert.equal(url.pathname, '/api/v1/catalogo-planos/');
  assert.equal(url.searchParams.get('search'), 'couve & ervas/ç?');
  assert.equal(url.searchParams.get('ordering'), 'nome,id');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('page_size'), '20');
  await api.detail(301);
  assert.equal(paths[1], 'catalogo-planos/301/');
});
test('IDs, páginas e ordenação inválidos não acessam a API', () => {
  let calls = 0;
  const api = createCatalogApi(async <T,>() => {
    calls++;
    return undefined as T;
  });
  for (const value of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => api.list({}, value));
    assert.throws(() => api.detail(value));
  }
  assert.throws(() =>
    api.list({ ordering: 'valor' as CatalogFilters['ordering'] }),
  );
  assert.equal(calls, 0);
});
test('opções reais do hook percorrem páginas e deduplicam IDs sem seguir URL next', async () => {
  const cache = createPrivateQueryCache(source());
  const paths: string[] = [];
  const api = createCatalogApi(async <T,>(path) => {
    paths.push(path);
    return (
      path.includes('page=1&')
        ? catalogPage1
        : {
            ...catalogPage2,
            results: [
              { ...offer, nome: 'Atualizado' },
              ...catalogPage2.results,
            ],
          }
    ) as T;
  });
  const observer = new InfiniteQueryObserver(
    cache.client,
    catalogListOptions(api, '1'),
  );
  try {
    await observer.fetchNextPage();
    const next = await observer.fetchNextPage();
    assert.equal(paths.length, 2);
    assert.ok(paths[1].startsWith('catalogo-planos/?page=2&'));
    assert.deepEqual(
      catalogOffers(next.data!.pages).map((item) => item.id),
      [301, 302],
    );
    assert.equal(catalogOffers(next.data!.pages)[0].nome, 'Atualizado');
    assert.equal(next.hasNextPage, false);
  } finally {
    observer.destroy();
    cache.dispose();
  }
});
test('consulta vazia termina a paginação e preserva valores decimais como strings', async () => {
  const cache = createPrivateQueryCache(source());
  const api = createCatalogApi(async <T,>() => offer as T);
  const data = await cache.client.fetchQuery(
    catalogDetailOptions(api, '1', 301),
  );
  assert.equal(data.valor, '17.50');
  assert.equal(data.cestas[0].itens[0].quantidade, '3.000');
  assert.equal(nextCatalogPage(emptyCatalog, 1), undefined);
  assert.deepEqual(catalogOffers(), []);
  assert.equal(
    nextCatalogPage(
      { ...emptyCatalog, next: 'https://external.invalid/?page=2' },
      1,
    ),
    undefined,
  );
  cache.dispose();
});
test('busca, ordenação, detalhe e sessão têm chaves distintas sem placeholder da lista anterior', async () => {
  assert.deepEqual(
    catalogKeys.list('1', { search: ' alface ' }),
    catalogKeys.list('1', { search: 'alface' }),
  );
  assert.notDeepEqual(catalogKeys.list('1'), catalogKeys.list('2'));
  assert.notDeepEqual(
    catalogKeys.list('1', { ordering: 'nome' }),
    catalogKeys.list('1', { ordering: '-nome' }),
  );
  const cache = createPrivateQueryCache(source());
  const api = createCatalogApi(async <T,>() => catalogPage1 as T);
  await cache.client.fetchInfiniteQuery(
    catalogListOptions(api, '1', { search: 'alface' }),
  );
  assert.equal(
    cache.client.getQueryData(catalogKeys.list('1', { search: 'tomate' })),
    undefined,
  );
  assert.equal(
    cache.client.getQueryData(catalogKeys.detail('1', 301)),
    undefined,
  );
  cache.dispose();
});
test('leituras iguais usam o cache durante staleTime', async () => {
  const cache = createPrivateQueryCache(source());
  let calls = 0;
  const api = createCatalogApi(async <T,>() => {
    calls++;
    return offer as T;
  });
  await cache.client.fetchQuery(catalogDetailOptions(api, '1', 301));
  await cache.client.fetchQuery(catalogDetailOptions(api, '1', 301));
  assert.equal(calls, 1);
  cache.dispose();
});
test('401/403/404/429 e HTML de infraestrutura não causam repetição pela query', async () => {
  for (const status of [401, 403, 404, 429, 503]) {
    const cache = createPrivateQueryCache(source());
    let calls = 0;
    const http = createHttpClient(
      () => 'https://api.example.test/api/v1/',
      async () => {
        calls++;
        return status === 503
          ? new Response('<html>Falha</html>', { status })
          : Response.json(
              {
                error: { message: 'Falha.', code: 'http_error', details: null },
              },
              { status },
            );
      },
    );
    await assert.rejects(
      cache.client.fetchQuery(
        catalogDetailOptions(createCatalogApi(http), '1', 301),
      ),
      (error) => {
        assert.equal(
          catalogFailure(error).kind,
          (
            {
              401: 'auth',
              403: 'forbidden',
              404: 'missing',
              429: 'throttled',
              503: 'unavailable',
            } as Record<number, string>
          )[status],
        );
        return true;
      },
    );
    assert.equal(calls, 1);
    cache.dispose();
  }
});
test('mudança de modo, logout e novo login do mesmo usuário apagam o cache', () => {
  const state = source();
  const cache = createPrivateQueryCache(state);
  const put = () => cache.client.setQueryData(['private', 'example'], offer);
  put();
  state.update({
    session: {
      ...state.getSnapshot().session!,
      user: { ...customer, nome: 'Atualizado' },
    },
  });
  assert.equal(cache.client.getQueryCache().getAll().length, 1);
  state.update({
    session: { ...state.getSnapshot().session!, mode: 'produtor' },
  });
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  put();
  state.update({ session: { ...state.getSnapshot().session!, generation: 2 } });
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  put();
  state.update({ session: null, status: 'anonymous' });
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  assert.equal(privateScope(state.getSnapshot()), null);
  cache.dispose();
});
test('resposta tardia não repopula cache após troca da sessão', async () => {
  const state = source();
  const cache = createPrivateQueryCache(state);
  const pending = deferred<typeof offer>();
  let signal: AbortSignal | undefined;
  const api = createCatalogApi(async <T,>(_path, options) => {
    signal = options?.signal;
    return (await pending.promise) as T;
  });
  const promise = cache.client.fetchQuery(catalogDetailOptions(api, '1', 301));
  const rejected = assert.rejects(promise);
  state.update({ session: null, status: 'anonymous' });
  assert.equal(signal?.aborted, true);
  pending.resolve(offer);
  await rejected;
  await setImmediate();
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  cache.dispose();
});
test('query privada usa refresh centralizado uma vez e logout limpa os resultados', async () => {
  let disk: string | null = null;
  let refreshes = 0,
    catalogCalls = 0;
  const http = createHttpClient(
    () => 'https://api.example.test/api/v1/',
    async (url, options) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/login/')) return Response.json(loginResponse);
      if (path.endsWith('/me/')) return Response.json(customer);
      if (path.endsWith('/refresh/')) {
        refreshes++;
        return Response.json({ access: 'new-access', refresh: 'new-refresh' });
      }
      if (path.endsWith('/logout/')) return new Response(null, { status: 204 });
      catalogCalls++;
      return new Headers(options?.headers).get('Authorization') ===
        'Bearer new-access'
        ? Response.json(offer)
        : Response.json(
            {
              error: {
                message: 'Expirado.',
                code: 'token_not_valid',
                details: null,
              },
            },
            { status: 401 },
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
  const cache = createPrivateQueryCache(manager);
  await manager.signIn(customer.email, 'ExampleOnly!42');
  const before = privateScope(manager.getSnapshot())!;
  await cache.client.fetchQuery(
    catalogDetailOptions(createCatalogApi(manager.request), before, 301),
  );
  assert.equal(refreshes, 1);
  assert.equal(catalogCalls, 2);
  assert.equal(privateScope(manager.getSnapshot()), before);
  assert.equal(cache.client.getQueryCache().getAll().length, 1);
  await manager.signOut();
  assert.equal(cache.client.getQueryCache().getAll().length, 0);
  await manager.signIn(customer.email, 'ExampleOnly!42');
  assert.notEqual(privateScope(manager.getSnapshot()), before);
  cache.dispose();
});

test('erro na próxima página conserva a página anterior e permite nova tentativa explícita', async () => {
  const cache = createPrivateQueryCache(source());
  let fail = true,
    calls = 0;
  const api = createCatalogApi(async <T,>(path) => {
    calls++;
    if (path.includes('page=2&') && fail)
      throw Object.assign(new Error('Sem rede.'), { code: 'network_error' });
    return (path.includes('page=1&') ? catalogPage1 : catalogPage2) as T;
  });
  const observer = new InfiniteQueryObserver(
    cache.client,
    catalogListOptions(api, '1'),
  );
  try {
    await observer.fetchNextPage();
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.equal(failed.data?.pages.length, 1);
    assert.equal(calls, 2);
    fail = false;
    const recovered = await observer.fetchNextPage();
    assert.equal(recovered.data?.pages.length, 2);
    assert.equal(calls, 3);
  } finally {
    observer.destroy();
    cache.dispose();
  }
});

test('ordenação por periodicidade mantém desempate estável', async () => {
  let path = '';
  const api = createCatalogApi(async <T,>(value) => {
    path = value;
    return emptyCatalog as T;
  });
  await api.list({ ordering: 'periodicidade_semanal' });
  assert.equal(
    new URL(path, 'https://api.example.test/').searchParams.get('ordering'),
    'periodicidade_semanal,id',
  );
});
