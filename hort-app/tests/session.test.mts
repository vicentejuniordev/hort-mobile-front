import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { ApiError, type RequestOptions } from '../src/shared/api/http.ts';
import {
  SessionManager,
  type SessionStorage,
} from '../src/shared/session/manager.ts';

const identity = () => 'https://api.example.test/api/v1/';
const pair = { access: 'access-old', refresh: 'refresh-old' };
const rotated = { access: 'access-new', refresh: 'refresh-new' };
const user = {
  id: 1,
  nome: 'Pessoa de teste',
  email: 'pessoa@example.test',
  perfis: ['cliente'],
};
const unauthorized = () =>
  new ApiError('Token expirado.', 401, 'token_not_valid');
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  const calls: { path: string; options: RequestOptions }[] = [];
  const disk = {
    value: null as string | null,
    failRead: false,
    failWrite: false,
    failClear: false,
  };
  const storage: SessionStorage = {
    async read() {
      if (disk.failRead) throw Error('read');
      return disk.value;
    },
    async write(value) {
      if (disk.failWrite) throw Error('write');
      disk.value = value;
    },
    async clear() {
      if (disk.failClear) throw Error('clear');
      disk.value = null;
    },
  };
  const fallback = async (
    path: string,
    _options: RequestOptions,
  ): Promise<unknown> => {
    if (path === 'auth/login/') return pair;
    if (path === 'auth/me/') return user;
    if (path === 'auth/refresh/') return rotated;
    if (path === 'auth/logout/') return undefined;
    return { id: 42 };
  };
  let handler = fallback;
  const transport = async <T,>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> => {
    calls.push({ path, options });
    return (await handler(path, options)) as T;
  };
  const manager = new SessionManager(transport, storage, identity);
  return {
    manager,
    disk,
    storage,
    calls,
    transport,
    fallback,
    handle(next: typeof handler) {
      handler = next;
    },
    count(path: string) {
      return calls.filter((call) => call.path === path).length;
    },
    login: () => manager.signIn(user.email, ' Test password!42 '),
  };
}

test('persiste um par completo, sem senha/perfil, e restaura perfis atuais por /me', async () => {
  const h = harness();
  await h.login();
  const saved = JSON.parse(h.disk.value!);
  assert.deepEqual(saved, {
    version: 1,
    api: identity(),
    tokens: pair,
    refreshPending: false,
  });
  assert.ok(
    !h.disk.value!.includes('password') && !h.disk.value!.includes(user.email),
  );
  h.handle(async (path, options) =>
    path === 'auth/me/'
      ? { ...user, perfis: ['produtor'] }
      : h.fallback(path, options),
  );
  const restored = new SessionManager(h.transport, h.storage, identity);
  await Promise.all([restored.bootstrap(), restored.bootstrap()]);
  assert.equal(restored.getSnapshot().status, 'authenticated');
  assert.deepEqual(restored.getSnapshot().session?.user.perfis, ['produtor']);
  assert.equal(h.count('auth/me/'), 2);
});

test('restaura access expirado com uma renovação e persiste os dois novos tokens', async () => {
  const h = harness();
  await h.login();
  h.handle(async (path, options) => {
    if (path === 'auth/me/' && options.accessToken === pair.access)
      throw unauthorized();
    return h.fallback(path, options);
  });
  const restored = new SessionManager(h.transport, h.storage, identity);
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().status, 'authenticated');
  assert.deepEqual(JSON.parse(h.disk.value!).tokens, rotated);
  assert.equal(h.count('auth/refresh/'), 1);
});

