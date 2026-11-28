import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { offerMoney } from '@/features/catalog/presentation';
import { useProducts } from '@/features/products/hooks';
import { units, type Product } from '@/features/products/model';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import { styles } from './PlanUI';
export function ProductPicker({
  excluded,
  onSelect,
  onClose,
}: {
  excluded: number[];
  onSelect: (product: Product) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const query = useProducts(search);
  const rows =
    query.searchPending || (query.failure && !query.failure.canRetry)
      ? []
      : query.products.filter((product) => !excluded.includes(product.id));
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text accessibilityRole="header" style={styles.heading}>
                Escolha o produto
              </Text>
              <Button compact label="Cancelar seleção" onPress={onClose} />
              <TextInput
                accessibilityLabel="Buscar produto para a cesta"
                value={search}
                onChangeText={setSearch}
                maxLength={150}
                style={styles.search}
                placeholder="Buscar produto"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar ${item.name}`}
              onPress={() => onSelect(item)}
              style={styles.card}
            >
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.text}>
                {offerMoney(item.price)} /{' '}
                {units.find((unit) => unit.value === item.unit)?.label}
              </Text>
              <Text style={styles.muted}>
                {item.is_active === false ? 'Inativo' : 'Ativo'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <CatalogState
              loading={query.isPending || query.searchPending}
              message={
                query.searchPending
                  ? 'Buscando…'
                  : query.isPending
                    ? 'Carregando produtos…'
                    : (query.failure?.message ??
                      'Nenhum produto disponível nesta página. Produtos já vinculados foram omitidos.')
              }
              action={
                query.failure?.canRetry
                  ? {
                      label: 'Tentar novamente',
                      run: () => void query.refetch(),
                    }
                  : undefined
              }
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <CatalogState loading message="Carregando mais produtos…" />
            ) : query.isFetchNextPageError && query.failure ? (
              <CatalogState
                message={query.failure.message}
                action={
                  query.failure.canRetry
                    ? {
                        label: 'Tentar novamente',
                        run: () => void query.loadMore(),
                      }
                    : undefined
                }
              />
            ) : query.failure && rows.length > 0 ? (
              <CatalogState
                message={`A lista pode estar incompleta. ${query.failure.message}`}
                action={
                  query.failure.canRetry
                    ? {
                        label: 'Atualizar produtos',
                        run: () => void query.refetch(),
                      }
                    : undefined
                }
              />
            ) : query.hasNextPage ? (
              <Button
                compact
                label="Carregar mais produtos"
                disabled={query.searchPending || query.isFetching}
                onPress={() => void query.loadMore()}
              />
            ) : undefined
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
