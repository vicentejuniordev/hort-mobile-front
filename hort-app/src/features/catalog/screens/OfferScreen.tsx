import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/shared/theme/tokens';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import { CatalogState } from '../components/CatalogState';
import { useCatalogOffer } from '../hooks';
import {
  basketCount,
  catalogId,
  findBasket,
  itemQuantity,
  offerMoney,
} from '../presentation';

export default function OfferScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    cestaId?: string | string[];
  }>();
  const id = catalogId(params.id);
  const basketId = catalogId(params.cestaId);
  const query = useCatalogOffer(id ?? 0);
  const [notice, setNotice] = useState(false);
  const offer =
    query.failure && !query.failure.canRetry ? undefined : query.data;
  const basket = offer && findBasket(offer, basketId);
  const basketPage = params.cestaId !== undefined;
  const close = () => {
    if (basketPage && id !== null) {
      router.dismissTo({
        pathname: '/(cliente)/catalogo/[id]',
        params: { id: String(id) },
      });
    } else if (router.canGoBack()) router.back();
    else router.replace('/(cliente)/catalogo');
  };
  const retry = () => void query.refetch({ cancelRefetch: false });
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.overlay}
      accessibilityViewIsModal
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              basketPage ? 'Voltar ao plano' : 'Fechar detalhe do plano'
            }
            onPress={close}
            style={styles.close}
          >
            <Text style={styles.closeText}>
              {basketPage ? 'Voltar ao plano' : 'Fechar'}
            </Text>
          </Pressable>
          <View style={styles.card}>
            {id === null || (basketPage && basketId === null) ? (
              <CatalogState message="Este link não identifica uma oferta ou cesta válida." />
            ) : !offer ? (
              <CatalogState
                loading={query.isPending}
                message={
                  query.isPending
                    ? 'Carregando plano…'
                    : (query.failure?.message ?? 'Oferta indisponível.')
                }
                action={
                  query.failure?.canRetry
                    ? { label: 'Tentar novamente', run: retry }
                    : undefined
                }
              />
            ) : basketPage && !basket ? (
              <CatalogState message="Esta cesta não está mais disponível nesta oferta." />
            ) : (
              <>
                <View style={styles.heading}>
                  <Image
                    source={require('../../../../assets/auth/produce-basket.png')}
                    contentFit="contain"
                    style={styles.icon}
                    accessible={false}
                  />
                  <Text accessibilityRole="header" style={styles.title}>
                    {basketPage && basket ? basket.nome : offer.nome}
                  </Text>
                </View>
                <Text style={styles.description}>
                  {basketPage ? offer.nome : offer.categoria}
                </Text>
                {!basketPage && (
                  <Text style={styles.price}>{offerMoney(offer.valor)}</Text>
                )}
                {query.failure && (
                  <CatalogState
                    message={`Os dados exibidos podem estar desatualizados. ${query.failure.message}`}
                    action={{ label: 'Tentar novamente', run: retry }}
                  />
                )}
                {query.isRefetching && (
                  <CatalogState loading message="Atualizando oferta…" />
                )}
                {basketPage && basket ? (
                  <View style={styles.composition}>
                    <Text style={styles.section}>Composição da cesta</Text>
                    {basket.itens.length ? (
                      basket.itens.map((item) => (
                        <View key={item.id} style={styles.item}>
                          <Text style={styles.itemName}>
                            {item.hortalica.name}
                          </Text>
                          <Text style={styles.quantity}>
                            {itemQuantity(item)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.description}>
                        Esta cesta ainda não tem itens informados.
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <View style={styles.facts}>
                      <Fact text={basketCount(offer)} />
                      <Fact
                        text={`Periodicidade semanal: ${offer.periodicidade_semanal}`}
                      />
                    </View>
                    <Text style={styles.section}>Cestas do plano</Text>
                    {offer.cestas.length ? (
                      offer.cestas.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver composição de ${item.nome}`}
                          onPress={() =>
                            router.push({
                              pathname:
                                '/(cliente)/catalogo/[id]/cestas/[cestaId]',
                              params: {
                                id: String(offer.id),
                                cestaId: String(item.id),
                              },
                            })
                          }
                          style={({ pressed }) => [
                            styles.basket,
                            pressed && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.itemName}>{item.nome}</Text>
                          <Text style={styles.basketLink}>Ver composição</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.description}>
                        Este plano ainda não tem cestas informadas.
                      </Text>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setNotice(true)}
                      style={({ pressed }) => [
                        styles.subscribeTarget,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={styles.subscribe}>
                        <Text style={styles.subscribeText}>Assinar Plano</Text>
                      </View>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
          {offer && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: query.isFetching }}
              disabled={query.isFetching}
              onPress={retry}
              style={styles.refresh}
            >
              <Text style={styles.closeText}>Atualizar oferta</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <NoticeDialog
        visible={notice}
        onClose={() => setNotice(false)}
        title="Contratação em breve"
        message="A contratação de planos ainda não está disponível no app. Por enquanto, você pode consultar os valores e a composição das cestas."
      />
    </SafeAreaView>
  );
}
function Fact({ text }: { text: string }) {
  return (
    <View style={styles.fact}>
      <Image
        source={require('../../../../assets/catalog/check.svg')}
        style={styles.check}
        accessible={false}
      />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.colors.overlay },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  container: { width: '100%', maxWidth: 308, alignSelf: 'center' },
  close: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
  },
  closeText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  card: {
    minHeight: 392,
    backgroundColor: '#DDE0DB',
    borderWidth: 2,
    borderColor: '#AABCA2',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 38,
    paddingBottom: 32,
    boxShadow: '0px 4px 4px rgba(0,0,0,0.25)',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  icon: { width: 22, height: 22, flexShrink: 0 },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.879,
    lineHeight: 21.455,
    letterSpacing: -0.3576,
    color: '#1E1E1E',
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  description: {
    marginHorizontal: 13,
    fontFamily: theme.fonts.medium,
    fontSize: 11.324,
    lineHeight: 17,
    color: '#1E1E1E',
    marginBottom: 12,
    includeFontPadding: false,
  },
  price: {
    fontFamily: 'InterSemiBold',
    fontSize: 15.325,
    lineHeight: 18.39,
    letterSpacing: -0.3065,
    color: '#3BA55D',
    marginVertical: 8,
    marginLeft: 20,
    includeFontPadding: false,
  },
  facts: { marginVertical: 8, paddingLeft: 5 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 35 },
  check: { width: 17, height: 12, flexShrink: 0 },
  factText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13.934,
    lineHeight: 21,
    color: '#000000',
    flexShrink: 1,
    includeFontPadding: false,
  },
  section: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    lineHeight: 20,
    color: '#1E1E1E',
    marginTop: 14,
    marginBottom: 8,
  },
  basket: {
    minHeight: 58,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderColor: '#AABCA2',
    paddingVertical: 10,
    gap: 4,
  },
  itemName: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: '#1E1E1E',
    flexShrink: 1,
  },
  basketLink: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  subscribeTarget: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  subscribe: {
    width: 184,
    maxWidth: '100%',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  subscribeText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12.675,
    lineHeight: 19,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  composition: { gap: 4 },
  item: {
    borderTopWidth: 1,
    borderColor: '#AABCA2',
    paddingVertical: 12,
    gap: 4,
  },
  quantity: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.primary,
  },
  refresh: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'center',
  },
});
