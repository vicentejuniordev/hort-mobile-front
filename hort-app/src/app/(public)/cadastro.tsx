import { Redirect, useLocalSearchParams } from 'expo-router';
import RegistrationScreen from '@/features/auth/screens/RegistrationScreen';

export default function RegistrationRoute() {
  const { perfil } = useLocalSearchParams<{ perfil?: string }>();
  if (perfil !== 'cliente' && perfil !== 'produtor') {
    return <Redirect href="/(public)/escolher-perfil" />;
  }
  return <RegistrationScreen key={perfil} profile={perfil} />;
}
