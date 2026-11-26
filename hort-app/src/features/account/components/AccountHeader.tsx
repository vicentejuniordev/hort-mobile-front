import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authAssets } from '@/features/auth/components/assets';
import { BackButton } from '@/features/auth/components/BackButton';
import { theme } from '@/shared/theme/tokens';
export function AccountHeader({
  back = true,
  fallback = '/',
}: {
  back?: boolean;
  fallback?: Href;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brand} accessible={false} pointerEvents="none">
        <Image source={authAssets.headerShape} style={styles.shape} />
        <Image source={authAssets.headerLeafLeft} style={styles.left} />
        <Image source={authAssets.headerLeafRight} style={styles.right} />
        <Text style={styles.wordmark}>HORT</Text>
      </View>
      {back && (
        <View style={styles.back}>
          <BackButton circle fallback={fallback} />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { height: 88, overflow: 'hidden' },
  back: { position: 'absolute', left: 20, top: 13 },
  brand: { position: 'absolute', right: 0, top: 0, width: 189, height: 74 },
  shape: {
    position: 'absolute',
    width: 402.402,
    height: 171.222,
    left: 0,
    top: -104,
  },
  left: { position: 'absolute', width: 20, height: 21.8841, left: 33, top: 22 },
  right: { position: 'absolute', width: 20, height: 19, left: 51, top: 24 },
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
});
