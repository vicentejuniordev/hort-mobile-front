import type { components } from '../api/generated/schema';
import type { RequestOptions } from '../api/http';

export type User = Omit<components['schemas']['Usuario'], 'perfis'> & {
  perfis: ('cliente' | 'produtor')[];
};
type Tokens = { access: string; refresh: string };
export type SessionState = {
  status:
    'loading' | 'authenticated' | 'anonymous' | 'unavailable' | 'signingOut';
  session: { user: User } | null;
  error: string;
  notice: string;
};
export type SessionStorage = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  clear: () => Promise<void>;
};
type Transport = <T>(path: string, options?: RequestOptions) => Promise<T>;
type PrivateOptions = Omit<RequestOptions, 'accessToken'>;
export class SessionError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}
const cancelled = () => new SessionError('Solicitação cancelada.', 'cancelled');
const storageError = () =>
  new SessionError(
    'Não foi possível atualizar o armazenamento seguro. Tente novamente.',
    'storage_error',
  );
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
const statusOf = (error: unknown) =>
  isRecord(error) ? error.status : undefined;
function tokensFrom(value: unknown): Tokens {
  if (
    !isRecord(value) ||
    typeof value.access !== 'string' ||
    !value.access.trim() ||
    typeof value.refresh !== 'string' ||
    !value.refresh.trim()
  ) {
    throw new SessionError(
      'A API retornou credenciais inválidas.',
      'invalid_response',
    );
  }
  return { access: value.access, refresh: value.refresh };
}
function userFrom(value: unknown): User {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.id) ||
    typeof value.nome !== 'string' ||
    typeof value.email !== 'string' ||
    !Array.isArray(value.perfis) ||
    !value.perfis.every(
      (profile) => profile === 'cliente' || profile === 'produtor',
    )
  ) {
    throw new SessionError(
      'A API retornou uma conta inválida.',
      'invalid_response',
    );
  }
  return {
    id: value.id as number,
    nome: value.nome,
    email: value.email,
    perfis: [...value.perfis],
  };
}

export class SessionManager {
  private state: SessionState = {
    status: 'loading',
    session: null,
    error: '',
    notice: '',
  };
  private listeners = new Set<() => void>();
  private tokens: Tokens | null = null;
  private epoch = 0;
  private controllers = new Set<AbortController>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  private bootstrapFlight: Promise<void> | null = null;
  private refreshFlight: { epoch: number; promise: Promise<void> } | null =
    null;
  private cleanupRequired = false;

