import { Redirect } from 'expo-router';
import { useSession } from '@/shared/session/SessionProvider';
export default function Index() {
  const { session } = useSession();
  if (!session) return <Redirect href="/(public)/boas-vindas" />;
  if (session.mode === 'cliente')
    return <Redirect href="/(cliente)/catalogo" />;
  if (session.mode === 'produtor')
    return <Redirect href="/(produtor)/resumo" />;
  return <Redirect href="/conta" />;
}
