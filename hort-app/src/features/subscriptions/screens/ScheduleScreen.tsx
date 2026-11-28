import { useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/shared/ui/Button';
import {
  useRefreshSubscriptions,
  useSchedules,
  useSubscription,
} from '../hooks';
import type { Schedule } from '../model';
import { scheduledBasket, weekday, weekdays } from '../presentation';
import {
  FilterChips,
  ReadFeedback,
  ReadFooter,
  styles,
  SubscriptionPage,
  SubscriptionStatus,
} from '../components/SubscriptionUI';

const days = [
  { label: 'Todos os dias', value: 0 },
  ...weekdays.map((label, index) => ({ label, value: index + 1 })),
];

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  // The schedule endpoint has no subscription status. Resolve it independently,
  // sharing the private detail cache across rows of the same subscription.
  const query = useSubscription(schedule.assinatura);
  const data =
    query.failure && !query.failure.canRetry ? undefined : query.data;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{weekday(schedule.dia_semana)}</Text>
      <Text style={styles.text}>
        {data
          ? scheduledBasket(data, schedule.cesta)
          : `Cesta #${schedule.cesta}`}
      </Text>
      <Text style={styles.muted}>
        Assinatura #{schedule.assinatura} · Ordem {schedule.ordem}
      </Text>
      {data && (
        <>
          <Text style={styles.text}>{data.plano_atual.nome}</Text>
          <View style={styles.row}>
            <SubscriptionStatus status={data.status} />
          </View>
          {data.status === 'cancelada' && (
            <Text style={styles.muted}>
              Registro histórico de assinatura cancelada. Não indica entrega
              prevista.
            </Text>
          )}
        </>
      )}
      {query.isPending && !query.failure && (
        <Text style={styles.muted}>Consultando situação da assinatura…</Text>
      )}
      {query.failure && (
        <ReadFeedback
          message={`Situação da assinatura não confirmada. ${query.failure.message}`}
          retry={
            query.failure.canRetry && !query.isFetching
              ? () => void query.refetch({ cancelRefetch: false })
              : undefined
          }
        />
      )}
      <Button
        compact
        label={`Ver assinatura #${schedule.assinatura}`}
        onPress={() =>
          router.push({
            pathname: '/(cliente)/assinaturas/[id]',
            params: { id: schedule.assinatura },
          })
        }
      />
    </View>
  );
}

export default function ScheduleScreen() {
  const [day, setDay] = useState(0);
  const query = useSchedules({ dia_semana: day || undefined });
  const refresh = useRefreshSubscriptions();
  const list = useRef<FlatList<Schedule>>(null);
  const rows = query.failure && !query.failure.canRetry ? [] : query.schedules;
  const retry = () => void refresh();
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
              Agenda semanal
            </Text>
            <Text style={styles.muted}>
              Dias recorrentes e histórico de programações. Não informa entregas
              realizadas.
            </Text>
            <FilterChips
              options={days}
              value={day}
              onChange={(value) => {
                setDay(value);
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
                ? 'Carregando programação…'
                : (query.failure?.message ??
                  'Nenhuma programação encontrada para estes dias.')
            }
            retry={
              query.failure?.canRetry && !query.isFetching ? retry : undefined
            }
          />
        }
        renderItem={({ item }) => <ScheduleCard schedule={item} />}
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
