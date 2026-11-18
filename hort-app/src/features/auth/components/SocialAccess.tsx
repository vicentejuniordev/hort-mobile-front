import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import { authAssets } from './assets';
const providers = [
  { name: 'Google', source: authAssets.google },
  { name: 'WhatsApp', source: authAssets.whatsapp },
  { name: 'Facebook', source: authAssets.facebook },
];
export function SocialAccess({
  compact = false,
  disabled = false,
}: {
  compact?: boolean;
  disabled?: boolean;
}) {
  const [provider, setProvider] = useState<string | null>(null);
  return (
    <>
      <View style={[styles.row, compact && styles.compactRow]}>
        {providers.map(({ name, source }, index) => (
          <Pressable
            key={name}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Acesso com ${name}`}
            accessibilityHint="Informa a disponibilidade desse acesso"
            accessibilityState={{ disabled }}
            onPress={() => setProvider(name)}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={source}
              contentFit="contain"
              style={
                compact
                  ? [{ width: 28 + index, height: index === 0 ? 29 : 30 }]
                  : styles.image
              }
              accessible={false}
            />
          </Pressable>
        ))}
      </View>
      <NoticeDialog
        visible={provider !== null}
        title={`Acesso com ${provider ?? ''}`}
        message="Esse acesso ainda não está disponível. Para entrar no Hort, use seu e-mail e senha."
        onClose={() => setProvider(null)}
      />
    </>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 31,
    marginLeft: 10,
    alignSelf: 'center',
  },
  compactRow: { gap: 13, marginLeft: 18, marginTop: 4 },
  button: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: 33, height: 33 },
});
