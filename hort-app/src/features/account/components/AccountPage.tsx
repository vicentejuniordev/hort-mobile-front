import type { PropsWithChildren } from 'react';
import type { Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { theme } from '@/shared/theme/tokens';
import { AccountHeader } from './AccountHeader';
export function AccountPage({
  title,
  subtitle,
  children,
  fallback = '/conta',
}: PropsWithChildren<{ title: string; subtitle?: string; fallback?: Href }>) {
  return (
    <PublicScreen>
      <AccountHeader fallback={fallback} />
      <View style={accountStyles.content}>
        <Text accessibilityRole="header" style={accountStyles.title}>
          {title}
        </Text>
        {!!subtitle && <Text style={accountStyles.text}>{subtitle}</Text>}
        {children}
      </View>
    </PublicScreen>
  );
}
export const accountStyles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 32, gap: 20 },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 26,
    lineHeight: 36,
    color: theme.colors.heading,
  },
  heading: {
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.heading,
  },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
  card: { padding: 20, gap: 12, borderRadius: 12, backgroundColor: '#D9E5D9' },
  link: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  linkText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.primary,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.errorBackground,
    gap: 12,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.error,
  },
});
