import { AppFonts } from '@/shared/theme/AppFonts';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { SessionRecoveryScreen } from '@/features/auth/screens/SessionRecoveryScreen';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
function Navigation() {
  const { session, status, notice, dismissNotice } = useSession();
  const blocked =
    status === 'loading' || status === 'unavailable' || status === 'signingOut';
  return (
    <>
      <StatusBar style="dark" />
      {blocked ? (
        <SessionRecoveryScreen />
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="recuperar-senha" />
          <Stack.Screen name="reset-password" />
          <Stack.Protected guard={!session}>
            <Stack.Screen name="(public)" />
          </Stack.Protected>
          <Stack.Protected guard={!!session?.user.perfis.includes('cliente')}>
            <Stack.Screen name="(cliente)" />
          </Stack.Protected>
          <Stack.Protected guard={!!session?.user.perfis.includes('produtor')}>
            <Stack.Screen name="(produtor)" />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="conta" />
          </Stack.Protected>
        </Stack>
      )}
      <NoticeDialog
        visible={!!notice}
        title="Sua sessão"
        message={notice}
        onClose={dismissNotice}
      />
    </>
  );
}
export default function RootLayout() {
  return (
    <AppFonts>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </AppFonts>
  );
}
