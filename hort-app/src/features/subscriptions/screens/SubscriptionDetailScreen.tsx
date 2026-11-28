import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  catalogId,
  itemQuantity,
  offerMoney,
} from '@/features/catalog/presentation';
import { useSubscription } from '../hooks';
import {
  orderedSchedules,
  scheduledBasket,
  subscriptionDate,
  weekday,
} from '../presentation';
import {
  ReadFeedback,
  styles,
  SubscriptionPage,
  SubscriptionStatus,
} from '../components/SubscriptionUI';

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const query = useSubscription(catalogId(id));
  const data =
    query.failure && !query.failure.canRetry ? undefined : query.data;
  const retry = () => void query.refetch({ cancelRefetch: false });
  return (
    <SubscriptionPage back>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          query.validId ? (
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                if (!query.isFetching) retry();
              }}
            />
          ) : undefined
        }
      >
        <Text accessibilityRole="header" style={styles.heading}>
          Detalhes da assinatura
        </Text>
        {!data ? (
          <ReadFeedback
            loading={query.validId && query.isPending}
            message={
              !query.validId
                ? 'Identificador de assinatura inválido.'
                : query.isPending
                  ? 'Carregando assinatura…'
                  : (query.failure?.message ?? 'Assinatura não disponível.')
            }
            retry={
              query.failure?.canRetry && !query.isFetching ? retry : undefined
            }
          />
        ) : (
          <>
            {query.failure && (
              <ReadFeedback
                message={`Os dados podem estar desatualizados. ${query.failure.message}`}
                retry={!query.isFetching ? retry : undefined}
              />
            )}
            <View style={styles.card}>
              <Text style={styles.title}>{data.plano_atual.nome}</Text>
              <View style={styles.row}>
                <SubscriptionStatus status={data.status} />
                <Text style={styles.muted}>#{data.id}</Text>
              </View>
              <Text style={styles.muted}>Valor preservado da contratação</Text>
              <Text style={styles.price}>
                {offerMoney(data.valor_contratado)}
              </Text>
              <Text style={styles.text}>
                Contratada em {subscriptionDate(data.data_assinatura)}
              </Text>
              {data.status === 'ativa' ? (
                <Text style={styles.text}>
                  Renovação prevista: {subscriptionDate(data.data_renovacao)}.
                  Não representa cobrança automática.
                </Text>
              ) : (
                <Text style={styles.text}>
                  Cancelada em {subscriptionDate(data.data_cancelamento)}
                </Text>
              )}
              {!data.plano_atual.is_ativo && (
                <Text style={styles.text}>
                  Este plano está atualmente desativado.
                </Text>
              )}
            </View>
            <Text accessibilityRole="header" style={styles.heading}>
              Programação semanal contratada
            </Text>
            <Text style={styles.muted}>
              {data.status === 'cancelada'
                ? 'Histórico preservado de uma assinatura cancelada.'
                : 'Dias recorrentes da assinatura.'}{' '}
              Esta programação não informa entregas realizadas.
            </Text>
            {!data.programacoes.length && (
              <Text style={styles.text}>
                Esta assinatura não possui programação semanal.
              </Text>
            )}
            {orderedSchedules(data).map((schedule) => (
              <View key={schedule.id} style={styles.card}>
                <Text style={styles.title}>{weekday(schedule.dia_semana)}</Text>
                <Text style={styles.text}>
                  {scheduledBasket(data, schedule.cesta)}
                </Text>
                <Text style={styles.muted}>
                  Ordem contratada: {schedule.ordem}
                </Text>
              </View>
            ))}
            <Text accessibilityRole="header" style={styles.heading}>
              Composição atual do plano
            </Text>
            <Text style={styles.muted}>
              Nomes, produtos e preços abaixo são os atuais e podem ter mudado
              desde a contratação. O valor contratado permanece{' '}
              {offerMoney(data.valor_contratado)}.
            </Text>
            <Text style={styles.text}>
              Valor atual: {offerMoney(data.plano_atual.valor)}
            </Text>
            {!data.plano_atual.cestas.length && (
              <Text style={styles.text}>
                O plano não possui cestas atualmente.
              </Text>
            )}
            {data.plano_atual.cestas.map((basket) => (
              <View key={basket.id} style={styles.card}>
                <Text style={styles.title}>{basket.nome}</Text>
                {!data.programacoes.some(
                  (schedule) => schedule.cesta === basket.id,
                ) && (
                  <Text style={styles.muted}>
                    Sem dia contratado nesta assinatura.
                  </Text>
                )}
                {!basket.itens.length && (
                  <Text style={styles.text}>Cesta sem itens atualmente.</Text>
                )}
                {basket.itens.map((item) => (
                  <View key={item.id}>
                    <Text style={styles.text}>
                      {item.hortalica.name} · {itemQuantity(item)}
                    </Text>
                    <Text style={styles.muted}>
                      Preço unitário atual: {offerMoney(item.hortalica.price)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SubscriptionPage>
  );
}