test('dez 401 concorrentes compartilham uma renovação, inclusive resposta antiga tardia', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  const late = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/refresh/') {
      entered.resolve();
      await release.promise;
      return rotated;
    }
    if (path === 'late/' && options.accessToken === pair.access) {
      await late.promise;
      throw unauthorized();
    }
    if (options.accessToken === pair.access) throw unauthorized();
    return { id: 42 };
  });
  const delayed = h.manager.request('late/');
  const requests = Array.from({ length: 10 }, () =>
    h.manager.request('private/'),
  );
  await entered.promise;
  assert.equal(JSON.parse(h.disk.value!).refreshPending, true);
  assert.equal(h.count('auth/refresh/'), 1);
  release.resolve();
  await Promise.all(requests);
  late.resolve();
  await delayed;
  assert.equal(h.count('auth/refresh/'), 1);
  assert.equal(h.count('private/'), 20);
  assert.deepEqual(JSON.parse(h.disk.value!).tokens, rotated);
});

for (const status of [403, 409, 429])
  test(`${status} privado não renova nem apaga credenciais`, async () => {
    const h = harness();
    await h.login();
    const saved = h.disk.value;
    h.handle(async () => {
      throw new ApiError('Falha.', status, 'example');
    });
    await assert.rejects(h.manager.request('private/'));
    assert.equal(h.count('auth/refresh/'), 0);
    assert.equal(h.disk.value, saved);
    assert.equal(h.manager.getSnapshot().status, 'authenticated');
  });

test('segundo 401 expira a sessão, sem loop de refresh', async () => {
  const h = harness();
  await h.login();
  h.handle(async (path) => {
    if (path === 'auth/refresh/') return rotated;
    throw unauthorized();
  });
  await assert.rejects(h.manager.request('private/'));
  assert.equal(h.count('auth/refresh/'), 1);
  assert.equal(h.count('private/'), 2);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.equal(h.disk.value, null);
});

test('login rejeitado não passa pela renovação automática', async () => {
  const h = harness();
  h.handle(async () => {
    throw unauthorized();
  });
  await assert.rejects(h.login());
  assert.equal(h.count('auth/login/'), 1);
  assert.equal(h.count('auth/refresh/'), 0);
  assert.equal(h.disk.value, null);
});

test('rede indisponível no bootstrap mantém credenciais e permite tentar novamente', async () => {
  const h = harness();
  await h.login();
  const saved = h.disk.value;
  h.handle(async () => {
    throw new ApiError('Sem conexão.', 0, 'network_error');
  });
  const restored = new SessionManager(h.transport, h.storage, identity);
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().status, 'unavailable');
  assert.equal(h.disk.value, saved);
  h.handle(h.fallback);
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().status, 'authenticated');
});

test('leitura segura falha de modo recuperável e não abre rotas privadas', async () => {
  const h = harness();
  await h.login();
  h.disk.failRead = true;
  const restored = new SessionManager(h.transport, h.storage, identity);
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().status, 'unavailable');
  await assert.rejects(restored.request('private/'));
  h.disk.failRead = false;
  await restored.bootstrap();
  assert.equal(restored.getSnapshot().status, 'authenticated');
});

test('timeout de escrita privada não repete o POST nem remove a sessão', async () => {
  const h = harness();
  await h.login();
  const saved = h.disk.value;
  h.handle(async () => {
    throw new ApiError('Timeout.', 0, 'timeout');
  });
  await assert.rejects(
    h.manager.request('private/', { method: 'POST', body: { test: 1 } }),
  );
  assert.equal(h.count('private/'), 1);
  assert.equal(h.disk.value, saved);
});

test('resposta de refresh perdida exige login e não reutiliza refresh consumido', async () => {
  const h = harness();
  await h.login();
  h.handle(async (path) => {
    if (path === 'auth/refresh/') throw new ApiError('Timeout.', 0, 'timeout');
    throw unauthorized();
  });
  await assert.rejects(h.manager.request('private/'));
  await assert.rejects(h.manager.request('private/'));
  assert.equal(h.count('auth/refresh/'), 1);
  assert.equal(h.disk.value, null);
  assert.match(h.manager.getSnapshot().notice, /renovação/);
});

