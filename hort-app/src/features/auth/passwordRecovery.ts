import { z } from 'zod';
import type { components } from '../../shared/api/generated/schema';
import type { RequestOptions } from '../../shared/api/http';

export const recoveryEmailSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
});
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
    password_confirm: z.string().min(1, 'Confirme sua nova senha.'),
  })
  .refine((value) => value.password === value.password_confirm, {
    path: ['password_confirm'],
    message: 'As senhas não conferem.',
  });
const credentialsSchema = z.object({
  uid: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  token: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/),
});
export type ResetCredentials = z.infer<typeof credentialsSchema>;
export type NewPassword = z.infer<typeof newPasswordSchema>;
export function resetCredentials(params: {
  uid?: string | string[];
  token?: string | string[];
}): ResetCredentials | null {
  const result = credentialsSchema.safeParse(params);
  return result.success ? result.data : null;
}
type Transport = <T>(path: string, options?: RequestOptions) => Promise<T>;
export function createPasswordRecovery(transport: Transport) {
  return {
    async request(email: string, signal?: AbortSignal) {
      const body: components['schemas']['SolicitarSenhaInput'] =
        recoveryEmailSchema.parse({ email });
      await transport<void>('auth/password-reset/', {
        method: 'POST',
        body,
        signal,
      });
    },
    async confirm(
      credentials: ResetCredentials,
      values: NewPassword,
      signal?: AbortSignal,
    ) {
      const body: components['schemas']['RedefinirSenhaInput'] = {
        ...credentialsSchema.parse(credentials),
        ...newPasswordSchema.parse(values),
      };
      await transport<void>('auth/password-reset/confirm/', {
        method: 'POST',
        body,
        signal,
      });
    },
  };
}
export type RecoveryErrors = Partial<
  Record<'email' | keyof NewPassword, string>
>;
export function recoveryFailure(
  error: unknown,
  stage: 'request' | 'confirm' = 'confirm',
): {
  fields: RecoveryErrors;
  invalidLink: boolean;
  message: string;
} {
  const value =
    error && typeof error === 'object'
      ? (error as { status?: number; code?: string; details?: unknown })
      : {};
  const details =
    value.details &&
    typeof value.details === 'object' &&
    !Array.isArray(value.details)
      ? (value.details as Record<string, unknown>)
      : {};
  const messageOf = (item: unknown) =>
    typeof item === 'string'
      ? item
      : Array.isArray(item)
        ? item.filter((part) => typeof part === 'string').join(' ')
        : '';
  const fields: RecoveryErrors = {};
  for (const name of ['email', 'password', 'password_confirm'] as const) {
    const message = messageOf(details[name]);
    if (message) fields[name] = message;
  }
  const invalidLink =
    value.status === 400 && ('uid' in details || 'token' in details);
  return {
    fields,
    invalidLink,
    message: invalidLink
      ? 'Este link é inválido ou expirou. Solicite um novo para continuar.'
      : value.status === 429
        ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
        : value.code === 'timeout' || value.code === 'network_error'
          ? stage === 'request'
            ? 'Não foi possível confirmar o envio. Verifique sua conexão e confira seu e-mail antes de solicitar novamente.'
            : 'Não foi possível confirmar a troca. Verifique sua conexão e tente entrar com a nova senha antes de repetir.'
          : messageOf(value.details) ||
            messageOf(details.non_field_errors) ||
            (Object.keys(fields).length
              ? 'Confira os campos indicados.'
              : 'Não foi possível concluir. Tente novamente em instantes.'),
  };
}
