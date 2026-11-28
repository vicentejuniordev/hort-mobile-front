import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Text } from 'react-native';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { catalogId, offerMoney } from '@/features/catalog/presentation';
import { ProductInput } from '@/features/products/components/ProductControls';
import { units, type Product } from '@/features/products/model';
import { Button } from '@/shared/ui/Button';
import { basketBelongsToPlan, itemBelongsToBasket } from '../model';
import { ProductPicker } from '../components/ProductPicker';
import {
  CommandFeedback,
  FormSection,
  PlanFormFrame,
  ReadProblem,
  styles,
} from '../components/PlanUI';
import {
  useBasket,
  useBasketItem,
  usePlan,
  usePlanCommand,
  usePlanProduct,
} from '../hooks';
export default function BasketItemFormScreen({
  edit = false,
}: {
  edit?: boolean;
}) {
  const params = useLocalSearchParams<{
    id?: string | string[];
    cestaId?: string | string[];
    itemId?: string | string[];
  }>();
  const id = catalogId(params.id);
  const basketId = catalogId(params.cestaId);
  const itemId = catalogId(params.itemId);
  const plan = usePlan(id);
  const basket = useBasket(basketId);
  const item = useBasketItem(edit ? itemId : null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [picker, setPicker] = useState(false);
  const formKey = `${id}:${basketId}:${itemId}`;
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(
    null,
  );
  const quantity =
    draft?.key === formKey
      ? draft.text
      : edit
        ? (item.data?.quantidade.replace('.', ',') ?? '')
        : '';
  const setQuantity = (text: string) => setDraft({ key: formKey, text });
  const product = usePlanProduct(
    edit ? (item.data?.hortalica ?? null) : (selected?.id ?? null),
  );
  const command = usePlanCommand();
  const fallback =
    id && basketId
      ? {
          pathname: '/(produtor)/planos/[id]/cestas/[cestaId]' as const,
          params: { id, cestaId: basketId },
        }
      : ('/(produtor)/planos' as const);
  const mismatch =
    (basket.data && !basketBelongsToPlan(basket.data, id)) ||
    (edit && item.data && !itemBelongsToBasket(item.data, basketId));
  const duplicate =
    !edit &&
    !!product.data &&
    !!basket.data?.itens.some((row) => row.hortalica === product.data.id);
  const blocked =
    command.busy ||
    !!command.failure?.uncertain ||
    !!mismatch ||
    !!duplicate ||
    !product.data ||
    product.isFetching ||
    !!product.failure ||
    plan.isFetching ||
    basket.isFetching ||
    !!plan.failure ||
    !!basket.failure ||
    (edit && (item.isFetching || !item.data || !!item.failure));
  async function save() {
    if (blocked || !product.data || !basketId) return;
    Keyboard.dismiss();
    const result = await command.run(
      edit && itemId
        ? { kind: 'updateItem', id: itemId, unit: product.data.unit, quantity }
        : { kind: 'createItem', basketId, product: product.data, quantity },
    );
    if (result) router.dismissTo(fallback);
  }
  return (
    <PlanFormFrame
      title={edit ? 'Editar Quantidade' : 'Adicionar Produto'}
      basket
      fallback={fallback}
    >
      {!plan.data || plan.failure ? (
        <ReadProblem query={plan} />
      ) : !basket.data || basket.failure ? (
        <ReadProblem query={basket} />
      ) : edit && (!item.data || item.failure) ? (
        <ReadProblem query={item} />
      ) : mismatch ? (
        <CatalogState message="O item ou a cesta não pertence ao plano informado." />
      ) : (
        <>
          <Text style={styles.muted}>
            {plan.data.nome} · {basket.data.nome}
          </Text>
          <FormSection title="Conteúdo da cesta">
            {!edit && (
              <Button
                compact
                label={
                  selected ? 'Escolher outro produto' : 'Escolha o produto'
                }
                disabled={command.busy || !!command.failure?.uncertain}
                onPress={() => setPicker(true)}
              />
            )}
            {product.data && !product.failure ? (
              <>
                <Text style={styles.title}>{product.data.name}</Text>
                <Text style={styles.muted}>
                  Preço unitário atual: {offerMoney(product.data.price)} ·{' '}
                  {
                    units.find((unit) => unit.value === product.data.unit)
                      ?.label
                  }
                </Text>
              </>
            ) : selected || edit ? (
              <ReadProblem query={product} />
            ) : (
              <Text style={styles.text}>
                Selecione um produto do seu cadastro.
              </Text>
            )}
            <ProductInput
              largeLabel
              label={`Quantidade${product.data ? ` (${units.find((unit) => unit.value === product.data.unit)?.label})` : ''}`}
              value={quantity}
              onChangeText={setQuantity}
              editable={!blocked}
              maxLength={11}
              keyboardType="decimal-pad"
              error={command.failure?.fields.quantidade}
            />
            <Text style={styles.muted}>
              Quantidade maior que zero, com até três casas decimais. Produtos
              por unidade exigem quantidade inteira.
            </Text>
            {duplicate && (
              <Text accessibilityRole="alert" style={styles.error}>
                Este produto já está na cesta. Edite sua quantidade na
                composição.
              </Text>
            )}
          </FormSection>
          <CommandFeedback failure={command.failure} fallback={fallback} />
          <Button
            compact
            label={edit ? 'Salvar Quantidade' : 'Adicionar à Cesta'}
            loading={command.busy}
            disabled={blocked}
            onPress={() => void save()}
          />
        </>
      )}
      {picker && (
        <ProductPicker
          excluded={basket.data?.itens.map((row) => row.hortalica) ?? []}
          onClose={() => setPicker(false)}
          onSelect={(value) => {
            setSelected(value);
            setPicker(false);
          }}
        />
      )}
    </PlanFormFrame>
  );
}
