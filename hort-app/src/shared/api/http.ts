export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(
    message: string,
    status = 0,
    code = 'network_error',
    details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function createHttpClient(
  baseUrl: () => string,
  transport: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  return async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (
      !path ||
      path.startsWith('/') ||
      path.includes('..') ||
      path.includes(':')
    ) {
      throw new ApiError('Caminho de API inválido.', 0, 'configuration_error');
    }
    const url = new URL(path, baseUrl());
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await transport(url.toString(), {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined && {
            'Content-Type': 'application/json',
          }),
          ...(options.accessToken && {
            Authorization: `Bearer ${options.accessToken}`,
          }),
        },
        ...(options.body !== undefined && {
          body: JSON.stringify(options.body),
        }),
      });
      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        throw new ApiError(
          'A API retornou uma resposta inesperada. Tente novamente.',
          response.status,
          'invalid_response',
        );
      }
      if (!response.ok) {
        const error =
          isObject(data) && isObject(data.error) ? data.error : undefined;
        throw new ApiError(
          typeof error?.message === 'string'
            ? error.message
            : 'Não foi possível concluir a solicitação.',
          response.status,
          typeof error?.code === 'string' ? error.code : 'http_error',
          error?.details ?? null,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut)
        throw new ApiError(
          'A API demorou para responder. Tente novamente.',
          0,
          'timeout',
        );
      if (controller.signal.aborted)
        throw new ApiError('Solicitação cancelada.', 0, 'cancelled');
      throw new ApiError(
        'Não foi possível conectar à API. Verifique sua conexão.',
        0,
        'network_error',
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  };
}
