import { api } from '@/shared/api/client';
import { getApiUrl } from '@/shared/config/env';
import { SessionManager } from './manager';
import { sessionStorage } from './storage';
import { createSubscriptionCheckout } from '@/features/subscriptions/checkoutRuntime';

export const sessionManager = new SessionManager(
  api,
  sessionStorage,
  getApiUrl,
  () => subscriptionCheckout.clear(),
);
export const authenticatedApi = sessionManager.request;
export const subscriptionCheckout = createSubscriptionCheckout(sessionManager);
