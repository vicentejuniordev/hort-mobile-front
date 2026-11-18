import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { authAssets } from './assets';
export function BackButton({
  circle = false,
  disabled = false,
}: {
  circle?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() =>
        router.canGoBack()
          ? router.back()
          : router.replace('/(public)/boas-vindas')
      }
      style={({ pressed }) => [
        styles.button,
        circle && styles.circle,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Image
        source={circle ? authAssets.circleBack : authAssets.back}
        contentFit="contain"
        style={circle ? styles.circleImage : styles.image}
        accessible={false}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { width: 61, height: 61 },
  image: { width: 41, height: 40 },
  circleImage: { width: 61, height: 61 },
});
