import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/shared/ui/Button';
import type { Subscription } from '../model';
import { useCancelSubscription } from '../useCancelSubscription';
import { SubscriptionConfirmation } from './SubscriptionConfirmation';
import { ReadFeedback, styles } from './SubscriptionUI';

export function CancelSubscriptionAction({
  subscription,
  refreshedAt,
  refreshing,
  refresh,
}: {
  subscription: Subscription;
  refreshedAt: number;
  refreshing: boolean;
  refresh: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const command = useCancelSubscription();
  const uncertain =
    command.failure?.uncertain && refreshedAt <= command.failure.at;
  const cancelled = confirmed || subscription.status === 'cancelada';
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Cancelamento
      </Text>
      {cancelled ? (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {confirmed
            ? 'Cancelamento confirmado pelo servidor.'
            : 'Esta assinatura está cancelada.'}{' '}
          O valor e a programação permanecem como histórico.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Cancelar encerra esta assinatura e preserva seu histórico. Não há
            cobrança ou reembolso neste fluxo.
          </Text>
          {command.failure && (
            <ReadFeedback
              message={command.failure.message}
              retry={!refreshing && !command.busy ? refresh : undefined}
            />
          )}
          <Button
            label="Cancelar assinatura"
            loading={command.busy}
            disabled={refreshing || !!uncertain}
            onPress={() => setAsking(true)}
          />
          {!!uncertain && (
            <Text style={styles.muted}>
              Consulte a situação atual para verificar se o cancelamento já foi
              realizado.
            </Text>
          )}
        </>
      )}
      <SubscriptionConfirmation
        visible={asking && !cancelled}
        title="Cancelar assinatura?"
        message={`Deseja cancelar a assinatura #${subscription.id}? A programação será preservada como histórico de uma assinatura cancelada.`}
        confirmLabel="Confirmar cancelamento"
        busy={command.busy}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          void command.run(subscription.id).then((result) => {
            setAsking(false);
            if (result) setConfirmed(true);
          });
        }}
      />
    </View>
  );
}
