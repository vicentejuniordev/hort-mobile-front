import { AppFonts } from '@/shared/theme/AppFonts';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
function Navigation() {
  const { session } = useSession();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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
