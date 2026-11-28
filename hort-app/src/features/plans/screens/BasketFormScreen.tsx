import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, Text } from 'react-native';
import { catalogId } from '@/features/catalog/presentation';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { ProductInput } from '@/features/products/components/ProductControls';
import { Button } from '@/shared/ui/Button';
import {
  CommandFeedback,
  FormSection,
  PlanFormFrame,
  ReadProblem,
  styles,
} from '../components/PlanUI';
import { useBasket, usePlan, usePlanCommand } from '../hooks';
import { basketBelongsToPlan, basketSchema } from '../model';
export default function BasketFormScreen({ edit = false }: { edit?: boolean }) {
  const params = useLocalSearchParams<{
    id?: string | string[];
    cestaId?: string | string[];
  }>();
  const id = catalogId(params.id);
  const basketId = catalogId(params.cestaId);
  const plan = usePlan(id);
  const query = useBasket(edit ? basketId : null);
  const command = usePlanCommand();
  const fallback = id
    ? { pathname: '/(produtor)/planos/[id]' as const, params: { id } }
    : ('/(produtor)/planos' as const);
  const {
    control,
    reset,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<{ nome: string }>({
    defaultValues: { nome: '' },
    resolver: zodResolver(basketSchema),
  });
  useEffect(() => {
    if (edit && query.data && !isDirty) reset({ nome: query.data.nome });
  }, [edit, query.data, reset, isDirty]);
  const wrongPlan = edit && query.data && !basketBelongsToPlan(query.data, id);
  const blocked =
    command.busy ||
    !!command.failure?.uncertain ||
    !plan.data ||
    !!plan.failure ||
    plan.isFetching ||
    !!wrongPlan ||
    (edit && (query.isFetching || !!query.failure || !query.data));
  async function save(values: { nome: string }) {
    if (blocked || !id) return;
    Keyboard.dismiss();
    const result = await command.run(
      edit && basketId
        ? { kind: 'renameBasket', id: basketId, nome: values.nome }
        : { kind: 'createBasket', planId: id, nome: values.nome },
    );
    if (result)
      router.replace({
        pathname: '/(produtor)/planos/[id]/cestas/[cestaId]',
        params: { id, cestaId: result.id },
      });
  }
  return (
    <PlanFormFrame
      title={edit ? 'Editar Cesta' : 'Nova Cesta'}
      basket
      fallback={fallback}
    >
      {!plan.data || plan.failure ? (
        <ReadProblem query={plan} />
      ) : edit && (!query.data || query.failure) ? (
        <ReadProblem query={query} />
      ) : wrongPlan ? (
        <CatalogState message="Esta cesta não pertence ao plano informado." />
      ) : (
        <>
          <Text style={styles.muted}>
            Plano: {plan.data.nome} ·{' '}
            {plan.data.is_ativo ? 'Publicado' : 'Rascunho'}
          </Text>
          <FormSection title="Identificação">
            <Controller
              control={control}
              name="nome"
              render={({ field }) => (
                <ProductInput
                  largeLabel
                  label="Nome da Cesta"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  editable={!blocked}
                  maxLength={150}
                  error={errors.nome?.message ?? command.failure?.fields.nome}
                />
              )}
            />
          </FormSection>
          {!edit && (
            <Text style={styles.text}>
              Salve a cesta para adicionar produtos e quantidades. Cada
              alteração da composição é gravada separadamente.
            </Text>
          )}
          <CommandFeedback failure={command.failure} fallback={fallback} />
          <Button
            compact
            label={edit ? 'Salvar Nome' : 'Cadastrar Cesta'}
            loading={command.busy}
            disabled={blocked}
            onPress={() => void handleSubmit(save)()}
          />
        </>
      )}
    </PlanFormFrame>
  );
}
