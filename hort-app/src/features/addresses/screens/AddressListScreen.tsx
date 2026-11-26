import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { accountStyles as styles } from '@/features/account/components/AccountPage';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import { addressApi } from '../api';
import { addressFailure, mergeAddresses, type Address } from '../model';

export default function AddressListScreen() {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const page = useRef(0);
  const flight = useRef<AbortController | null>(null);
  const load = useCallback(async (reset = false) => {
    if (!reset && flight.current && !flight.current.signal.aborted) return;
    flight.current?.abort();
    const controller = new AbortController();
    flight.current = controller;
    const next = reset ? 1 : page.current + 1;
    setLoading(true);
    setError('');
    if (reset) {
      setItems([]);
      setMore(false);
      page.current = 0;
    }
    try {
      const result = await addressApi.list(next, controller.signal);
      if (controller.signal.aborted) return;
      setItems((current) =>
        mergeAddresses(reset ? [] : current, result.results),
      );
      page.current = next;
      setMore(!!result.next);
    } catch (failure) {
      if (!controller.signal.aborted) setError(addressFailure(failure).message);
    } finally {
      if (flight.current === controller) flight.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load(true);
      return () => {
        flight.current?.abort();
      };
    }, [load]),
  );
  return (
    <SafeAreaView style={local.safe}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={local.list}
        ListHeaderComponent={
          <>
            <AccountHeader fallback="/conta" />
            <View style={styles.content}>
              <Text accessibilityRole="header" style={styles.title}>
                Meus endereços
              </Text>
              <Text style={styles.text}>
                Mantenha seus endereços atualizados. Eles ainda não são
                vinculados às assinaturas ou entregas.
              </Text>
              <Button
                label="Adicionar endereço"
                onPress={() => router.push('/enderecos/novo')}
              />
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={local.item}>
            <View style={styles.card}>
              <Text style={styles.heading}>{item.rua}</Text>
              <Text style={styles.text}>{item.bairro}</Text>
              <Text style={styles.text}>
                {item.cidade} · {item.estado}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar endereço: ${item.rua}`}
                onPress={() =>
                  router.push({
                    pathname: '/enderecos/[id]',
                    params: { id: item.id },
                  })
                }
                style={styles.link}
              >
                <Text style={styles.linkText}>Editar endereço</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.content}>
              <Text style={styles.heading}>Nenhum endereço cadastrado</Text>
              <Text style={styles.text}>
                Adicione seu primeiro endereço para encontrá-lo aqui.
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.content}>
            {loading && (
              <ActivityIndicator
                color={theme.colors.primary}
                accessibilityLabel="Carregando endereços"
              />
            )}
            {!!error && (
              <View style={styles.errorBox}>
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {error}
                </Text>
                <Button
                  label="Tentar novamente"
                  onPress={() => void load(page.current === 0)}
                />
              </View>
            )}
            {!loading && !error && more && (
              <Button
                label="Carregar mais endereços"
                onPress={() => void load()}
              />
            )}
            {!loading && !error && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void load(true)}
                style={styles.link}
              >
                <Text style={styles.linkText}>Atualizar lista</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
const local = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  list: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  item: { paddingHorizontal: 24, paddingBottom: 16 },
});
