import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { theme } from '@/shared/theme/tokens';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import { ProductCard } from '../components/ProductCard';
import { useProducts, useProductWriter } from '../hooks';
import { productFailure, type Product } from '../model';

export default function ProductListScreen() {
  const [search, setSearch] = useState('');
  const query = useProducts(search);
  const writer = useProductWriter();
  const list = useRef<FlatList<Product>>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    edit?: number;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 388 || fontScale > 1.3 ? 1 : 2;
  const products =
    query.searchPending || (query.failure && !query.failure.canRetry)
      ? []
      : query.products;
  const refresh = async () => {
    const result = await query.refetch({ cancelRefetch: false });
    if (!result.isError) setUncertain(false);
  };
  async function remove() {
    if (!selected || writer.busy || uncertain) return;
    const product = selected;
    setSelected(null);
    try {
      await writer.run({ kind: 'remove', id: product.id });
      setNotice({ message: 'Produto excluído.' });
    } catch (error) {
      if ((error as { code?: string })?.code === 'cancelled') return;
      const failure = productFailure(error, true);
      setUncertain(failure.uncertain);
      setNotice({
        message: failure.message,
        edit: failure.blocked ? product.id : undefined,
      });
    }
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.page}>
        <AccountHeader fallback="/(produtor)/resumo" />
        <FlatList
          ref={list}
          key={columns}
          numColumns={columns}
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={columns === 1 ? styles.single : undefined}>
              <ProductCard
                product={item}
                disabled={writer.busy || uncertain || query.isRefetching}
                onDelete={() => setSelected(item)}
              />
            </View>
          )}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns === 2 ? styles.row : undefined}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            if (!query.isFetching) void refresh();
          }}
          ListHeaderComponent={
            <View style={styles.tools}>
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={styles.title}>
                  Hortaliças
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar produto"
                  accessibilityState={{ disabled: writer.busy || uncertain }}
                  disabled={writer.busy || uncertain}
                  onPress={() => router.push('/(produtor)/produtos/novo')}
                  style={styles.addTarget}
                >
                  <View style={styles.add}>
                    <Text style={styles.addText}>Adicionar Produto</Text>
                  </View>
                </Pressable>
              </View>
              <Text style={styles.caption}>Produtos ativos e inativos</Text>
              <TextInput
                accessibilityLabel="Buscar produtos"
                placeholder="Buscar produtos"
                placeholderTextColor={theme.colors.muted}
                value={search}
                maxLength={150}
                onChangeText={(value) => {
                  setSearch(value);
                  list.current?.scrollToOffset({ offset: 0, animated: false });
                }}
                style={styles.search}
                autoCorrect={false}
                returnKeyType="search"
              />
              {writer.busy && (
                <ActivityIndicator
                  accessibilityLabel="Excluindo produto"
                  color={theme.colors.primary}
                />
              )}
              {uncertain && (
                <CatalogState
                  message="Confira a lista atualizada antes de alterar outro produto."
                  action={{
                    label: 'Atualizar produtos',
                    run: () => void refresh(),
                  }}
                />
              )}
              {!!products.length &&
                query.failure &&
                !query.isFetchNextPageError && (
                  <CatalogState
                    message={`A lista pode estar desatualizada. ${query.failure.message}`}
                    action={
                      query.failure.canRetry
                        ? {
                            label: 'Tentar novamente',
                            run: () => void refresh(),
                          }
                        : undefined
                    }
                  />
                )}
            </View>
          }
          ListEmptyComponent={
            <CatalogState
              loading={query.isPending || query.searchPending}
              message={
                query.searchPending
                  ? 'Buscando produtos…'
                  : query.isPending
                    ? 'Carregando produtos…'
                    : query.failure
                      ? query.failure.message
                      : search.trim()
                        ? 'Nenhum produto encontrado para essa busca.'
                        : 'Você ainda não cadastrou produtos.'
              }
              action={
                !query.isPending &&
                !query.searchPending &&
                query.failure?.canRetry
                  ? { label: 'Tentar novamente', run: () => void refresh() }
                  : undefined
              }
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <CatalogState loading message="Carregando mais produtos…" />
            ) : query.isFetchNextPageError && query.failure ? (
              <CatalogState
                message={`Não foi possível carregar mais produtos. ${query.failure.message}`}
                action={
                  query.failure.canRetry
                    ? {
                        label: 'Tentar novamente',
                        run: () => void query.loadMore(),
                      }
                    : undefined
                }
              />
            ) : query.hasNextPage && products.length && !query.failure ? (
              <CatalogState
                message="Há mais produtos disponíveis."
                action={{
                  label: 'Carregar mais',
                  run: () => void query.loadMore(),
                }}
              />
            ) : undefined
          }
        />
      </View>
      <NoticeDialog
        visible={!!selected}
        onClose={() => setSelected(null)}
        title="Excluir produto?"
        message={`Deseja excluir “${selected?.name ?? ''}”? Você pode desativá-lo na edição se quiser mantê-lo cadastrado.`}
        closeLabel="Cancelar"
        action={{ label: 'Excluir produto', onPress: () => void remove() }}
      />
      <NoticeDialog
        visible={!!notice}
        onClose={() => setNotice(null)}
        title="Seus produtos"
        message={notice?.message ?? ''}
        action={
          notice?.edit
            ? {
                label: 'Editar produto',
                onPress: () => {
                  const id = notice.edit;
                  setNotice(null);
                  router.push({
                    pathname: '/(produtor)/produtos/[id]',
                    params: { id: String(id) },
                  });
                },
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  list: { flexGrow: 1, paddingHorizontal: 2, paddingBottom: 24, gap: 16 },
  single: { alignItems: 'center' },
  row: { justifyContent: 'center', gap: 6 },
  tools: { width: '100%', paddingHorizontal: 32, gap: 8, marginBottom: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.739,
    lineHeight: 27,
    color: '#1B5E20',
    flexShrink: 1,
  },
  caption: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.muted,
  },
  search: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 5,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: '#000000',
  },
  addTarget: { minHeight: 48, justifyContent: 'center' },
  add: {
    minHeight: 23,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 17.354,
    paddingVertical: 5,
  },
  addText: {
    fontFamily: theme.fonts.bold,
    fontSize: 8.454,
    lineHeight: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
