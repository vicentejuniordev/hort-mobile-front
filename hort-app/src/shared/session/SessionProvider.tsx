import {
  createContext,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { technicalLogin, type User } from '@/features/auth/api';
type Session = { access: string; user: User };
type SessionContext = {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  clearLocalSession: () => void;
};
const Context = createContext<SessionContext | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const generation = useRef(0);
  async function signIn(email: string, password: string) {
    const current = ++generation.current;
    const next = await technicalLogin(email, password);
    if (current === generation.current) setSession(next);
  }
  function clearLocalSession() {
    generation.current++;
    setSession(null);
  }
  return (
    <Context.Provider value={{ session, signIn, clearLocalSession }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider ausente.');
  return value;
}
