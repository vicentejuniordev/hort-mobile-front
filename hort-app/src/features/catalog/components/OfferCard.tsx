import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/shared/theme/tokens';
import type { Offer } from '../model';
import { basketCount, offerMoney } from '../presentation';

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver plano ${offer.nome}, ${basketCount(offer)}, ${offerMoney(offer.valor)}`}
      onPress={() =>
        router.push({
          pathname: '/(cliente)/catalogo/[id]',
          params: { id: String(offer.id) },
        })
      }
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.heading}>
        <Image
          source={require('../../../../assets/auth/produce-basket.png')}
          contentFit="contain"
          style={styles.icon}
          accessible={false}
        />
        <Text style={styles.name}>{offer.nome}</Text>
      </View>
      <View style={styles.summary}>
        <Text style={styles.description}>{offer.categoria}</Text>
        <Text style={styles.description}>{basketCount(offer)}</Text>
      </View>
      <Text style={styles.price}>{offerMoney(offer.valor)}</Text>
      <View style={styles.buttonTarget}>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Ver Plano</Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    width: 148,
    minHeight: 184,
    backgroundColor: '#EBFDE3',
    borderColor: '#AABCA2',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingTop: 17,
    paddingBottom: 11,
    alignItems: 'center',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { width: 22, height: 22, flexShrink: 0 },
  name: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12.132,
    lineHeight: 18.2,
    color: '#1E1E1E',
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  summary: { minHeight: 53, justifyContent: 'center', paddingVertical: 8 },
  description: {
    fontFamily: theme.fonts.medium,
    fontSize: 9.608,
    lineHeight: 14.4,
    textAlign: 'center',
    color: '#1E1E1E',
    includeFontPadding: false,
  },
  price: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.604,
    lineHeight: 26.4,
    textAlign: 'center',
    color: '#1E1E1E',
    includeFontPadding: false,
  },
  buttonTarget: { minHeight: 48, justifyContent: 'center', marginTop: 'auto' },
  button: {
    minWidth: 98,
    minHeight: 27,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12.388,
    lineHeight: 18.6,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