test('marcador de rotação interrompida e troca de API nunca enviam tokens antigos', async () => {
  for (const value of [
    'invalid json',
    JSON.stringify({
      version: 1,
      api: identity(),
      tokens: pair,
      refreshPending: true,
    }),
    JSON.stringify({
      version: 1,
      api: 'https://another.example.test/api/v1/',
      tokens: pair,
      refreshPending: false,
    }),
  ]) {
    const h = harness();
    h.disk.value = value;
    await h.manager.bootstrap();
    assert.equal(h.calls.length, 0);
    assert.equal(h.disk.value, null);
    assert.equal(h.manager.getSnapshot().status, 'anonymous');
  }
});

test('falha ao gravar marcador impede o envio do refresh; tentar novamente é seguro', async () => {
  const h = harness();
  await h.login();
  const saved = h.disk.value;
  h.disk.failWrite = true;
  h.handle(async (path, options) => {
    if (path === 'private/' && options.accessToken === pair.access)
      throw unauthorized();
    return h.fallback(path, options);
  });
  await assert.rejects(h.manager.request('private/'));
  assert.equal(h.count('auth/refresh/'), 0);
  assert.equal(h.disk.value, saved);
  h.disk.failWrite = false;
  await h.manager.request('private/');
  assert.equal(h.count('auth/refresh/'), 1);
});

test('falha ao persistir par rotacionado remove a sessão incompleta', async () => {
  const h = harness();
  await h.login();
  h.handle(async (path, options) => {
    if (path === 'auth/refresh/') {
      h.disk.failWrite = true;
      return rotated;
    }
    if (options.accessToken === pair.access) throw unauthorized();
    return h.fallback(path, options);
  });
  await assert.rejects(h.manager.request('private/'));
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
});

test('logout global confirma API e remove credenciais, inclusive com access expirado', async () => {
  const h = harness();
  await h.login();
  h.handle(async (path, options) => {
    if (path === 'auth/logout/' && options.accessToken === pair.access)
      throw unauthorized();
    return h.fallback(path, options);
  });
  await h.manager.signOut();
  assert.equal(h.count('auth/refresh/'), 1);
  assert.equal(h.count('auth/logout/'), 2);
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.match(h.manager.getSnapshot().notice, /todos os dispositivos/);
});

test('logout offline informa somente saída local', async () => {
  const h = harness();
  await h.login();
  h.handle(async () => {
    throw new ApiError('Sem conexão.', 0, 'network_error');
  });
  await h.manager.signOut();
  assert.equal(h.disk.value, null);
  assert.match(h.manager.getSnapshot().notice, /apenas deste aparelho/);
});

test('login e leitura privada tardios não restauram a conta após logout', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  h.handle(async (path, options) => {
    if (path === 'private/') {
      entered.resolve();
      await release.promise;
      return { private: true };
    }
    return h.fallback(path, options);
  });
  const pending = h.manager.request('private/').catch((error) => error);
  await entered.promise;
  await h.manager.signOut();
  release.resolve();
  assert.equal((await pending).code, 'cancelled');
  assert.equal(h.disk.value, null);
  const loginEntered = deferred();
  const loginRelease = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/login/') {
      loginEntered.resolve();
      await loginRelease.promise;
      return pair;
    }
    return h.fallback(path, options);
  });
  const login = h.login().catch((error) => error);
  await loginEntered.promise;
  await h.manager.signOut();
  loginRelease.resolve();
  assert.equal((await login).code, 'cancelled');
  assert.equal(h.manager.getSnapshot().session, null);
  assert.equal(h.disk.value, null);
});

test('persistência em andamento termina antes da limpeza do logout', async () => {
  const h = harness();
  const entered = deferred();
  const release = deferred();
  h.storage.write = async (value) => {
    entered.resolve();
    await release.promise;
    h.disk.value = value;
  };
  const login = h.login().catch((error) => error);
  await entered.promise;
  const logout = h.manager.signOut();
  release.resolve();
  await logout;
  assert.equal((await login).code, 'cancelled');
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
});

