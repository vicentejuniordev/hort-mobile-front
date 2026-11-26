import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/shared/theme/tokens';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { authAssets } from './assets';
import { BackButton } from './BackButton';

export function RecoveryLayout({
  title,
  subtitle,
  busy,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  busy?: boolean;
}>) {
  return (
    <PublicScreen>
      <View style={styles.navigation}>
        <BackButton disabled={busy} />
      </View>
      <View style={styles.content}>
        <Image
          source={authAssets.logo}
          contentFit="contain"
          accessibilityLabel="Hort"
          style={styles.logo}
        />
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={recoveryStyles.form}>{children}</View>
      </View>
    </PublicScreen>
  );
}
export const recoveryStyles = StyleSheet.create({
  form: { marginTop: 28, gap: 20 },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  feedback: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.errorBackground,
  },
  error: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.error,
  },
  button: { minHeight: 56, borderRadius: 14 },
  link: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  linkText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    lineHeight: 22,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  visibility: {
    minHeight: 48,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
const styles = StyleSheet.create({
  navigation: { paddingTop: 8, paddingLeft: 12, height: 64 },
  content: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 24 },
  logo: { width: 160, height: 68, marginLeft: -12 },
  title: {
    marginTop: 24,
    fontFamily: theme.fonts.semibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: theme.colors.heading,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});
