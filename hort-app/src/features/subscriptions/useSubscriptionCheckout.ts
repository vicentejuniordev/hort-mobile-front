import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { privateScope } from '@/shared/query/cache';
import { useSession } from '@/shared/session/SessionProvider';
import { sessionManager, subscriptionCheckout } from '@/shared/session/runtime';
import { subscriptionKeys } from './model';
import {
  checkoutFailure,
  type CheckoutIntent,
  type CheckoutPayload,
} from './checkout';

type View = {
  scope: string | null;
  intent: CheckoutIntent | null;
  busy: boolean;
  failure: ReturnType<typeof checkoutFailure> | null;
};
/** Prepared for MOB-22: restoring a draft never submits it. */
export function useSubscriptionCheckout() {
  const state = useSession();
  const focused = useIsFocused();
  const scope = privateScope(state);
  const enabled =
    focused &&
    !!scope &&
    state.session?.mode === 'cliente' &&
    state.session.user.perfis.includes('cliente');
  const client = useQueryClient();
  const [view, setView] = useState<View>({
    scope: null,
    intent: null,
    busy: false,
    failure: null,
  });
  const lifecycle = useRef({ active: false });
  const running = useRef(false);
  useEffect(() => {
    const lease = { active: true };
    lifecycle.current = lease;
    if (enabled) {
      void subscriptionCheckout
        .waitUntilIdle()
        .then(() => {
          if (!lease.active) return null;
          return subscriptionCheckout.restore();
        })
        .then((intent) => {
          if (lease.active)
            setView({ scope, intent, busy: false, failure: null });
        })
        .catch((error: unknown) => {
          if (lease.active)
            setView({
              scope,
              intent: null,
              busy: false,
              failure: checkoutFailure(error),
            });
        });
    }
    return () => {
      lease.active = false;
      if (enabled) subscriptionCheckout.cancel();
    };
  }, [enabled, scope]);
  const run = useCallback(
    async <T>(operation: () => Promise<T>, writing = false) => {
      if (!enabled || subscriptionCheckout.busy || running.current) return null;
      running.current = true;
      const lease = lifecycle.current;
      const active = () =>
        lease.active && privateScope(sessionManager.getSnapshot()) === scope;
      setView((previous) => ({
        ...previous,
        scope,
        busy: true,
        failure: null,
      }));
      let result: T | null = null;
      try {
        if (writing) {
          await client.cancelQueries({
            queryKey: subscriptionKeys.all(scope!),
          });
          if (!active()) return null;
        }
        result = await operation();
      } catch (error) {
        if (active())
          setView((previous) => ({
            ...previous,
            failure: checkoutFailure(error),
          }));
      } finally {
        if (active()) {
          try {
            const intent = await subscriptionCheckout.restore();
            if (active()) setView((previous) => ({ ...previous, intent }));
          } catch {
            /* Keep the primary command failure. */
          }
          if (active()) {
            setView((previous) => ({ ...previous, busy: false }));
            if (writing)
              void client
                .invalidateQueries({ queryKey: subscriptionKeys.all(scope!) })
                .catch(() => {});
          }
        }
        running.current = false;
      }
      return active() ? result : null;
    },
    [enabled, scope, client],
  );
  const visible = enabled && view.scope === scope;
  return {
    intent: visible ? view.intent : null,
    busy: enabled && (!visible || view.busy),
    failure: visible ? view.failure : null,
    enabled,
    loaded: visible,
    restore: () => run(subscriptionCheckout.restore),
    prepare: (
      payload: CheckoutPayload,
      baskets: readonly number[],
      newPurchase = false,
    ) => run(() => subscriptionCheckout.prepare(payload, baskets, newPurchase)),
    submit: () => run(subscriptionCheckout.submit, true),
  };
}
