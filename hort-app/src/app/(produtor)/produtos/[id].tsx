import { useLocalSearchParams } from 'expo-router';
import { catalogId } from '@/features/catalog/presentation';
import ProductFormScreen from '@/features/products/screens/ProductFormScreen';
export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <ProductFormScreen key={String(id)} id={catalogId(id)} />;
}
