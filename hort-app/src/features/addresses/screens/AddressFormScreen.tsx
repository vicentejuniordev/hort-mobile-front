import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  AccountPage,
  accountStyles as styles,
} from '@/features/account/components/AccountPage';
import { useFocusedResource } from '@/shared/lib/useFocusedResource';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';
import { addressApi } from '../api';
import {
  addressFailure,
  addressSchema,
  emptyAddress,
  type AddressInput,
} from '../model';

export default function AddressFormScreen({ id }: { id?: number | null }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      id ? addressApi.get(id, signal) : Promise.resolve(null),
    [id],
  );
  const { data, error, loading, reload } = useFocusedResource(load);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [done, setDone] = useState('');
  const flight = useRef<AbortController | null>(null);
  const {
    control,
    reset,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<AddressInput>({
    defaultValues: emptyAddress,
    resolver: zodResolver(addressSchema),
  });
  useEffect(() => {
    if (data)
      reset({
        rua: data.rua,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
      });
  }, [data, reset]);
  useEffect(
    () => () => {
      flight.current?.abort();
    },
    [],
  );
  const unavailable =
    id === null || missing || (error && addressFailure(error).missing);
  async function mutate(values?: AddressInput) {
    if (flight.current || unavailable || uncertain || done) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setFeedback('');
    setConfirmDelete(false);
    Keyboard.dismiss();
    try {
      if (values) {
        if (id) await addressApi.update(id, values, controller.signal);
        else await addressApi.create(values, controller.signal);
      } else if (id) await addressApi.remove(id, controller.signal);
      else return;
      if (!controller.signal.aborted) {
        reset(emptyAddress);
        setDone(values ? 'Endereço salvo com sucesso.' : 'Endereço excluído.');
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      const problem = addressFailure(failure, true);
      for (const [name, message] of Object.entries(problem.fields))
        setError(name as keyof AddressInput, { type: 'server', message });
      setUncertain(problem.uncertain);
      setMissing(problem.missing);
      setFeedback(problem.message);
    } finally {
      if (flight.current === controller) flight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const fields = [
    {
      name: 'rua',
      label: 'Rua e número',
      placeholder: 'Ex.: Rua das Flores, 123',
      maxLength: 255,
    },
    {
      name: 'bairro',
      label: 'Bairro',
      placeholder: 'Seu bairro',
      maxLength: 120,
    },
    {
      name: 'cidade',
      label: 'Cidade',
      placeholder: 'Sua cidade',
      maxLength: 120,
    },
    {
      name: 'estado',
      label: 'Estado (UF)',
      placeholder: 'Ex.: CE',
      maxLength: 2,
    },
  ] as const;
  return (
    <AccountPage
      title={done ? 'Tudo certo.' : id ? 'Editar endereço' : 'Novo endereço'}
      subtitle="Os endereços cadastrados ainda não são vinculados às assinaturas ou entregas."
      fallback="/enderecos"
    >
      {done ? (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.heading}>
            {done}
          </Text>
          <Button
            label="Ver meus endereços"
            onPress={() => router.replace('/enderecos')}
          />
        </>
      ) : loading ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando endereço"
        />
      ) : unavailable || uncertain ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>
            {feedback || 'Este endereço não está disponível.'}
          </Text>
          <Button
            label="Consultar meus endereços"
            onPress={() => router.replace('/enderecos')}
          />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>
            {addressFailure(error).message}
          </Text>
          <Button label="Tentar novamente" onPress={() => void reload()} />
        </View>
      ) : (
        <>
          {fields.map((item, index) => (
            <Controller
              key={item.name}
              control={control}
              name={item.name}
              render={({ field }) => (
                <Input
                  ref={field.ref}
                  label={item.label}
                  placeholder={item.placeholder}
                  appearance="outlined"
                  labelGap={8}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errors[item.name]?.message}
                  autoCapitalize={
                    item.name === 'estado' ? 'characters' : 'words'
                  }
                  autoCorrect={false}
                  maxLength={item.maxLength}
                  editable={!busy}
                  returnKeyType={index === fields.length - 1 ? 'go' : 'next'}
                  onSubmitEditing={() =>
                    index < fields.length - 1
                      ? setFocus(fields[index + 1].name)
                      : void handleSubmit(mutate)()
                  }
                />
              )}
            />
          ))}
          {!!feedback && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {feedback}
            </Text>
          )}
          <Button
            label={busy ? 'Aguarde…' : 'Salvar endereço'}
            loading={busy}
            onPress={() => void handleSubmit(mutate)()}
          />
          {!!id && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setConfirmDelete(true)}
              style={styles.link}
            >
              <Text style={styles.error}>Excluir endereço</Text>
            </Pressable>
          )}
        </>
      )}
      <NoticeDialog
        visible={confirmDelete}
        title="Excluir este endereço?"
        message="O endereço será removido da sua conta. Esta ação não altera assinaturas ou programações."
        closeLabel="Cancelar"
        onClose={() => setConfirmDelete(false)}
        action={{ label: 'Excluir endereço', onPress: () => void mutate() }}
      />
    </AccountPage>
  );
}
