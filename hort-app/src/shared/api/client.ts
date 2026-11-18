import { getApiUrl } from '@/shared/config/env';
import { createHttpClient } from './http';
export const api = createHttpClient(getApiUrl);
