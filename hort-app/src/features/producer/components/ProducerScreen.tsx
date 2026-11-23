import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authAssets } from '@/features/auth/components/assets';
import { theme } from '@/shared/theme/tokens';

export function ProducerScreen({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header} accessible={false} pointerEvents="none">
          <View style={styles.brand}>
            <Image source={authAssets.headerShape} style={styles.shape} />
            <Image source={authAssets.headerLeafLeft} style={styles.leafLeft} />
            <Image
              source={authAssets.headerLeafRight}
              style={styles.leafRight}
            />
            <Text style={styles.wordmark}>HORT</Text>
          </View>
        </View>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={producerStyles.title}>
            {title}
          </Text>
          {!!subtitle && <Text style={producerStyles.text}>{subtitle}</Text>}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
export const producerStyles = StyleSheet.create({
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 24,
    lineHeight: 34,
    color: theme.colors.heading,
    includeFontPadding: false,
  },
  heading: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  card: {
    backgroundColor: '#EEF2EE',
    borderColor: '#AABCA2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  notice: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: theme.colors.profileBackground,
    gap: 8,
  },
});
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { height: 88, overflow: 'hidden' },
  brand: { position: 'absolute', right: 0, top: 0, width: 189, height: 74 },
  shape: {
    position: 'absolute',
    width: 402.402,
    height: 171.222,
    left: 0,
    top: -104,
  },
  leafLeft: {
    position: 'absolute',
    width: 20,
    height: 21.8841,
    left: 33,
    top: 22,
  },
  leafRight: { position: 'absolute', width: 20, height: 19, left: 51, top: 24 },
  wordmark: {
    position: 'absolute',
    top: 16,
    left: 78,
    fontFamily: theme.fonts.footer,
    fontSize: 27.731,
    lineHeight: 40,
    includeFontPadding: false,
    color: '#EBEBEB',
  },
  content: { padding: 24, gap: 20, paddingBottom: 32 },
});
