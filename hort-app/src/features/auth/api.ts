import type { components, paths } from '@/shared/api/generated/schema';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import {
  registrationPayload,
  type RegistrationProfile,
  type RegistrationValues,
} from './registration';
type HealthResponse =
  paths['/api/v1/health/']['get']['responses'][200]['content']['application/json'];
export async function checkHealth() {
  const result = await api<HealthResponse>('health/');
  if (result?.status !== 'ok')
    throw new ApiError(
      'A API não confirmou disponibilidade.',
      200,
      'invalid_response',
    );
}
export async function registerAccount(
  profile: RegistrationProfile,
  values: RegistrationValues,
) {
  await api<components['schemas']['Usuario']>(`auth/register/${profile}/`, {
    method: 'POST',
    body: registrationPayload(values, profile),
  });
}
