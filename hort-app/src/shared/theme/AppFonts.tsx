import { loadAsync } from 'expo-font';
import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from './tokens';

const fonts = {
  PoppinsRegular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  PoppinsMedium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  PoppinsSemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  PoppinsBold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  IstokWebBold: require('@expo-google-fonts/istok-web/700Bold/IstokWeb_700Bold.ttf'),
};

export function AppFonts({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  useEffect(() => {
    let active = true;
    loadAsync(fonts).then(
      () => {
        if (active) setStatus('ready');
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  if (status === 'ready') return children;
  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Abrindo Hort"
        />
      ) : (
        <>
          <Text accessibilityRole="alert">Não foi possível abrir o Hort.</Text>
          <Button
            title="Tentar novamente"
            color={theme.colors.primary}
            onPress={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
            }}
          />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: theme.colors.background,
  },
});
