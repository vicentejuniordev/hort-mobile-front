import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, Text } from 'react-native';
import { catalogId } from '@/features/catalog/presentation';
import { ProductInput } from '@/features/products/components/ProductControls';
import { Button } from '@/shared/ui/Button';
import {
  CommandFeedback,
  FormSection,
  PlanFormFrame,
  ReadProblem,
  styles,
} from '../components/PlanUI';
import { usePlan, usePlanCommand } from '../hooks';
import { emptyPlan, planSchema, type PlanForm } from '../model';
export default function PlanFormScreen({ edit = false }: { edit?: boolean }) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = catalogId(params.id);
  const query = usePlan(edit ? id : null);
  const command = usePlanCommand();
  const {
    control,
    reset,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<PlanForm>({
    defaultValues: emptyPlan,
    resolver: zodResolver(planSchema),
  });
  useEffect(() => {
    if (edit && query.data && !isDirty)
      reset({
        nome: query.data.nome,
        categoria: query.data.categoria,
        periodicidade_semanal: String(query.data.periodicidade_semanal),
      });
  }, [edit, query.data, reset, isDirty]);
  const blocked =
    command.busy ||
    !!command.failure?.uncertain ||
    (edit && (query.isFetching || !!query.failure || !query.data));
  async function save(values: PlanForm) {
    if (blocked) return;
    Keyboard.dismiss();
    const result = await command.run(
      edit && id
        ? { kind: 'updatePlan', id, values }
        : { kind: 'createPlan', values },
    );
    if (result)
      router.replace({
        pathname: '/(produtor)/planos/[id]',
        params: { id: result.id },
      });
  }
  return (
    <PlanFormFrame
      title={edit ? 'Editar Plano' : 'Novo Plano'}
      fallback="/(produtor)/planos"
    >
      {edit && (!query.data || query.failure) ? (
        <ReadProblem query={query} />
      ) : (
        <>
          <FormSection title="Detalhe do Plano">
            {(['nome', 'categoria'] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <ProductInput
                    largeLabel
                    label={name === 'nome' ? 'Nome do Plano' : 'Categoria'}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    editable={!blocked}
                    maxLength={name === 'nome' ? 150 : 120}
                    error={
                      errors[name]?.message ?? command.failure?.fields[name]
                    }
                  />
                )}
              />
            ))}
          </FormSection>
          <FormSection title="Periodicidade">
            <Controller
              control={control}
              name="periodicidade_semanal"
              render={({ field }) => (
                <ProductInput
                  largeLabel
                  label="Periodicidade semanal"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  keyboardType="number-pad"
                  maxLength={16}
                  editable={!blocked}
                  error={
                    errors.periodicidade_semanal?.message ??
                    command.failure?.fields.periodicidade_semanal
                  }
                />
              )}
            />
            <Text style={styles.muted}>
              O valor será calculado a partir dos produtos e quantidades. A
              periodicidade não multiplica esse valor nem define os dias de cada
              cesta.
            </Text>
          </FormSection>
          {!edit && (
            <Text style={styles.text}>
              O plano será salvo como rascunho. Depois, adicione as cestas e
              seus produtos antes de publicar.
            </Text>
          )}
          <CommandFeedback
            failure={command.failure}
            fallback="/(produtor)/planos"
          />
          <Button
            compact
            label={edit ? 'Salvar Plano' : 'Cadastrar Rascunho'}
            loading={command.busy}
            disabled={blocked}
            onPress={() => void handleSubmit(save)()}
          />
        </>
      )}
    </PlanFormFrame>
  );
}
