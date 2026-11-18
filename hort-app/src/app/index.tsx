import { Redirect } from 'expo-router';
import { useSession } from '@/shared/session/SessionProvider';
export default function Index() {
  const { session } = useSession();
  if (!session) return <Redirect href="/(public)/login" />;
  if (session.user.perfis.includes('cliente'))
    return <Redirect href="/(cliente)/catalogo" />;
  if (session.user.perfis.includes('produtor'))
    return <Redirect href="/(produtor)/resumo" />;
  return <Redirect href="/conta" />;
}
