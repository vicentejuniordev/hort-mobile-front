import { Text, View } from 'react-native';
import {
  ProducerScreen,
  producerStyles as styles,
} from '../components/ProducerScreen';

export default function ProducerSectionScreen({
  section,
}: {
  section: 'produtos' | 'planos';
}) {
  const products = section === 'produtos';
  return (
    <ProducerScreen
      title={products ? 'Seus produtos' : 'Seus planos'}
      subtitle={
        products
          ? 'Organize os alimentos que você oferece.'
          : 'Prepare as cestas que vão compor seus planos.'
      }
    >
      <View style={styles.notice}>
        <Text accessibilityRole="header" style={styles.heading}>
          Em breve
        </Text>
        <Text style={styles.text}>
          {products
            ? 'O cadastro e a edição de produtos estarão disponíveis em uma próxima atualização.'
            : 'A criação de planos, cestas e composição estará disponível em uma próxima atualização.'}
        </Text>
      </View>
    </ProducerScreen>
  );
}
