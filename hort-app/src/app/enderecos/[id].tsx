import { useLocalSearchParams } from 'expo-router';
import AddressFormScreen from '@/features/addresses/screens/AddressFormScreen';
import { addressId } from '@/features/addresses/model';
export default function EditAddress() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <AddressFormScreen key={JSON.stringify(id)} id={addressId(id)} />;
}
