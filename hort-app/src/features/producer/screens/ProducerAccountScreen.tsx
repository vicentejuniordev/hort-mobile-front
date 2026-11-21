import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '@/shared/session/SessionProvider';
import { Button } from '@/shared/ui/Button';
import {
  ProducerScreen,
  producerStyles as styles,
} from '../components/ProducerScreen';

export default function ProducerAccountScreen() {
  const { session, clearLocalSession } = useSession();
  return (
    <ProducerScreen title="Sua conta">
      <View style={styles.card}>
        <Text style={styles.heading}>{session?.user.nome}</Text>
        <Text selectable style={styles.text}>
          {session?.user.email}
        </Text>
        <Text style={styles.text}>Perfil de produtor</Text>
      </View>
      {session?.user.perfis.includes('cliente') && (
        <Button
          label="Abrir área do cliente"
          onPress={() => router.replace('/(cliente)/catalogo')}
        />
      )}
      <Text style={styles.text}>
        Encerrar este acesso limpa a sessão apenas deste aparelho. As outras
        sessões continuam ativas.
      </Text>
      <Button
        label="Encerrar acesso neste aparelho"
        onPress={clearLocalSession}
      />
    </ProducerScreen>
  );
}
