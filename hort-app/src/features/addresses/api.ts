import { authenticatedApi } from '@/shared/session/runtime';
import { createAddressApi } from './model';
export const addressApi = createAddressApi(authenticatedApi);
