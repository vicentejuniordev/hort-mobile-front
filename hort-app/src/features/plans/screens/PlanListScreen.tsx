import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { offerMoney } from '@/features/catalog/presentation';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import { PlanPage, styles } from '../components/PlanUI';
import { usePlans } from '../hooks';
import type { Plan } from '../model';
export default function PlanListScreen() {
  const [search, setSearch] = useState('');
  const query = usePlans(search);
  const list = useRef<FlatList<Plan>>(null);
  const rows =
    query.searchPending || (query.failure && !query.failure.canRetry)
      ? []
      : query.plans;
  const refresh = () => {
    if (!query.isFetching) void query.refetch({ cancelRefetch: false });
  };
  return (
    <PlanPage>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={styles.heading}>
                Seus planos
              </Text>
              <Button
                compact
                label="Novo Plano"
                onPress={() => router.push('/(produtor)/planos/novo')}
              />
            </View>
            <Text style={styles.muted}>Planos publicados e rascunhos</Text>
            <TextInput
              accessibilityLabel="Buscar planos do produtor"
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              placeholder="Buscar planos"
              placeholderTextColor={theme.colors.muted}
              maxLength={150}
              style={styles.search}
            />
            {query.failure && rows.length > 0 && !query.isFetchNextPageError ? (
              <CatalogState
                message={`A lista pode estar desatualizada. ${query.failure.message}`}
                action={{ label: 'Atualizar', run: refresh }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Image
                source={require('../../../../assets/auth/produce-basket.png')}
                style={{ width: 29, height: 29 }}
                accessible={false}
              />
              <Text style={styles.title}>{item.nome}</Text>
            </View>
            <Text style={styles.text}>
              {item.is_ativo ? 'Publicado' : 'Rascunho'} · {item.categoria}
            </Text>
            <Text style={styles.muted}>
              Periodicidade semanal informada: {item.periodicidade_semanal}
            </Text>
            <Text style={styles.text}>
              Valor atual: {offerMoney(item.valor)}
            </Text>
            <View style={styles.divider} />
            <Button
              compact
              label={`Gerenciar ${item.nome}`}
              onPress={() =>
                router.push({
                  pathname: '/(produtor)/planos/[id]',
                  params: { id: item.id },
                })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <CatalogState
            loading={query.isPending || query.searchPending}
            message={
              query.searchPending
                ? 'Buscando planos…'
                : query.isPending
                  ? 'Carregando planos…'
                  : (query.failure?.message ?? 'Nenhum plano encontrado.')
            }
            action={
              query.failure?.canRetry
                ? { label: 'Tentar novamente', run: refresh }
                : undefined
            }
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <CatalogState loading message="Carregando mais planos…" />
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
          ) : query.hasNextPage && !query.failure ? (
            <Button
              compact
              label="Carregar mais planos"
              onPress={() => void query.loadMore()}
            />
          ) : undefined
        }
      />
    </PlanPage>
  );
}
