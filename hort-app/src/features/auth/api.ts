import type { components, paths } from '@/shared/api/generated/schema';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
type HealthResponse =
  paths['/api/v1/health/']['get']['responses'][200]['content']['application/json'];
export type Profile = 'cliente' | 'produtor';
export type User = Omit<components['schemas']['Usuario'], 'perfis'> & {
  perfis: Profile[];
};
export async function technicalLogin(email: string, password: string) {
  const credentials: components['schemas']['Login'] = { email, password };
  const tokens = await api<components['schemas']['LoginResponse']>(
    'auth/login/',
    {
      method: 'POST',
      body: credentials,
    },
  );
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
  const result = await api<HealthResponse>('health/');
  if (result?.status !== 'ok')
    throw new ApiError(
      'A API não confirmou disponibilidade.',
      200,
      'invalid_response',
    );
}
