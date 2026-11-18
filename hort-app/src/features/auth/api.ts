import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
export type Profile = 'cliente' | 'produtor';
export type User = {
  id: number;
  nome: string;
  email: string;
  perfis: Profile[];
};
export async function technicalLogin(email: string, password: string) {
  const tokens = await api<{ access: string; refresh: string }>('auth/login/', {
    method: 'POST',
    body: { email, password },
  });
  if (typeof tokens?.access !== 'string' || !tokens.access)
    throw new ApiError('Resposta de login inválida.', 200, 'invalid_response');
  const user = await api<User>('auth/me/', { accessToken: tokens.access });
  if (
    !user ||
    typeof user.id !== 'number' ||
    typeof user.nome !== 'string' ||
    typeof user.email !== 'string' ||
    !Array.isArray(user.perfis) ||
    !user.perfis.every(
      (profile) => profile === 'cliente' || profile === 'produtor',
    )
  )
    throw new ApiError('Resposta da conta inválida.', 200, 'invalid_response');
  return { access: tokens.access, user };
}
export async function checkHealth() {
  const result = await api<{ status: string }>('health/');
  if (result?.status !== 'ok')
    throw new ApiError(
      'A API não confirmou disponibilidade.',
      200,
      'invalid_response',
    );
}
