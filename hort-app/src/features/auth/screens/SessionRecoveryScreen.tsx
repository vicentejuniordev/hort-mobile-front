import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/shared/session/SessionProvider';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { authAssets } from '../components/assets';
import { SignOutButton } from '../components/SignOutButton';

export function SessionRecoveryScreen() {
  const { status, error, retry } = useSession();
  const failed = status === 'unavailable';
  return (
    <PublicScreen contentStyle={styles.screen}>
      <Image
        source={authAssets.logo}
        contentFit="contain"
        accessibilityLabel="Hort"
        style={styles.logo}
      />
      <Text accessibilityRole="header" style={styles.title}>
        {failed
          ? 'Vamos tentar de novo?'
          : status === 'signingOut'
            ? 'Saindo da conta…'
            : 'Recuperando sua sessão…'}
      </Text>
      {failed ? (
        <View style={styles.actions}>
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
          <Text style={styles.text}>
            Tente novamente ou saia da conta para continuar.
          </Text>
          <Button label="Tentar novamente" onPress={() => void retry()} />
          <SignOutButton />
        </View>
      ) : (
        <ActivityIndicator
          accessibilityLabel="Aguarde"
          color={theme.colors.primary}
          size="large"
        />
      )}
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  screen: { justifyContent: 'center', padding: 28, gap: 24 },
  logo: { width: 160, height: 68, marginLeft: -12 },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 28,
    lineHeight: 38,
    color: theme.colors.heading,
  },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  actions: { gap: 20 },
});
