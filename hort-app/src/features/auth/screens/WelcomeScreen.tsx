import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { authAssets } from '../components/assets';
import { SocialAccess } from '../components/SocialAccess';
export default function WelcomeScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentHeight = Math.max(740, height - insets.top - insets.bottom);
  return (
    <PublicScreen contentStyle={{ minHeight: contentHeight }}>
      <View style={[styles.intro, { paddingTop: (contentHeight * 214) / 852 }]}>
        <Image
          source={authAssets.logo}
          contentFit="contain"
          accessibilityLabel="Hort"
          style={styles.logo}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Seja bem-vindo(a) ao Hort
        </Text>
        <Text style={styles.description}>
          Peça alimentos orgânicos e frescos direto de produtores locais.
        </Text>
      </View>
      <Button
        label="Vamos lá!"
        onPress={() => router.navigate('/(public)/escolher-perfil')}
        style={styles.start}
      />
      <View style={styles.loginRow}>
        <Text style={styles.account}>Já tem uma conta?</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/(public)/login')}
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>Faça Login</Text>
        </Pressable>
      </View>
      <SocialAccess compact />
      <View style={styles.bottomSpace} />
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  intro: { alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 250, height: 105, maxWidth: '100%', marginLeft: 5 },
  title: {
    marginTop: 40,
    fontFamily: theme.fonts.bold,
    fontSize: 23.037,
    lineHeight: 35,
    color: theme.colors.text,
    textAlign: 'center',
    includeFontPadding: false,
  },
  description: {
    marginTop: 19,
    maxWidth: 289,
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.muted,
    textAlign: 'center',
    includeFontPadding: false,
  },
  start: { width: 189, alignSelf: 'center', marginTop: 86 },
  loginRow: {
    marginTop: 46,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    columnGap: 4,
    marginLeft: 14,
  },
  account: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  loginLink: { minHeight: 48, justifyContent: 'center' },
  loginText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.link,
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
  bottomSpace: { flexGrow: 1, minHeight: 48 },
});
