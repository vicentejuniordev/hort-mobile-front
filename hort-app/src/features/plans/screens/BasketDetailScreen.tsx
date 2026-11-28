import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import {
  catalogId,
  itemQuantity,
  offerMoney,
} from '@/features/catalog/presentation';
import { Button } from '@/shared/ui/Button';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import {
  AddItemButton,
  CommandFeedback,
  PlanPage,
  ReadProblem,
  styles,
} from '../components/PlanUI';
import { useBasket, usePlan, usePlanCommand, usePlanProduct } from '../hooks';
import {
  basketBelongsToPlan,
  type BasketItem,
  type PlanCommand,
} from '../model';

function ItemRow({
  item,
  disabled,
  open,
  remove,
}: {
  item: BasketItem;
  disabled: boolean;
  open: () => void;
  remove: () => void;
}) {
  const product = usePlanProduct(item.hortalica);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {product.data && !product.failure
          ? product.data.name
          : `Produto #${item.hortalica}`}
      </Text>
      {product.failure ? (
        <ReadProblem query={product} />
      ) : product.data ? (
        <>
          <Text style={styles.text}>
            {itemQuantity({
              quantidade: item.quantidade,
              hortalica: product.data,
            })}{' '}
            · Preço unitário atual: {offerMoney(product.data.price)}
          </Text>
          {product.data.is_active === false && (
            <Text style={styles.muted}>
              Produto inativo. O vínculo com a cesta continua cadastrado.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.muted}>Consultando produto…</Text>
      )}
      <View style={styles.row}>
        <Button
          compact
          label="Editar quantidade"
          disabled={disabled}
          onPress={open}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remover produto #${item.hortalica} da cesta`}
          disabled={disabled}
          accessibilityState={{ disabled }}
          onPress={remove}
          style={{
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('../../../../assets/plans/remove.svg')}
            style={{ width: 17, height: 17 }}
            accessible={false}
          />
        </Pressable>
      </View>
    </View>
  );
}
export default function BasketDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    cestaId?: string | string[];
  }>();
  const id = catalogId(params.id);
  const basketId = catalogId(params.cestaId);
  const plan = usePlan(id);
  const query = useBasket(basketId);
  const command = usePlanCommand();
  const [confirm, retainConfirmation] = useState<PlanCommand | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  function setConfirm(action: PlanCommand | null) {
    if (action) retainConfirmation(action);
    setConfirmVisible(!!action);
  }
  const basket = query.data;
  const blocked =
    command.busy ||
    !!command.failure?.uncertain ||
    plan.isFetching ||
    query.isFetching ||
    !!query.failure ||
    !!plan.failure;
  const fallback = id
    ? { pathname: '/(produtor)/planos/[id]' as const, params: { id } }
    : ('/(produtor)/planos' as const);
  async function execute() {
    if (!confirmVisible || !confirm || blocked) return;
    const action = confirm;
    setConfirm(null);
    const result = await command.run(action);
    if (result !== null && action.kind === 'removeBasket')
      router.dismissTo(fallback);
  }
  return (
    <PlanPage>
      {!plan.data || plan.failure ? (
        <ReadProblem query={plan} />
      ) : !basket || query.failure ? (
        <ReadProblem query={query} />
      ) : !basketBelongsToPlan(basket, id) ? (
        <CatalogState message="Esta cesta não pertence ao plano informado." />
      ) : (
        <FlatList
          data={basket.itens}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          refreshing={query.isRefetching || plan.isRefetching}
          onRefresh={() => {
            if (!blocked) {
              void query.refetch();
              void plan.refetch();
            }
          }}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text accessibilityRole="header" style={styles.heading}>
                {basket.nome}
              </Text>
              <Text style={styles.muted}>
                Plano: {plan.data.nome} ·{' '}
                {plan.data.is_ativo ? 'Publicado' : 'Rascunho'}
              </Text>
              <Text style={styles.text}>
                Valor atual do plano: {offerMoney(plan.data.valor)}
              </Text>
              <Text style={styles.muted}>
                Os produtos e quantidades abaixo já estão salvos. A
                disponibilidade para publicação pertence ao plano.
              </Text>
              <View style={styles.row}>
                <Button
                  compact
                  label="Editar nome"
                  disabled={blocked}
                  onPress={() =>
                    router.push({
                      pathname:
                        '/(produtor)/planos/[id]/cestas/[cestaId]/editar',
                      params: { id: id!, cestaId: basket.id },
                    })
                  }
                />
                <Button
                  compact
                  label="Excluir cesta"
                  disabled={blocked}
                  onPress={() =>
                    setConfirm({ kind: 'removeBasket', id: basket.id })
                  }
                />
              </View>
              <CommandFeedback failure={command.failure} fallback={fallback} />
              <AddItemButton
                disabled={blocked}
                onPress={() =>
                  router.push({
                    pathname:
                      '/(produtor)/planos/[id]/cestas/[cestaId]/itens/novo',
                    params: { id: id!, cestaId: basket.id },
                  })
                }
              />
              <Text accessibilityRole="header" style={styles.heading}>
                Conteúdo da cesta
              </Text>
            </View>
          }
          ListEmptyComponent={
            <CatalogState message="Esta cesta ainda não possui produtos." />
          }
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              disabled={blocked}
              open={() =>
                router.push({
                  pathname:
                    '/(produtor)/planos/[id]/cestas/[cestaId]/itens/[itemId]',
                  params: { id: id!, cestaId: basket.id, itemId: item.id },
                })
              }
              remove={() => setConfirm({ kind: 'removeItem', id: item.id })}
            />
          )}
        />
      )}
      <NoticeDialog
        visible={confirmVisible}
        title={
          confirm?.kind === 'removeBasket'
            ? 'Excluir cesta?'
            : 'Remover produto?'
        }
        message={
          confirm?.kind === 'removeBasket'
            ? 'A cesta e seus itens serão excluídos se não houver programação protegida. Alterações que invalidem um plano publicado serão recusadas.'
            : 'Este item será removido da composição. O cadastro do produto será preservado.'
        }
        closeLabel="Cancelar"
        onClose={() => setConfirm(null)}
        action={{ label: 'Confirmar', onPress: () => void execute() }}
      />
    </PlanPage>
  );
}
