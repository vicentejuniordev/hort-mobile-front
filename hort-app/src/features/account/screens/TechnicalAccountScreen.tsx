import { Button, Text } from 'react-native';
import { router } from 'expo-router';
import { SignOutButton } from '@/features/auth/components/SignOutButton';
import { useSession } from '@/shared/session/SessionProvider';
import { Screen, styles } from '@/shared/ui/Screen';
export default function TechnicalAccountScreen({
  mode,
}: {
  mode?: 'cliente' | 'produtor';
}) {
  const { session } = useSession();
  return (
    <Screen>
      <Text style={styles.title}>
        {mode === 'cliente'
          ? 'Área do cliente'
          : mode === 'produtor'
            ? 'Área do produtor'
            : 'Conta'}
      </Text>
      <Text style={styles.text}>Olá, {session?.user.nome}.</Text>
      <Button
        title="Minha conta e endereços"
        onPress={() => router.push('/conta')}
      />
      <Text style={styles.text}>
        Sua conta foi consultada na API. Esta é a base de navegação; as telas
        serão implementadas nas próximas tarefas.
      </Text>
      {!mode && (
        <Text style={styles.text}>
          Sua conta não possui um perfil cliente ou produtor disponível.
        </Text>
      )}
      {mode === 'cliente' && session?.user.perfis.includes('produtor') && (
        <Button
          title="Abrir área do produtor"
          onPress={() => router.replace('/(produtor)/resumo')}
        />
      )}
      {mode === 'produtor' && session?.user.perfis.includes('cliente') && (
        <Button
          title="Abrir área do cliente"
          onPress={() => router.replace('/(cliente)/catalogo')}
        />
      )}
      <SignOutButton />
    </Screen>
  );
}