test('refresh tardio após logout não grava tokens nem repete requisição privada', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/refresh/') {
      entered.resolve();
      await release.promise;
      return rotated;
    }
    if (path === 'private/') throw unauthorized();
    return h.fallback(path, options);
  });
  const request = h.manager.request('private/').catch((error) => error);
  await entered.promise;
  await h.manager.signOut();
  release.resolve();
  assert.equal((await request).code, 'cancelled');
  assert.equal(h.disk.value, null);
  assert.equal(h.count('private/'), 1);
});

test('falha ao limpar credenciais bloqueia acesso até concluir a limpeza', async () => {
  const h = harness();
  await h.login();
  h.disk.failClear = true;
  await assert.rejects(h.manager.signOut());
  assert.equal(h.manager.getSnapshot().status, 'unavailable');
  assert.equal(h.manager.getSnapshot().session, null);
  await assert.rejects(h.login());
  h.disk.failClear = false;
  await h.manager.bootstrap();
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
});

test('cancelamento individual não cancela a renovação compartilhada', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/refresh/') {
      entered.resolve();
      await release.promise;
      return rotated;
    }
    if (options.accessToken === pair.access) throw unauthorized();
    return { id: 42 };
  });
  const controller = new AbortController();
  const cancelled = h.manager
    .request('private/', { signal: controller.signal })
    .catch((error) => error);
  const active = h.manager.request('private/');
  await entered.promise;
  controller.abort();
  release.resolve();
  assert.equal((await cancelled).code, 'cancelled');
  assert.deepEqual(await active, { id: 42 });
  assert.equal(h.count('auth/refresh/'), 1);
  await setImmediate();
});

test('refresh rejeitado por credencial expirada encerra todos os pedidos concorrentes', async () => {
  const h = harness();
  await h.login();
  h.handle(async () => {
    throw unauthorized();
  });
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => h.manager.request('private/')),
  );
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(h.count('auth/refresh/'), 1);
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
});

test('login só tem sucesso depois da persistência segura; falha limpa possíveis restos', async () => {
  const h = harness();
  h.disk.failWrite = true;
  await assert.rejects(h.login());
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.equal(h.disk.value, null);
});

test('resposta da conta anterior não substitui um novo login', async () => {
  const h = harness();
  const entered = deferred();
  const release = deferred();
  const second = {
    ...user,
    id: 2,
    nome: 'Outra pessoa',
    email: 'segunda@example.test',
  };
  h.handle(async (path, options) => {
    if (
      path === 'auth/login/' &&
      (options.body as { email: string }).email === user.email
    ) {
      entered.resolve();
      await release.promise;
      return pair;
    }
    if (path === 'auth/login/') return rotated;
    if (path === 'auth/me/') return second;
    return h.fallback(path, options);
  });
  const first = h.login().catch((error) => error);
  await entered.promise;
  await h.manager.signIn(second.email, 'OtherPassword!42');
  release.resolve();
  assert.equal((await first).code, 'cancelled');
  assert.equal(h.manager.getSnapshot().session?.user.id, 2);
  assert.deepEqual(JSON.parse(h.disk.value!).tokens, rotated);
});

test('bootstrap atrasado não restaura credenciais após uma saída explícita', async () => {
  const h = harness();
  await h.login();
  const saved = h.disk.value;
  const entered = deferred();
  const release = deferred();
  h.storage.read = async () => {
    entered.resolve();
    await release.promise;
    return saved;
  };
  const restored = new SessionManager(h.transport, h.storage, identity);
  const boot = restored.bootstrap();
  await entered.promise;
  const logout = restored.signOut();
  release.resolve();
  await Promise.all([boot, logout]);
  assert.equal(restored.getSnapshot().status, 'anonymous');
  assert.equal(h.disk.value, null);
  assert.equal(h.count('auth/me/'), 1);
});

