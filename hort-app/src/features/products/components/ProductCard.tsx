import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { offerMoney } from '@/features/catalog/presentation';
import { theme } from '@/shared/theme/tokens';
import { units, type Product } from '../model';

export function ProductCard({
  product,
  disabled,
  onDelete,
}: {
  product: Product;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Image
          source={require('../../../../assets/products/product-illustration.png')}
          style={styles.icon}
          contentFit="contain"
          accessible={false}
        />
        <Text style={styles.name}>{product.name}</Text>
      </View>
      <Text style={styles.text}>
        Valor:{' '}
        <Text style={styles.value}>
          {offerMoney(product.price)} /{' '}
          {units.find((item) => item.value === product.unit)?.label}
        </Text>
      </Text>
      <Text style={styles.text}>
        Estoque: <Text style={styles.value}>{product.stock ?? 0}</Text>
      </Text>
      <Text style={[styles.status, !product.is_active && styles.inactive]}>
        {product.is_active
          ? 'Disponível para venda'
          : 'Indisponível para venda'}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${product.name}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onDelete}
          style={styles.target}
        >
          <View style={styles.delete}>
            <Text style={styles.deleteText}>Excluir</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar ${product.name}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() =>
            router.push({
              pathname: '/(produtor)/produtos/[id]',
              params: { id: String(product.id) },
            })
          }
          style={styles.target}
        >
          <View style={styles.edit}>
            <Text style={styles.editText}>Editar</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    width: 189,
    minHeight: 106.981,
    paddingHorizontal: 12,
    paddingTop: 14.26,
    paddingBottom: 4,
    backgroundColor: '#EFF5ED',
    borderColor: '#AABCA2',
    borderWidth: 1.189,
    borderRadius: 8.112,
    boxShadow: '0px 4.755px 4.755px rgba(0,0,0,0.25)',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  icon: { width: 15.453, height: 15.453, flexShrink: 0 },
  name: {
    fontFamily: theme.fonts.medium,
    fontSize: 12.958,
    lineHeight: 21.396,
    color: '#000000',
    flexShrink: 1,
    includeFontPadding: false,
  },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 11.781,
    lineHeight: 17.67,
    color: '#4E524C',
    paddingLeft: 21,
    includeFontPadding: false,
  },
  value: { color: '#000000' },
  status: {
    fontFamily: theme.fonts.medium,
    fontSize: 9.5,
    lineHeight: 15,
    color: theme.colors.primary,
    paddingLeft: 21,
  },
  inactive: { color: theme.colors.muted },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  target: { minHeight: 48, minWidth: 62, justifyContent: 'center' },
  edit: {
    minHeight: 20.897,
    borderRadius: 3.483,
    paddingHorizontal: 18.111,
    paddingVertical: 3,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delete: {
    minHeight: 20.022,
    borderRadius: 3.337,
    borderWidth: 1.485,
    borderColor: '#FC1A1A',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 17.352,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontFamily: theme.fonts.footer,
    fontSize: 8.451,
    lineHeight: 12.67,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  deleteText: {
    fontFamily: theme.fonts.footer,
    fontSize: 8.097,
    lineHeight: 12.15,
    color: '#FC3134',
    includeFontPadding: false,
  },
});
