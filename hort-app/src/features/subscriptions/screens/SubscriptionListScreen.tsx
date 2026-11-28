import { useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button } from '@/shared/ui/Button';
import { offerMoney } from '@/features/catalog/presentation';
import { useSubscriptions } from '../hooks';
import type { Subscription } from '../model';
import { subscriptionDate, subscriptionDays } from '../presentation';
import {
  FilterChips,
  ReadFeedback,
  ReadFooter,
  styles,
  SubscriptionPage,
  SubscriptionStatus,
} from '../components/SubscriptionUI';

const filters = [
  { label: 'Todas', value: 'todas' },
  { label: 'Ativas', value: 'ativa' },
  { label: 'Canceladas', value: 'cancelada' },
] as const;

export default function SubscriptionListScreen() {
  const [status, setStatus] = useState<'todas' | 'ativa' | 'cancelada'>(
    'todas',
  );
  const query = useSubscriptions({
    status: status === 'todas' ? undefined : status,
  });
  const list = useRef<FlatList<Subscription>>(null);
  const rows =
    query.failure && !query.failure.canRetry ? [] : query.subscriptions;
  const retry = () => void query.refetch({ cancelRefetch: false });
  return (
    <SubscriptionPage>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          if (!query.isFetching) retry();
        }}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={styles.heading}>
              Minhas assinaturas
            </Text>
            <FilterChips
              options={filters}
              value={status}
              onChange={(value) => {
                setStatus(value);
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }}
            />
          </View>
        }
        ListEmptyComponent={
          <ReadFeedback
            loading={query.isPending}
            message={
              query.isPending
                ? 'Carregando assinaturas…'
                : (query.failure?.message ?? 'Nenhuma assinatura encontrada.')
            }
            retry={
              !query.isFetching && query.failure?.canRetry ? retry : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTitle}>
              <Image
                source={require('../../../../assets/auth/produce-basket.png')}
                style={styles.icon}
                accessible={false}
              />
              <Text style={styles.title}>{item.plano_atual.nome}</Text>
            </View>
            <View style={styles.row}>
              <SubscriptionStatus status={item.status} />
              <Text style={styles.muted}>Assinatura #{item.id}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.muted}>Valor contratado</Text>
            <Text style={styles.price}>
              {offerMoney(item.valor_contratado)}
            </Text>
            <Text style={styles.text}>{subscriptionDays(item)}</Text>
            {item.status === 'ativa' ? (
              <Text style={styles.muted}>
                Renovação prevista: {subscriptionDate(item.data_renovacao)}. Sem
                cobrança automática.
              </Text>
            ) : (
              <Text style={styles.muted}>
                Programação preservada como histórico após o cancelamento.
              </Text>
            )}
            {!item.plano_atual.is_ativo && (
              <Text style={styles.muted}>Plano atualmente desativado</Text>
            )}
            <Button
              compact
              label={`Ver assinatura #${item.id}`}
              onPress={() =>
                router.push({
                  pathname: '/(cliente)/assinaturas/[id]',
                  params: { id: item.id },
                })
              }
            />
          </View>
        )}
        ListFooterComponent={
          <ReadFooter
            failure={query.failure}
            hasData={rows.length > 0}
            fetching={query.isFetching}
            hasNextPage={!!query.hasNextPage}
            retry={() => {
              if (query.isFetchNextPageError) void query.loadMore();
              else retry();
            }}
            loadMore={() => void query.loadMore()}
          />
        }
      />
    </SubscriptionPage>
  );
}
