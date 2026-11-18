import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { authAssets } from '../components/assets';
import { BackButton } from '../components/BackButton';
export default function ProfileChoiceScreen() {
  const [profile, setProfile] = useState<'cliente' | 'produtor' | null>(null);
  return (
    <PublicScreen backgroundColor={theme.colors.profileBackground}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.brand} accessible={false}>
          <Image source={authAssets.headerShape} style={styles.headerShape} />
          <Image
            source={authAssets.headerLeafLeft}
            style={styles.headerLeafLeft}
          />
          <Image
            source={authAssets.headerLeafRight}
            style={styles.headerLeafRight}
          />
          <Text style={styles.wordmark}>HORT</Text>
        </View>
        <BackButton circle />
      </View>
      <View style={styles.customer}>
        <Image
          source={authAssets.basket}
          style={styles.basket}
          accessible={false}
        />
        <Text style={styles.customerText}>
          Conheça planos de alimentos frescos de produtores locais e escolha o
          que combina com você.
        </Text>
        <View style={styles.customerRow}>
          <Button
            compact
            label="Sou Cliente"
            onPress={() => setProfile('cliente')}
            style={[styles.choiceButton, { marginTop: 34 }]}
          />
          <Image
            source={authAssets.customer}
            contentFit="contain"
            style={styles.customerImage}
            accessible={false}
          />
        </View>
      </View>
      <View style={styles.producer}>
        <Text style={styles.producerText}>
          Você que é produtor ou tem uma horta pode se cadastrar também, fácil e
          rápido. Uma nova forma de vender.
        </Text>
        <View style={styles.producerRow}>
          <Image
            source={authAssets.producer}
            style={styles.producerImage}
            accessible={false}
          />
          <Button
            compact
            label="Sou Produtor"
            onPress={() => setProfile('produtor')}
            style={[styles.choiceButton, { marginTop: 10 }]}
          />
        </View>
        <Image
          source={authAssets.star}
          style={styles.star}
          accessible={false}
        />
      </View>
      <View style={styles.artwork} pointerEvents="none" accessible={false}>
        <Image source={authAssets.footerCircle} style={styles.footerCircle} />
        <Image source={authAssets.footerEllipse} style={styles.footerEllipse} />
        <Image
          source={authAssets.footerLeafBack}
          style={[styles.footerLeaf, { left: 71, top: 77 }]}
        />
        <Image
          source={authAssets.footerLeaf}
          style={[styles.footerLeaf, { left: 71, top: 77 }]}
        />
        <Image
          source={authAssets.footerLeaf}
          style={[styles.footerLeaf, { left: 47, top: 55 }]}
        />
        <Image
          source={authAssets.footerLeaf}
          style={[styles.footerLeaf, { left: 80, top: 105 }]}
        />
        <Image
          source={authAssets.footerLeaf}
          style={[styles.footerLeaf, { right: 77, top: 51 }]}
        />
        <Image
          source={authAssets.footerLeaf}
          style={[styles.footerLeaf, { right: 40, top: 45 }]}
        />
        <Image source={authAssets.courier} style={styles.courier} />
      </View>
      <NoticeDialog
        visible={profile !== null}
        title={`Cadastro de ${profile ?? ''}`}
        message="O cadastro pelo aplicativo estará disponível em breve. Se você já tem uma conta, pode entrar com seu e-mail e senha."
        onClose={() => setProfile(null)}
        action={{
          label: 'Já tenho conta',
          onPress: () => {
            setProfile(null);
            router.navigate('/(public)/login');
          },
        }}
      />
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  header: { height: 74, paddingLeft: 6, paddingTop: 8, overflow: 'hidden' },
  brand: { position: 'absolute', top: 0, right: 0, width: 189, height: 74 },
  headerShape: {
    position: 'absolute',
    width: 402.402,
    height: 171.222,
    left: 0,
    top: -104,
  },
  headerLeafLeft: {
    position: 'absolute',
    width: 20,
    height: 21.8841,
    top: 22,
    left: 33,
  },
  headerLeafRight: {
    position: 'absolute',
    width: 20,
    height: 19,
    top: 24,
    left: 51,
  },
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
  customer: { paddingHorizontal: 24 },
  basket: { width: 80, height: 80, marginLeft: -16 },
  customerText: {
    marginTop: 26,
    maxWidth: 305,
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.muted,
    includeFontPadding: false,
  },
  customerRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 48,
  },
  choiceButton: { width: 160 },
  customerImage: { width: 96, height: 96, flexShrink: 1 },
  producer: { marginTop: 43, paddingLeft: 24, paddingRight: 9 },
  producerText: {
    alignSelf: 'flex-end',
    maxWidth: 293,
    marginLeft: 67,
    fontFamily: theme.fonts.semibold,
    fontSize: 15.486,
    lineHeight: 23,
    color: theme.colors.muted,
    includeFontPadding: false,
  },
  producerRow: {
    marginTop: 19,
    flexDirection: 'row',
    gap: 26,
    alignItems: 'center',
  },
  producerImage: { width: 86, height: 86 },
  star: {
    position: 'absolute',
    width: 314.8,
    height: 94.9734,
    left: 304,
    bottom: -31,
  },
  artwork: { height: 218, marginTop: 44, overflow: 'hidden' },
  footerCircle: {
    position: 'absolute',
    width: 128,
    height: 120,
    left: -48,
    top: 64,
  },
  footerEllipse: {
    position: 'absolute',
    width: 366,
    height: 343,
    right: -140,
    top: 64,
    transform: [{ scaleY: -1 }],
  },
  footerLeaf: { position: 'absolute', width: 20, height: 19 },
  courier: {
    position: 'absolute',
    width: 132,
    height: 122,
    left: 108,
    top: 29,
    transform: [{ rotate: '-45deg' }],
  },
});
