import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import type { SessionState } from './manager';
import { sessionManager } from './runtime';

type SessionContext = SessionState & {
  signIn: typeof sessionManager.signIn;
  signOut: typeof sessionManager.signOut;
  retry: typeof sessionManager.bootstrap;
  dismissNotice: typeof sessionManager.dismissNotice;
  passwordResetCompleted: typeof sessionManager.passwordResetCompleted;
  selectMode: typeof sessionManager.selectMode;
  refreshAccount: typeof sessionManager.refreshAccount;
};
const Context = createContext<SessionContext | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot,
  );
  useEffect(() => {
    void sessionManager.bootstrap();
  }, []);
  return (
    <Context.Provider
      value={{
        ...state,
        signIn: sessionManager.signIn,
        signOut: sessionManager.signOut,
        retry: sessionManager.bootstrap,
        dismissNotice: sessionManager.dismissNotice,
        passwordResetCompleted: sessionManager.passwordResetCompleted,
        selectMode: sessionManager.selectMode,
        refreshAccount: sessionManager.refreshAccount,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionProvider ausente.');
  return context;
}
