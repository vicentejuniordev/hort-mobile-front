import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSession } from '@/shared/session/SessionProvider';
import { Button } from '@/shared/ui/Button';
import {
  ProducerScreen,
  producerStyles as styles,
} from '../components/ProducerScreen';

export default function ProducerSummaryScreen() {
  const { session } = useSession();
  return (
    <ProducerScreen
      title={`Olá, ${session?.user.nome ?? ''}.`}
      subtitle="Bem-vindo ao seu espaço de produtor."
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Sua produção
      </Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Produtos</Text>
        <Text style={styles.text}>
          Um espaço para organizar os alimentos que você produz.
        </Text>
        <Button
          label="Ver produtos"
          onPress={() => router.navigate('/(produtor)/produtos')}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Planos e cestas</Text>
        <Text style={styles.text}>
          Reúna seus produtos em cestas e prepare seus planos.
        </Text>
        <Button
          label="Ver planos"
          onPress={() => router.navigate('/(produtor)/planos')}
        />
      </View>
    </ProducerScreen>
  );
}
