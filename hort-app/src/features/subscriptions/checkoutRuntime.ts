import { randomUUID } from 'expo-crypto';
import { getApiUrl } from '@/shared/config/env';
import { privateScope } from '@/shared/query/cache';
import { createSecureStorage } from '@/shared/session/storage';
import type { SessionManager } from '@/shared/session/manager';
import { SubscriptionCheckout } from './checkout';

// Dependency injection keeps the session/checkout lifecycle free of import cycles.
export function createSubscriptionCheckout(manager: SessionManager) {
  const checkout = new SubscriptionCheckout(
    createSecureStorage('hort.subscription.intent.v1'),
    manager.request,
    () => {
      const state = manager.getSnapshot();
      const scope = privateScope(state);
      return scope &&
        state.session?.mode === 'cliente' &&
        state.session.user.perfis.includes('cliente')
        ? { api: getApiUrl(), userId: state.session.user.id, scope }
        : null;
    },
    randomUUID,
  );
  let scope = privateScope(manager.getSnapshot());
  manager.subscribe(() => {
    const next = privateScope(manager.getSnapshot());
    if (scope !== next) {
      scope = next;
      checkout.cancel();
    }
  });
  return checkout;
}
