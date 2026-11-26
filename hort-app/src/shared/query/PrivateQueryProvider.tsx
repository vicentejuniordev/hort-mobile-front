import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { sessionManager } from '@/shared/session/runtime';
import { createPrivateQueryCache } from './cache';

const cache = createPrivateQueryCache(sessionManager);
export function PrivateQueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (AppState.currentState)
      focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);
  return (
    <QueryClientProvider client={cache.client}>{children}</QueryClientProvider>
  );
}
