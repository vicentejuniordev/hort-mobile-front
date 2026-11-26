import { api } from '@/shared/api/client';
import { getApiUrl } from '@/shared/config/env';
import { SessionManager } from './manager';
import { sessionStorage } from './storage';

export const sessionManager = new SessionManager(
  api,
  sessionStorage,
  getApiUrl,
);
export const authenticatedApi = sessionManager.request;
