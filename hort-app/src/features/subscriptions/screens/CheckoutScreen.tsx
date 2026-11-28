import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/shared/session/SessionProvider';
import { privateScope } from '@/shared/query/cache';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import {
  catalogId,
  itemQuantity,
  offerMoney,
} from '@/features/catalog/presentation';
import { useCatalogOffer } from '@/features/catalog/hooks';
import { useSubscriptionCheckout } from '../useSubscriptionCheckout';
import { checkoutFailure, type CheckoutReceipt } from '../checkout';
import {
  checkoutFieldMessages,
  matchesCheckoutBaskets,
  selectCheckoutDays,
  selectionFrom,
} from '../checkoutPresentation';
import { weekday, weekdays } from '../presentation';
import {
  ReadFeedback,
  styles,
  SubscriptionPage,
} from '../components/SubscriptionUI';
import { SubscriptionConfirmation } from '../components/SubscriptionConfirmation';

type Checkout = ReturnType<typeof useSubscriptionCheckout>;
export default function CheckoutScreen() {
  const { plano } = useLocalSearchParams<{ plano?: string | string[] }>();
  const requested = catalogId(plano);
  const checkout = useSubscriptionCheckout();
  const session = useSession();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const planId = requested ?? checkout.intent?.payload.plano ?? null;
  return (
    <SubscriptionPage back>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          Contratar plano
        </Text>
        {plano !== undefined && requested === null ? (
          <ReadFeedback message="Identificador de plano inválido." />
        ) : !checkout.loaded ? (
          <ReadFeedback loading message="Recuperando tentativa salva…" />
        ) : checkout.failure && !checkout.intent ? (
          <ReadFeedback
            message={checkout.failure.message}
            retry={() => void checkout.restore()}
          />
        ) : !planId ? (
          <>
            <Text style={styles.text}>
              Você não tem uma contratação salva neste aparelho. Escolha um
              plano no catálogo.
            </Text>
            <Button
              label="Ver catálogo"
              onPress={() => router.navigate('/(cliente)/catalogo')}
            />
          </>
        ) : checkout.intent?.phase === 'uncertain' &&
          checkout.intent.payload.plano !== planId ? (
          <>
            <ReadFeedback message="Existe uma contratação com resultado incerto. Retome essa tentativa antes de iniciar outra." />
            <Button
              label="Retomar tentativa anterior"
              onPress={() =>
                router.replace({
                  pathname: '/(cliente)/assinaturas/contratar',
                  params: { plano: checkout.intent!.payload.plano },
                })
              }
            />
          </>
        ) : (
          <CheckoutFlow
            key={`${privateScope(session)}:${planId}`}
            onStep={() => scroll.current?.scrollTo({ y: 0, animated: false })}
            planId={planId}
            checkout={checkout}
          />
        )}
      </ScrollView>
    </SubscriptionPage>
  );
}
function CheckoutFlow({
  planId,
  checkout,
  onStep,
}: {
  planId: number;
  checkout: Checkout;
  onStep: () => void;
}) {
  const query = useCatalogOffer(planId, true);
  const offer = query.failure ? undefined : query.data;
  const saved =
    checkout.intent?.payload.plano === planId ? checkout.intent : null;
  const [step, setStep] = useState<'days' | 'review'>(
    saved ? 'review' : 'days',
  );
  const [days, setDays] = useState(() => selectionFrom(saved));
  const [newPurchase, setNewPurchase] = useState(false);
  const [again, setAgain] = useState(false);
  const [localError, setLocalError] = useState('');
  const [receipt, setReceipt] = useState<
    (CheckoutReceipt & { saved: boolean }) | null
  >(null);
  const result =
    receipt ??
    (!newPurchase && saved?.phase === 'confirmed' && saved.receipt
      ? { ...saved.receipt, saved: true }
      : null);
  const uncertain = saved?.phase === 'uncertain';
  const reviewing = uncertain || (step === 'review' && !!saved && !newPurchase);
  const retryOffer = () => void query.refetch({ cancelRefetch: false });
  const viewSubscription = (id: number) =>
    router.replace({ pathname: '/(cliente)/assinaturas/[id]', params: { id } });
  async function review() {
    if (!offer || checkout.busy) return;
    try {
      const payload = selectCheckoutDays(offer, days);
      setLocalError('');
      const prepared = await checkout.prepare(
        payload,
        offer.cestas.map((basket) => basket.id),
        newPurchase,
      );
      if (prepared) {
        setNewPurchase(false);
        setStep('review');
        onStep();
      }
    } catch (error) {
      setLocalError(checkoutFailure(error).message);
    }
  }
  async function confirm() {
    if (!saved || checkout.busy) return;
    if (
      !uncertain &&
      (!offer ||
        !matchesCheckoutBaskets(offer, saved.payload) ||
        query.isFetching)
    )
      return;
    const confirmed = await checkout.submit();
    if (confirmed) {
      setReceipt(confirmed);
      onStep();
    }
  }
  if (result)
    return (
      <>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Contratação confirmada
          </Text>
          <Text style={styles.text}>Assinatura #{result.id}</Text>
          <Text style={styles.muted}>
            Valor contratado informado pelo servidor
          </Text>
          <Text style={styles.price}>
            {offerMoney(result.valor_contratado)}
          </Text>
          <Text style={styles.text}>
            A contratação não realiza pagamento ou cobrança automática.
          </Text>
          {!result.saved && (
            <Text accessibilityRole="alert" style={styles.text}>
              A contratação foi confirmada, mas o recibo não pôde ser salvo
              neste aparelho. A tentativa anterior foi preservada para
              recuperação segura.
            </Text>
          )}
        </View>
        <Button
          label={`Ver assinatura #${result.id}`}
          onPress={() => viewSubscription(result.id)}
        />
        <Button
          label="Ver agenda"
          onPress={() => router.navigate('/(cliente)/agenda')}
        />
        {offer && (
          <Button
            label="Contratar este plano novamente"
            onPress={() => setAgain(true)}
          />
        )}
        <SubscriptionConfirmation
          visible={again}
          title="Nova contratação"
          message="Você já confirmou uma contratação deste plano. Deseja iniciar outra assinatura independente?"
          confirmLabel="Escolher dias da nova assinatura"
          onClose={() => setAgain(false)}
          onConfirm={() => {
            setAgain(false);
            setReceipt(null);
            setNewPurchase(true);
            setStep('days');
            onStep();
            setDays({});
          }}
        />
      </>
    );
  return (
    <>
      <Text style={styles.text}>
        {reviewing
          ? 'Revise a programação antes de confirmar.'
          : 'Escolha um dia da semana diferente para cada cesta.'}
      </Text>
      <Text style={styles.muted}>
        A programação é semanal. Não há endereço vinculado, status de entrega
        realizada ou pagamento neste fluxo.
      </Text>
      {checkout.failure && (
        <View>
          <ReadFeedback message={checkout.failure.message} />
          {checkoutFieldMessages(checkout.failure.details).map(
            (message, index) => (
              <Text key={index} accessibilityRole="alert" style={ui.error}>
                {message}
              </Text>
            ),
          )}
        </View>
      )}
      {!!localError && (
        <Text accessibilityRole="alert" style={ui.error}>
          {localError}
        </Text>
      )}
      {reviewing && saved ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>
              {offer?.nome ?? `Plano #${planId}`}
            </Text>
            <Text style={styles.muted}>Programação salva nesta tentativa</Text>
            {saved.payload.programacoes.map((entry, index) => (
              <View key={entry.cesta} style={ui.line}>
                <Text style={styles.text}>
                  {index + 1}.{' '}
                  {offer?.cestas.find((basket) => basket.id === entry.cesta)
                    ?.nome ?? `Cesta #${entry.cesta}`}
                </Text>
                <Text style={styles.heading}>{weekday(entry.dia_semana)}</Text>
              </View>
            ))}
          </View>
          {uncertain ? (
            <>
              <Text accessibilityRole="alert" style={styles.text}>
                O resultado anterior ainda não foi confirmado. Retomar usa os
                mesmos dados e recupera a assinatura se ela já tiver sido
                criada. Isso também funciona quando a oferta sai do catálogo.
              </Text>
              <Button
                label="Retomar mesma tentativa"
                loading={checkout.busy}
                onPress={() => void confirm()}
              />
              <Button
                label="Consultar minhas assinaturas"
                onPress={() => router.navigate('/(cliente)/assinaturas')}
              />
            </>
          ) : (
            <>
              {!offer ? (
                <ReadFeedback
                  loading={query.isPending}
                  message={
                    query.failure?.message ??
                    'Consultando valor atual da oferta…'
                  }
                  retry={query.failure?.canRetry ? retryOffer : undefined}
                />
              ) : (
                <>
                  <View style={[styles.card, ui.summary]}>
                    <Text style={styles.muted}>Valor atual de referência</Text>
                    <Text style={styles.price}>{offerMoney(offer.valor)}</Text>
                    <Text style={styles.muted}>
                      O valor final será informado pelo servidor ao confirmar.
                      Alterações concorrentes na oferta podem mudar esse valor.
                    </Text>
                  </View>
                  {!matchesCheckoutBaskets(offer, saved.payload) && (
                    <ReadFeedback message="As cestas do plano mudaram. Escolha novamente os dias para revisar a nova composição." />
                  )}
                  <Button
                    label="Confirmar contratação"
                    loading={checkout.busy}
                    disabled={
                      query.isFetching ||
                      !matchesCheckoutBaskets(offer, saved.payload)
                    }
                    onPress={() => void confirm()}
                  />
                </>
              )}
              <Button
                label="Alterar dias"
                disabled={checkout.busy}
                onPress={() => {
                  setDays(selectionFrom(saved));
                  setStep('days');
                  onStep();
                }}
              />
            </>
          )}
        </>
      ) : !offer ? (
        <ReadFeedback
          loading={query.isPending}
          message={query.failure?.message ?? 'Carregando oferta…'}
          retry={query.failure?.canRetry ? retryOffer : undefined}
        />
      ) : (
        <>
          <View style={[styles.card, ui.summary]}>
            <Text style={styles.title}>{offer.nome}</Text>
            <Text style={styles.muted}>Valor atual do plano</Text>
            <Text style={styles.price}>{offerMoney(offer.valor)}</Text>
          </View>
          {offer.cestas.map((basket) => (
            <View key={basket.id} style={styles.card}>
              <Text accessibilityRole="header" style={styles.title}>
                {basket.nome}
              </Text>
              {basket.itens.map((item) => (
                <Text key={item.id} style={styles.text}>
                  {item.hortalica.name} · {itemQuantity(item)}
                </Text>
              ))}
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={`Dia de ${basket.nome}`}
                style={ui.days}
              >
                {weekdays.map((label, index) => {
                  const day = index + 1;
                  const selected = days[basket.id] === day;
                  const used = Object.entries(days).some(
                    ([id, selectedDay]) =>
                      Number(id) !== basket.id &&
                      offer.cestas.some((entry) => entry.id === Number(id)) &&
                      selectedDay === day,
                  );
                  const disabled = checkout.busy || used;
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityLabel={`${basket.nome}: ${label}${used ? ', já escolhido para outra cesta' : ''}`}
                      accessibilityState={{ checked: selected, disabled }}
                      disabled={disabled}
                      onPress={() => {
                        setDays((previous) => ({
                          ...previous,
                          [basket.id]: day,
                        }));
                        setLocalError('');
                      }}
                      style={[
                        ui.day,
                        selected && ui.selected,
                        disabled && ui.disabled,
                      ]}
                    >
                      <Text style={[styles.text, selected && ui.selectedText]}>
                        {label}
                        {used ? ' · Em uso' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!!days[basket.id] && (
                <Button
                  compact
                  label={`Limpar dia de ${basket.nome}`}
                  disabled={checkout.busy}
                  onPress={() =>
                    setDays((previous) => ({
                      ...previous,
                      [basket.id]: undefined,
                    }))
                  }
                />
              )}
            </View>
          ))}
          <Button
            label="Revisar contratação"
            loading={checkout.busy}
            disabled={
              query.isFetching ||
              offer.cestas.length < 1 ||
              offer.cestas.length > 7
            }
            onPress={() => void review()}
          />
        </>
      )}
      {offer && (
        <Button
          compact
          label="Atualizar oferta"
          disabled={query.isFetching || checkout.busy}
          onPress={retryOffer}
        />
      )}
      <Text style={styles.muted}>
        Você pode sair desta tela e retomar a tentativa salva pela aba
        Assinaturas. Dias ainda não revisados ficam apenas nesta tela.
      </Text>
    </>
  );
}
const ui = StyleSheet.create({
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: {
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#AABCA2',
    justifyContent: 'center',
    flexGrow: 1,
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectedText: { color: theme.colors.surface },
  disabled: { opacity: 0.5 },
  summary: { backgroundColor: '#F3F9EC' },
  line: {
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#AABCA2',
    paddingBottom: 12,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.error,
    lineHeight: 22,
  },
});
