import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { theme } from '@/shared/theme/tokens';
import { CatalogState } from '../components/CatalogState';
import { OfferCard } from '../components/OfferCard';
import { useCatalog } from '../hooks';
import type { CatalogFilters, Offer } from '../model';

const orders: { label: string; value: CatalogFilters['ordering'] }[] = [
  { label: 'Padrão', value: 'id' },
  { label: 'Nome A–Z', value: 'nome' },
  { label: 'Nome Z–A', value: '-nome' },
  { label: 'Mais recentes', value: '-id' },
];
export default function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState<CatalogFilters['ordering']>('id');
  const catalog = useCatalog({ search, ordering });
  const list = useRef<FlatList<Offer>>(null);
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 350 || fontScale > 1.3 ? 1 : 2;
  const blocked = catalog.failure && !catalog.failure.canRetry;
  const offers = catalog.searchPending || blocked ? [] : catalog.offers;
  const retry = () => void catalog.refetch({ cancelRefetch: false });
  function resetScroll() {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.page}>
        <AccountHeader fallback="/(cliente)/perfil" />
        <FlatList
          ref={list}
          key={columns}
          data={offers}
          numColumns={columns}
          keyExtractor={(offer) => String(offer.id)}
          renderItem={({ item }) => <OfferCard offer={item} />}
          columnWrapperStyle={
            columns === 2
              ? [styles.row, { gap: Math.min(43, width - 336) }]
              : undefined
          }
          contentContainerStyle={[styles.list, columns === 1 && styles.single]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={catalog.isRefetching && !catalog.isFetchingNextPage}
          onRefresh={() => {
            if (!catalog.isFetching && !catalog.searchPending) retry();
          }}
          ListEmptyComponent={
            <CatalogState
              loading={catalog.isPending || catalog.searchPending}
              message={
                catalog.searchPending
                  ? 'Buscando planos…'
                  : catalog.isPending
                    ? 'Carregando planos…'
                    : catalog.failure
                      ? catalog.failure.message
                      : search.trim()
                        ? 'Nenhum plano encontrado para essa busca.'
                        : 'Ainda não há planos disponíveis.'
              }
              action={
                !catalog.isPending &&
                !catalog.searchPending &&
                (catalog.failure?.canRetry || !catalog.failure)
                  ? { label: 'Atualizar catálogo', run: retry }
                  : undefined
              }
            />
          }
          ListHeaderComponent={
            <View style={{ width: '100%' }}>
              <View style={styles.tools}>
                <Text accessibilityRole="header" style={styles.title}>
                  Planos para sua cesta
                </Text>
                <TextInput
                  accessibilityLabel="Buscar planos"
                  placeholder="Buscar planos"
                  placeholderTextColor={theme.colors.muted}
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    resetScroll();
                  }}
                  returnKeyType="search"
                  autoCorrect={false}
                  maxLength={150}
                  style={styles.search}
                />
                <Text style={styles.sortLabel}>Ordenar por</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.orders}
                  keyboardShouldPersistTaps="handled"
                >
                  {orders.map((order) => (
                    <Pressable
                      key={order.value}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: ordering === order.value,
                      }}
                      onPress={() => {
                        setOrdering(order.value);
                        resetScroll();
                      }}
                      style={styles.orderTarget}
                    >
                      <View
                        style={[
                          styles.order,
                          ordering === order.value && styles.selected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.orderText,
                            ordering === order.value && styles.selectedText,
                          ]}
                        >
                          {order.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {offers.length > 0 && catalog.isRefetching && (
                <CatalogState loading message="Atualizando catálogo…" />
              )}
              {offers.length > 0 &&
                catalog.failure &&
                !catalog.isFetchNextPageError && (
                  <CatalogState
                    message={`Os planos exibidos podem estar desatualizados. ${catalog.failure.message}`}
                    action={
                      catalog.failure.canRetry
                        ? { label: 'Tentar novamente', run: retry }
                        : undefined
                    }
                  />
                )}
            </View>
          }
          ListFooterComponent={
            offers.length > 0 ? (
              catalog.failure && catalog.isFetchNextPageError ? (
                <CatalogState
                  message={`Não foi possível carregar mais planos. ${catalog.failure.message}`}
                  action={
                    catalog.failure.canRetry
                      ? {
                          label: 'Tentar novamente',
                          run: catalog.isFetchNextPageError
                            ? () => void catalog.loadMore()
                            : retry,
                        }
                      : undefined
                  }
                />
              ) : catalog.isFetchingNextPage ? (
                <CatalogState loading message="Carregando mais planos…" />
              ) : catalog.hasNextPage && !catalog.failure ? (
                <CatalogState
                  message="Há mais planos disponíveis."
                  action={{
                    label: 'Carregar mais',
                    run: () => void catalog.loadMore(),
                  }}
                />
              ) : undefined
            ) : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  tools: { paddingHorizontal: 7, gap: 6 },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 15.009,
    lineHeight: 23,
    color: '#1E1E1E',
    marginBottom: 6,
  },
  search: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 10,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: '#1E1E1E',
    backgroundColor: '#FAF9F6',
  },
  sortLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 6,
  },
  orders: { gap: 8 },
  orderTarget: { minHeight: 48, justifyContent: 'center' },
  order: {
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  orderText: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    color: theme.colors.primary,
  },
  selectedText: { color: '#FFFFFF' },
  row: { justifyContent: 'center', gap: 43 },
  list: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 21,
    flexGrow: 1,
  },
  single: { alignItems: 'center' },
});