  private readonly transport: Transport;
  private readonly storage: SessionStorage;
  private readonly apiIdentity: () => string;
  constructor(
    transport: Transport,
    storage: SessionStorage,
    apiIdentity: () => string,
  ) {
    this.transport = transport;
    this.storage = storage;
    this.apiIdentity = apiIdentity;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  dismissNotice = () => this.update({ notice: '' });
  private update(next: Partial<SessionState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }
  private begin() {
    ++this.epoch;
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
    this.bootstrapFlight = null;
    this.refreshFlight = null;
    return this.epoch;
  }
  private assert(epoch: number) {
    if (epoch !== this.epoch) throw cancelled();
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.storageQueue.then(operation);
    this.storageQueue = next.catch(() => undefined);
    return next;
  }
  private async clear(epoch: number) {
    await this.serialize(async () => {
      this.assert(epoch);
      try {
        await this.storage.clear();
      } catch {
        throw storageError();
      }
      this.assert(epoch);
    });
  }
  private async persist(epoch: number, tokens: Tokens, refreshPending = false) {
    const value = JSON.stringify({
      version: 1,
      api: this.apiIdentity(),
      tokens,
      refreshPending,
    });
    await this.serialize(async () => {
      this.assert(epoch);
      try {
        await this.storage.write(value);
      } catch {
        throw storageError();
      }
      this.assert(epoch);
    });
  }
  private async send<T>(
    epoch: number,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    this.assert(epoch);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    this.controllers.add(controller);
    try {
      if (controller.signal.aborted) throw cancelled();
      const value = await this.transport<T>(path, {
        ...options,
        signal: controller.signal,
      });
      this.assert(epoch);
      if (controller.signal.aborted) throw cancelled();
      return value;
    } catch (error) {
      this.assert(epoch);
      if (controller.signal.aborted) throw cancelled();
      throw error;
    } finally {
      options.signal?.removeEventListener('abort', abort);
      this.controllers.delete(controller);
    }
  }
  private async invalidate(epoch: number, notice: string) {
    this.assert(epoch);
    const next = this.begin();
    this.tokens = null;
    this.update({ status: 'loading', session: null, error: '', notice: '' });
    try {
      await this.clear(next);
      this.cleanupRequired = false;
      this.update({ status: 'anonymous', notice });
    } catch (error) {
      this.assert(next);
      this.cleanupRequired = true;
      this.update({ status: 'unavailable', error: storageError().message });
      throw error;
    }
  }
  bootstrap = (): Promise<void> => {
    if (this.state.status === 'signingOut') return Promise.resolve();
    if (this.bootstrapFlight) return this.bootstrapFlight;
    const run = this.restore();
    this.bootstrapFlight = run;
    void run
      .finally(() => {
        if (this.bootstrapFlight === run) this.bootstrapFlight = null;
      })
      .catch(() => undefined);
    return run;
  };
  private async restore() {
    const epoch = this.begin();
    this.tokens = null;
    this.update({ status: 'loading', session: null, error: '', notice: '' });
    try {
      if (this.cleanupRequired) {
        await this.clear(epoch);
        this.cleanupRequired = false;
        this.update({ status: 'anonymous' });
        return;
      }
      const stored = await this.serialize(async () => {
        this.assert(epoch);
        try {
          return await this.storage.read();
        } catch {
          throw storageError();
        }
      });
      this.assert(epoch);
      if (!stored || stored === 'null') {
        this.update({ status: 'anonymous' });
        return;
      }
      let record: unknown;
      try {
        record = JSON.parse(stored);
      } catch {
        record = null;
      }
      if (
        !isRecord(record) ||
        record.version !== 1 ||
        record.api !== this.apiIdentity() ||
        record.refreshPending !== false
      ) {
        await this.invalidate(epoch, 'Entre novamente para continuar.');
        return;
      }
      try {
        this.tokens = tokensFrom(record.tokens);
      } catch {
        await this.invalidate(epoch, 'Entre novamente para continuar.');
        return;
      }
      const user = userFrom(await this.authorizedRequest('auth/me/'));
      this.assert(epoch);
      this.update({ status: 'authenticated', session: { user } });
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.update({
        status: 'unavailable',
        session: null,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível recuperar sua sessão.',
      });
    }
  }
  signIn = async (email: string, password: string) => {
    if (this.state.status === 'signingOut')
      throw new SessionError(
        'Aguarde o encerramento da sessão.',
        'session_busy',
      );
    if (this.cleanupRequired) throw storageError();
    const epoch = this.begin();
    this.tokens = null;
    this.update({ status: 'anonymous', session: null, error: '', notice: '' });
    try {
      await this.clear(epoch);
    } catch (error) {
      if (epoch === this.epoch) {
        this.cleanupRequired = true;
        this.update({ status: 'unavailable', error: storageError().message });
      }
      throw error;
    }
    const pair = tokensFrom(
      await this.send(epoch, 'auth/login/', {
        method: 'POST',
        body: { email, password } satisfies components['schemas']['Login'],
      }),
    );
    const user = userFrom(
      await this.send(epoch, 'auth/me/', { accessToken: pair.access }),
    );
    try {
      await this.persist(epoch, pair);
    } catch (error) {
      if (epoch === this.epoch)
        await this.invalidate(
          epoch,
          'Não foi possível guardar a sessão. Entre novamente.',
        );
      throw error;
    }
    this.assert(epoch);
    this.tokens = pair;
    this.update({ status: 'authenticated', session: { user } });
  };
  private refresh(epoch: number): Promise<void> {
    this.assert(epoch);
    if (this.refreshFlight?.epoch === epoch) return this.refreshFlight.promise;
    const pair = this.tokens;
    if (!pair) return Promise.reject(cancelled());
    const promise = (async () => {
      // Marcar antes do envio impede reutilizar um refresh consumido se o app fechar.
      await this.persist(epoch, pair, true);
      try {
        const next = tokensFrom(
          await this.send(epoch, 'auth/refresh/', {
            method: 'POST',
            body: { refresh: pair.refresh },
          }),
        );
        await this.persist(epoch, next);
        this.assert(epoch);
        this.tokens = next;
      } catch (error) {
        if (epoch !== this.epoch) throw cancelled();
        const notice =
          statusOf(error) === 401 || statusOf(error) === 400
            ? 'Sua sessão expirou. Entre novamente.'
            : 'Não foi possível confirmar a renovação da sessão. Entre novamente.';
        await this.invalidate(epoch, notice);
        throw new SessionError(notice, 'session_expired');
      }
    })();
    const flight = { epoch, promise };
    this.refreshFlight = flight;
    void promise
      .finally(() => {
        if (this.refreshFlight === flight) this.refreshFlight = null;
      })
      .catch(() => undefined);
    return promise;
  }
  request = <T>(path: string, options: PrivateOptions = {}): Promise<T> => {
    if (this.state.status !== 'authenticated')
      return Promise.reject(
        new SessionError(
          'Entre na sua conta para continuar.',
          'unauthenticated',
        ),
      );
    return this.authorizedRequest<T>(path, options);
  };
  private authorizedRequest = async <T>(
    path: string,
    options: PrivateOptions = {},
  ): Promise<T> => {
    const epoch = this.epoch;
    if (!this.tokens || this.state.status === 'signingOut')
      throw new SessionError(
        'Entre na sua conta para continuar.',
        'unauthenticated',
      );
    if (/^auth\/(login|refresh|register|password)/.test(path))
      throw new SessionError(
        'Use a API pública para esta operação.',
        'configuration_error',
      );
    const access = this.tokens.access;
    try {
      return await this.send<T>(epoch, path, {
        ...options,
        accessToken: access,
      });
    } catch (error) {
      this.assert(epoch);
      if (statusOf(error) !== 401) throw error;
    }
    if (this.tokens?.access === access) await this.refresh(epoch);
    this.assert(epoch);
    if (!this.tokens) throw cancelled();
    try {
      return await this.send<T>(epoch, path, {
        ...options,
        accessToken: this.tokens.access,
      });
    } catch (error) {
      this.assert(epoch);
      if (statusOf(error) === 401)
        await this.invalidate(epoch, 'Sua sessão expirou. Entre novamente.');
      throw error;
    }
  };
  signOut = async () => {
    if (this.state.status === 'signingOut') return;
    const pair = this.tokens;
    const rotationPending = !!this.refreshFlight;
    const epoch = this.begin();
    this.tokens = null;
    this.update({ status: 'signingOut', session: null, error: '', notice: '' });
    let cleared = false;
    try {
      await this.clear(epoch);
      cleared = true;
    } catch {
      this.assert(epoch);
    }
    let revoked = false;
    if (pair) {
      try {
        try {
          await this.send(epoch, 'auth/logout/', {
            method: 'POST',
            accessToken: pair.access,
          });
        } catch (error) {
          if (statusOf(error) !== 401 || rotationPending) throw error;
          const fresh = tokensFrom(
            await this.send(epoch, 'auth/refresh/', {
              method: 'POST',
              body: { refresh: pair.refresh },
            }),
          );
          await this.send(epoch, 'auth/logout/', {
            method: 'POST',
            accessToken: fresh.access,
          });
        }
        revoked = true;
      } catch {
        this.assert(epoch);
      }
    }
    this.assert(epoch);
    if (!cleared) {
      this.cleanupRequired = true;
      this.update({ status: 'unavailable', error: storageError().message });
      throw storageError();
    }
    this.cleanupRequired = false;
    this.update({
      status: 'anonymous',
      notice: revoked
        ? 'Você saiu da conta. As sessões foram encerradas em todos os dispositivos.'
        : 'Você saiu apenas deste aparelho. Não foi possível confirmar o encerramento das outras sessões.',
    });
  };
}
