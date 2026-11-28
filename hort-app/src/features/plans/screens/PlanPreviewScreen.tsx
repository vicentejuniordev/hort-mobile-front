import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import {
  catalogId,
  itemQuantity,
  offerMoney,
} from '@/features/catalog/presentation';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { PlanPage, ReadProblem, styles } from '../components/PlanUI';
import { useBaskets, usePlan, usePlanProduct } from '../hooks';
import type { BasketItem } from '../model';

type Row =
  | { key: string; kind: 'basket'; name: string; empty: boolean }
  | { key: string; kind: 'item'; item: BasketItem };

function PreviewItem({ item }: { item: BasketItem }) {
  const product = usePlanProduct(item.hortalica);
  return (
    <View style={preview.item}>
      {product.failure || !product.data ? (
        <ReadProblem query={product} />
      ) : (
        <>
          <Text style={styles.title}>{product.data.name}</Text>
          <Text style={styles.text}>
            {itemQuantity({
              quantidade: item.quantidade,
              hortalica: product.data,
            })}
          </Text>
        </>
      )}
    </View>
  );
}

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = catalogId(params.id);
  const query = usePlan(id);
  const baskets = useBaskets(id);
  const plan = query.failure ? undefined : query.data;
  const rows: Row[] =
    baskets.failure && !baskets.failure.canRetry
      ? []
      : baskets.baskets.flatMap((basket): Row[] => [
          {
            key: `basket:${basket.id}`,
            kind: 'basket',
            name: basket.nome,
            empty: !basket.itens.length,
          },
          ...basket.itens.map((item): Row => ({
            key: `item:${item.id}`,
            kind: 'item',
            item,
          })),
        ]);
  return (
    <PlanPage>
      {!plan ? (
        <ReadProblem query={query} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text accessibilityRole="header" style={styles.heading}>
                Prévia da oferta
              </Text>
              <Text style={styles.muted}>
                {plan.is_ativo
                  ? 'Publicado no catálogo.'
                  : 'Rascunho: esta oferta ainda não aparece no catálogo.'}{' '}
                Confira os dados salvos antes de publicar.
              </Text>
              <View style={preview.card}>
                <View style={preview.heading}>
                  <Image
                    source={require('../../../../assets/auth/produce-basket.png')}
                    contentFit="contain"
                    style={{ width: 22, height: 22 }}
                    accessible={false}
                  />
                  <Text accessibilityRole="header" style={preview.title}>
                    {plan.nome}
                  </Text>
                </View>
                <Text style={styles.text}>{plan.categoria}</Text>
                <Text style={preview.price}>{offerMoney(plan.valor)}</Text>
                <Text style={styles.muted}>
                  Valor atual calculado pelo servidor.
                </Text>
                <Text style={styles.text}>
                  Periodicidade semanal: {plan.periodicidade_semanal}
                </Text>
                {baskets.data && (
                  <Text style={styles.text}>
                    {baskets.data.pages[0].count}{' '}
                    {baskets.data.pages[0].count === 1 ? 'cesta' : 'cestas'} no
                    plano
                  </Text>
                )}
              </View>
              <Button
                compact
                label="Voltar à gestão do plano"
                onPress={() =>
                  router.dismissTo({
                    pathname: '/(produtor)/planos/[id]',
                    params: { id: plan.id },
                  })
                }
              />
              <Text accessibilityRole="header" style={styles.heading}>
                Composição das cestas
              </Text>
              {!!baskets.failure &&
                rows.length > 0 &&
                !baskets.isFetchNextPageError && (
                  <ReadProblem query={baskets} />
                )}
            </View>
          }
          renderItem={({ item: row }) =>
            row.kind === 'item' ? (
              <PreviewItem item={row.item} />
            ) : (
              <View style={preview.basket}>
                <Text accessibilityRole="header" style={styles.title}>
                  {row.name}
                </Text>
                {row.empty && (
                  <Text style={styles.muted}>
                    Esta cesta ainda não possui produtos.
                  </Text>
                )}
              </View>
            )
          }
          ListEmptyComponent={
            baskets.failure || baskets.isPending ? (
              <ReadProblem query={baskets} />
            ) : (
              <CatalogState message="Este plano ainda não possui cestas." />
            )
          }
          ListFooterComponent={
            baskets.isFetchNextPageError ? (
              <CatalogState
                message={
                  baskets.failure?.message ??
                  'Não foi possível carregar a composição.'
                }
                action={
                  baskets.failure?.canRetry
                    ? {
                        label: 'Tentar novamente',
                        run: () => void baskets.loadMore(),
                      }
                    : undefined
                }
              />
            ) : baskets.hasNextPage ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.muted}>
                  A prévia está parcial. Carregue as demais cestas para conferir
                  toda a composição.
                </Text>
                <Button
                  compact
                  label="Carregar mais cestas"
                  loading={baskets.isFetchingNextPage}
                  onPress={() => void baskets.loadMore()}
                />
              </View>
            ) : undefined
          }
        />
      )}
    </PlanPage>
  );
}

const preview = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 308,
    alignSelf: 'center',
    backgroundColor: '#DDE0DB',
    borderColor: '#AABCA2',
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: '#1E1E1E',
  },
  price: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    color: '#3BA55D',
  },
  basket: { paddingTop: 20, paddingBottom: 8, gap: 8 },
  item: {
    borderBottomWidth: 1,
    borderColor: '#DDE0DB',
    paddingVertical: 12,
    gap: 4,
  },
});
