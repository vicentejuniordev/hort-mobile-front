import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { catalogId, offerMoney } from '@/features/catalog/presentation';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { Button } from '@/shared/ui/Button';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import {
  CommandFeedback,
  PlanPage,
  ReadProblem,
  styles,
} from '../components/PlanUI';
import { useBaskets, usePlan, usePlanCommand } from '../hooks';
import type { PlanCommand } from '../model';
export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = catalogId(params.id);
  const query = usePlan(id);
  const baskets = useBaskets(id);
  const command = usePlanCommand();
  const [confirm, retainConfirmation] = useState<PlanCommand | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  function setConfirm(action: PlanCommand | null) {
    if (action) retainConfirmation(action);
    setConfirmVisible(!!action);
  }
  const plan = query.data;
  const blocked =
    command.busy ||
    !!command.failure?.uncertain ||
    query.isFetching ||
    !!query.failure;
  const rows =
    baskets.failure && !baskets.failure.canRetry ? [] : baskets.baskets;
  const refresh = () => {
    if (!query.isFetching && !baskets.isFetching && !command.busy) {
      void query.refetch({ cancelRefetch: false });
      void baskets.refetch({ cancelRefetch: false });
    }
  };
  async function execute() {
    if (!confirmVisible || !confirm || blocked) return;
    const action = confirm;
    setConfirm(null);
    const result = await command.run(action);
    if (result !== null && action.kind === 'removePlan')
      router.dismissTo('/(produtor)/planos');
  }
  return (
    <PlanPage>
      {!plan || query.failure ? (
        <ReadProblem query={query} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(basket) => String(basket.id)}
          contentContainerStyle={styles.content}
          refreshing={
            (query.isRefetching || baskets.isRefetching) &&
            !baskets.isFetchingNextPage
          }
          onRefresh={refresh}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text accessibilityRole="header" style={styles.heading}>
                {plan.nome}
              </Text>
              <View style={styles.card}>
                <Text style={styles.title}>
                  {plan.is_ativo ? 'Publicado' : 'Rascunho'}
                </Text>
                <Text style={styles.text}>
                  {plan.categoria} · Periodicidade semanal:{' '}
                  {plan.periodicidade_semanal}
                </Text>
                <Text style={styles.title}>
                  Valor atual: {offerMoney(plan.valor)}
                </Text>
                <Text style={styles.muted}>
                  Calculado pelo servidor a partir da composição atual.
                  Alterações não mudam valores já contratados.
                </Text>
                <Button
                  compact
                  label="Editar dados do plano"
                  disabled={blocked}
                  onPress={() =>
                    router.push({
                      pathname: '/(produtor)/planos/[id]/editar',
                      params: { id: plan.id },
                    })
                  }
                />
                <Button
                  compact
                  label={plan.is_ativo ? 'Desativar oferta' : 'Publicar plano'}
                  disabled={blocked}
                  onPress={() =>
                    setConfirm({
                      kind: 'publishPlan',
                      id: plan.id,
                      active: !plan.is_ativo,
                    })
                  }
                />
                <Button
                  compact
                  label="Excluir plano"
                  disabled={blocked}
                  onPress={() =>
                    setConfirm({ kind: 'removePlan', id: plan.id })
                  }
                />
              </View>
              <CommandFeedback
                failure={command.failure}
                fallback="/(produtor)/planos"
              />
              <Text style={styles.muted}>
                {plan.is_ativo
                  ? 'Alterações que invalidem a oferta serão recusadas. Desative antes de reorganizar sua composição.'
                  : 'Publique quando houver de 1 a 7 cestas e valor total positivo.'}
              </Text>
              <View style={styles.row}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Cestas
                  {baskets.data ? ` (${baskets.data.pages[0].count})` : ''}
                </Text>
                <Button
                  compact
                  label="Nova Cesta"
                  disabled={blocked}
                  onPress={() =>
                    router.push({
                      pathname: '/(produtor)/planos/[id]/cestas/nova',
                      params: { id: plan.id },
                    })
                  }
                />
              </View>
              {baskets.failure &&
                rows.length > 0 &&
                !baskets.isFetchNextPageError && (
                  <CatalogState
                    message={`A composição pode estar desatualizada. ${baskets.failure.message}`}
                    action={{ label: 'Atualizar', run: refresh }}
                  />
                )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.nome}</Text>
              <Text style={styles.text}>
                {item.itens.length}{' '}
                {item.itens.length === 1 ? 'produto' : 'produtos'} na composição
              </Text>
              <Button
                compact
                label={`Gerenciar cesta ${item.nome}`}
                disabled={blocked}
                onPress={() =>
                  router.push({
                    pathname: '/(produtor)/planos/[id]/cestas/[cestaId]',
                    params: { id: plan.id, cestaId: item.id },
                  })
                }
              />
            </View>
          )}
          ListEmptyComponent={
            baskets.failure || baskets.isPending ? (
              <ReadProblem query={baskets} />
            ) : (
              <CatalogState message="Este plano ainda não possui cestas." />
            )
          }
          ListFooterComponent={
            baskets.isFetchNextPageError && baskets.failure ? (
              <CatalogState
                message={baskets.failure.message}
                action={
                  baskets.failure.canRetry
                    ? {
                        label: 'Tentar novamente',
                        run: () => void baskets.loadMore(),
                      }
                    : undefined
                }
              />
            ) : baskets.hasNextPage ? (
              <Button
                compact
                label="Carregar mais cestas"
                loading={baskets.isFetchingNextPage}
                onPress={() => void baskets.loadMore()}
              />
            ) : undefined
          }
        />
      )}
      <NoticeDialog
        visible={confirmVisible}
        title={
          confirm?.kind === 'removePlan'
            ? 'Excluir plano?'
            : confirm?.kind === 'publishPlan' && confirm.active
              ? 'Publicar plano?'
              : 'Desativar oferta?'
        }
        message={
          confirm?.kind === 'removePlan'
            ? 'O plano e sua composição serão excluídos se não houver histórico protegido. Planos com assinaturas devem ser desativados.'
            : confirm?.kind === 'publishPlan' && confirm.active
              ? 'O servidor verificará se há de 1 a 7 cestas e valor total positivo antes de disponibilizar a oferta.'
              : 'A oferta deixará de aparecer no catálogo. O histórico de assinaturas será preservado.'
        }
        closeLabel="Cancelar"
        onClose={() => setConfirm(null)}
        action={{ label: 'Confirmar', onPress: () => void execute() }}
      />
    </PlanPage>
  );
}
