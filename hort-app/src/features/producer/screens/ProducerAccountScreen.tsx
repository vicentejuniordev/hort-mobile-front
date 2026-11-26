import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { ModeSwitch } from '@/features/account/components/ModeSwitch';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { authAssets } from '@/features/auth/components/assets';
import { useFocusedResource } from '@/shared/lib/useFocusedResource';
import { sessionManager } from '@/shared/session/runtime';
import { useSession } from '@/shared/session/SessionProvider';
import { theme } from '@/shared/theme/tokens';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';

const assets = {
  garden: require('../../../../assets/producer-account/garden-default.png'),
  profile: require('../../../../assets/producer-account/garden-profile.png'),
  products: authAssets.basket,
  hours: require('../../../../assets/producer-account/hours.png'),
  money: require('../../../../assets/producer-account/money.png'),
  history: require('../../../../assets/producer-account/history.png'),
  onion: require('../../../../assets/producer-account/onion.png'),
};
const loadAccount = (signal: AbortSignal) =>
  sessionManager.refreshAccount(signal);
function MenuRow({
  label,
  image,
  size = 22.15,
  onPress,
}: {
  label: string;
  image: ImageSource;
  size?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image
        source={image}
        contentFit="cover"
        style={{ width: size, height: size }}
        accessible={false}
      />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}
export default function ProducerAccountScreen() {
  const { session } = useSession();
  const { data, error, loading, reload } = useFocusedResource(loadAccount);
  const [notice, setNotice] = useState('');
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AccountHeader fallback="/(produtor)/resumo" />
        <View style={styles.profile}>
          <Image
            source={assets.garden}
            contentFit="cover"
            accessibilityLabel="Imagem padrão de horta"
            style={styles.garden}
          />
          <Text accessibilityRole="header" style={styles.name}>
            {data?.nome ?? session?.user.nome}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setNotice(
                'A edição do nome e dos dados do perfil ainda não está disponível. Você pode gerenciar seus endereços em Dados da conta e endereços.',
              )
            }
            hitSlop={{ top: 18, bottom: 18, left: 12, right: 12 }}
          >
            <Text style={styles.edit}>Editar Perfil</Text>
          </Pressable>
        </View>
        <Image
          source={assets.onion}
          contentFit="cover"
          accessible={false}
          style={styles.onion}
        />
        <View style={styles.shop}>
          <Text style={styles.section}>Gerenciar Loja</Text>
          <View style={styles.rows}>
            <MenuRow
              image={assets.profile}
              label="Perfil da Horta"
              onPress={() => router.push('/conta')}
            />
            <MenuRow
              image={assets.products}
              size={22}
              label="Meus produtos"
              onPress={() => router.navigate('/(produtor)/produtos')}
            />
            <MenuRow
              image={assets.hours}
              label="Horarios de Funcionamento"
              onPress={() =>
                setNotice(
                  'Os horários de funcionamento ainda não estão disponíveis no app.',
                )
              }
            />
          </View>
        </View>
        <View style={styles.finance}>
          <Text style={[styles.section, styles.financeTitle]}>Finanças</Text>
          <View style={styles.financeRows}>
            <MenuRow
              image={assets.money}
              label="Repasses e Conta bancária"
              onPress={() =>
                setNotice(
                  'Repasses e conta bancária ainda não estão disponíveis. O app não realiza pagamentos ou transferências.',
                )
              }
            />
            <MenuRow
              image={assets.history}
              label="Histórico de Assinaturas"
              onPress={() =>
                setNotice(
                  'O histórico de assinaturas do produtor ainda não está disponível no app.',
                )
              }
            />
          </View>
        </View>
        <View style={styles.additional}>
          {loading && (
            <ActivityIndicator
              color={theme.colors.primary}
              accessibilityLabel="Atualizando dados da conta"
            />
          )}
          {!!error && (
            <View style={styles.errorBox}>
              <Text accessibilityRole="alert" style={styles.error}>
                Não foi possível atualizar os dados da conta. O nome exibido é o
                da última consulta.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void reload()}
                style={styles.action}
              >
                <Text style={styles.link}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/conta')}
            style={styles.action}
          >
            <Text style={styles.link}>Dados da conta e endereços</Text>
          </Pressable>
          <ModeSwitch />
          <SignOutButton />
        </View>
      </ScrollView>
      <NoticeDialog
        title="Disponibilidade"
        visible={!!notice}
        message={notice}
        onClose={() => setNotice('')}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 393,
    alignSelf: 'center',
    paddingBottom: 32,
  },
  profile: {
    marginTop: -14,
    minHeight: 145,
    width: 161,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5.86,
    paddingVertical: 3.662,
  },
  garden: { width: 58, height: 40, borderRadius: 100 },
  name: {
    maxWidth: 153,
    fontFamily: theme.fonts.bold,
    color: '#1B5E20',
    fontSize: 15.531,
    lineHeight: 23.2965,
    textAlign: 'center',
    includeFontPadding: false,
  },
  edit: {
    fontFamily: theme.fonts.medium,
    color: '#1B5E20',
    fontSize: 8.79,
    lineHeight: 13.185,
    textAlign: 'center',
    includeFontPadding: false,
  },
  onion: { position: 'absolute', width: 4, height: 4, top: 156, right: 21 },
  shop: { paddingHorizontal: 30 },
  section: {
    marginLeft: 3,
    fontFamily: theme.fonts.medium,
    color: '#1B5E20',
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
  },
  rows: { gap: 19.85, marginTop: 9 },
  row: {
    width: 294,
    maxWidth: '100%',
    minHeight: 50.15,
    backgroundColor: '#D9E5D9',
    borderRadius: 11.782,
    paddingHorizontal: 21,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  rowLabel: {
    flexShrink: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 14.65,
    lineHeight: 21.975,
    includeFontPadding: false,
    color: theme.colors.text,
  },
  finance: { paddingLeft: 32, paddingRight: 30, marginTop: 26.85 },
  financeTitle: { marginLeft: 7 },
  financeRows: { gap: 19.85, marginTop: 23 },
  additional: { paddingHorizontal: 30, marginTop: 170, gap: 20 },
  action: { minHeight: 48, justifyContent: 'center' },
  link: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.primary,
  },
  errorBox: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
    backgroundColor: theme.colors.errorBackground,
  },
  error: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.error,
    fontSize: 14,
    lineHeight: 22,
  },
  pressed: { opacity: 0.65 },
});