test('login não começa enquanto a revogação da conta anterior está em andamento', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/logout/') {
      entered.resolve();
      await release.promise;
      return undefined;
    }
    return h.fallback(path, options);
  });
  const logout = h.manager.signOut();
  await entered.promise;
  await assert.rejects(
    h.login(),
    (error: unknown) => (error as { code: string }).code === 'session_busy',
  );
  assert.equal(h.count('auth/login/'), 1);
  release.resolve();
  await logout;
});

test('nova tentativa de limpeza não espera um bootstrap antigo que ignorou cancelamento', async () => {
  const h = harness();
  await h.login();
  const entered = deferred();
  const release = deferred();
  h.handle(async (path, options) => {
    if (path === 'auth/me/') {
      entered.resolve();
      await release.promise;
      return user;
    }
    return h.fallback(path, options);
  });
  const restored = new SessionManager(h.transport, h.storage, identity);
  const oldBoot = restored.bootstrap();
  await entered.promise;
  h.disk.failClear = true;
  await assert.rejects(restored.signOut());
  h.disk.failClear = false;
  const retry = restored.bootstrap();
  await setImmediate();
  assert.equal(restored.getSnapshot().status, 'anonymous');
  release.resolve();
  await Promise.all([oldBoot, retry]);
  assert.equal(restored.getSnapshot().session, null);
  assert.equal(h.disk.value, null);
});

test('redefinição confirmada limpa a sessão local sem chamar logout ou refresh', async () => {
  const h = harness();
  await h.login();
  await h.manager.passwordResetCompleted();
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.equal(h.manager.getSnapshot().session, null);
  assert.equal(h.disk.value, null);
  assert.match(h.manager.getSnapshot().notice, /Senha redefinida/);
  assert.equal(h.count('auth/logout/'), 0);
  assert.equal(h.count('auth/refresh/'), 0);
  await assert.rejects(h.manager.request('auth/me/'));
});
test('redefinição descarta resposta privada tardia e impede restauração anterior', async () => {
  const h = harness();
  await h.login();
  const pending = deferred<unknown>();
  h.handle(async (path) => (path === 'private/' ? pending.promise : user));
  const read = h.manager.request('private/');
  const rejected = assert.rejects(read, { code: 'cancelled' });
  await h.manager.passwordResetCompleted();
  pending.resolve({ id: 99 });
  await rejected;
  await h.manager.bootstrap();
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.equal(h.disk.value, null);
});
test('falha na limpeza após redefinição bloqueia acesso até concluir a recuperação', async () => {
  const h = harness();
  await h.login();
  h.disk.failClear = true;
  await assert.rejects(h.manager.passwordResetCompleted(), {
    code: 'storage_error',
  });
  assert.equal(h.manager.getSnapshot().status, 'unavailable');
  assert.equal(h.manager.getSnapshot().session, null);
  await assert.rejects(h.login(), { code: 'storage_error' });
  h.disk.failClear = false;
  await h.manager.bootstrap();
  assert.equal(h.disk.value, null);
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
});

test('limpeza após redefinição conserva a navegação pública e bloqueia novo acesso até terminar', async () => {
  const h = harness();
  await h.login();
  const pending = deferred();
  h.storage.clear = async () => {
    await pending.promise;
    h.disk.value = null;
  };
  const clearing = h.manager.passwordResetCompleted();
  assert.equal(h.manager.getSnapshot().status, 'anonymous');
  assert.equal(h.manager.getSnapshot().session, null);
  await assert.rejects(h.login(), { code: 'storage_error' });
  await assert.rejects(h.manager.request('auth/me/'), {
    code: 'unauthenticated',
  });
  pending.resolve();
  await clearing;
  await h.login();
  assert.equal(h.manager.getSnapshot().status, 'authenticated');
});
