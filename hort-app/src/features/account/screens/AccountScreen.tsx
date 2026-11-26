import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { useFocusedResource } from '@/shared/lib/useFocusedResource';
import { sessionManager } from '@/shared/session/runtime';
import { theme } from '@/shared/theme/tokens';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { Button } from '@/shared/ui/Button';
import { AccountHeader } from '../components/AccountHeader';
import { accountStyles as common } from '../components/AccountPage';
import { ModeSwitch } from '../components/ModeSwitch';

const loadAccount = (signal: AbortSignal) =>
  sessionManager.refreshAccount(signal);
export default function AccountScreen() {
  const { data, error, loading, reload } = useFocusedResource(loadAccount);
  return (
    <PublicScreen>
      <AccountHeader />
      <View style={styles.profile}>
        <Image
          source={require('../../../../assets/account/profile-illustration.png')}
          contentFit="cover"
          accessible={false}
          style={styles.avatar}
        />
        <Text accessibilityRole="header" style={styles.name}>
          {data?.nome ?? 'Sua conta'}
        </Text>
        <Text style={styles.caption}>Dados da conta</Text>
      </View>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Carregando sua conta"
            color={theme.colors.primary}
          />
        ) : error ? (
          <View style={common.errorBox}>
            <Text accessibilityRole="alert" style={common.error}>
              Não foi possível consultar sua conta. Verifique a conexão e tente
              novamente.
            </Text>
            <Button label="Tentar novamente" onPress={() => void reload()} />
          </View>
        ) : (
          data && (
            <View style={common.card}>
              <Text style={styles.section}>Seus dados</Text>
              <Text style={common.heading}>{data.nome}</Text>
              <Text selectable style={common.text}>
                {data.email}
              </Text>
              <Text style={common.text}>
                {data.perfis.length
                  ? data.perfis
                      .map((profile) =>
                        profile === 'cliente' ? 'Cliente' : 'Produtor',
                      )
                      .join(' · ')
                  : 'Sem perfil disponível'}
              </Text>
            </View>
          )
        )}
        <Text style={styles.section}>Endereços</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/enderecos')}
          style={({ pressed }) => [common.card, pressed && styles.pressed]}
        >
          <Text style={common.heading}>Meus endereços</Text>
          <Text style={common.text}>
            Consulte, adicione ou atualize seus endereços.
          </Text>
        </Pressable>
        <Text style={styles.section}>Acesso</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/recuperar-senha')}
          style={common.link}
        >
          <Text style={common.linkText}>Redefinir senha por e-mail</Text>
        </Pressable>
        <ModeSwitch />
        <SignOutButton />
      </View>
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  profile: {
    paddingTop: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 60.796,
    height: 60.796,
    borderRadius: 42.416,
    borderWidth: 1.414,
    borderColor: theme.colors.primary,
  },
  name: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
    textAlign: 'center',
  },
  caption: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: '#1B5E20',
  },
  content: {
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: '#1B5E20',
  },
  pressed: { opacity: 0.7 },
});
