import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { useFocusedResource } from '@/shared/lib/useFocusedResource';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import {
  ProductInput,
  ProductSelect,
  productControlStyles,
} from '../components/ProductControls';
import { productApi, useProductWriter } from '../hooks';
import {
  categories,
  emptyProduct,
  productFailure,
  productForm,
  productSchema,
  units,
  type ProductForm,
} from '../model';

export default function ProductFormScreen({ id }: { id?: number | null }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      id ? productApi.get(id, signal) : Promise.resolve(null),
    [id],
  );
  const resource = useFocusedResource(load);
  const writer = useProductWriter();
  const [feedback, setFeedback] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [missing, setMissing] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  const {
    control,
    reset,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProductForm>({
    defaultValues: emptyProduct,
    resolver: zodResolver(productSchema),
  });
  useEffect(() => {
    if (resource.data && !isDirty) reset(productForm(resource.data));
  }, [resource.data, reset, isDirty]);
  const back = () => router.dismissTo('/(produtor)/produtos');
  const unavailable =
    id === null ||
    missing ||
    (resource.error && !productFailure(resource.error).canRetry);
  async function save(values: ProductForm) {
    if (submitting.current || writer.busy || uncertain || unavailable || done)
      return;
    submitting.current = true;
    setFeedback('');
    Keyboard.dismiss();
    try {
      await writer.run(
        id ? { kind: 'update', id, values } : { kind: 'create', values },
      );
      setDone(true);
    } catch (error) {
      if ((error as { code?: string })?.code === 'cancelled') return;
      const failure = productFailure(error, true);
      for (const [name, message] of Object.entries(failure.fields))
        setError(name as keyof ProductForm, { type: 'server', message });
      setUncertain(failure.uncertain);
      setMissing(failure.missing);
      setFeedback(failure.message);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.screen}
    >
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.container}>
            <Pressable
              accessibilityRole="button"
              onPress={back}
              style={styles.back}
            >
              <Text style={styles.backText}>Voltar aos produtos</Text>
            </Pressable>
            <View style={styles.form}>
              <View style={styles.header}>
                <Image
                  source={require('../../../../assets/products/form-leaves.svg')}
                  style={styles.leaves}
                  accessible={false}
                />
                <Text accessibilityRole="header" style={styles.title}>
                  {id ? 'Editar Hortaliça' : 'Nova Hortaliça'}
                </Text>
                <Image
                  source={require('../../../../assets/products/form-leaves.svg')}
                  style={styles.leaves}
                  accessible={false}
                />
              </View>
              {done ? (
                <CatalogState
                  message={id ? 'Produto atualizado.' : 'Produto cadastrado.'}
                  action={{ label: 'Ver meus produtos', run: back }}
                />
              ) : unavailable || uncertain ? (
                <CatalogState
                  message={
                    feedback ||
                    (resource.error
                      ? productFailure(resource.error).message
                      : 'Este produto não está disponível.')
                  }
                  action={{ label: 'Consultar meus produtos', run: back }}
                />
              ) : resource.loading ? (
                <CatalogState loading message="Carregando produto…" />
              ) : resource.error ? (
                <CatalogState
                  message={productFailure(resource.error).message}
                  action={{
                    label: 'Tentar novamente',
                    run: () => void resource.reload(),
                  }}
                />
              ) : (
                <>
                  <View style={styles.section}>
                    <Text
                      accessibilityRole="header"
                      style={styles.sectionTitle}
                    >
                      Identificação
                    </Text>
                    <Controller
                      control={control}
                      name="name"
                      render={({ field }) => (
                        <ProductInput
                          ref={field.ref}
                          label="Nome da Hortaliça"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          editable={!writer.busy}
                          maxLength={120}
                          error={errors.name?.message}
                          autoCapitalize="sentences"
                          returnKeyType="next"
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <ProductSelect
                          label="Categoria"
                          value={field.value}
                          onChange={field.onChange}
                          options={categories}
                          disabled={writer.busy}
                          error={errors.category?.message}
                        />
                      )}
                    />
                  </View>
                  <View style={styles.section}>
                    <Text
                      accessibilityRole="header"
                      style={styles.sectionTitle}
                    >
                      Preço e Inventário
                    </Text>
                    <View style={styles.priceRow}>
                      <View style={styles.half}>
                        <Controller
                          control={control}
                          name="unit"
                          render={({ field }) => (
                            <ProductSelect
                              unit
                              label="Unidade de Venda"
                              value={field.value}
                              onChange={field.onChange}
                              options={units}
                              disabled={writer.busy}
                              error={errors.unit?.message}
                            />
                          )}
                        />
                      </View>
                      <View style={styles.half}>
                        <Controller
                          control={control}
                          name="price"
                          render={({ field }) => (
                            <ProductInput
                              ref={field.ref}
                              label="Preço de Venda (R$)"
                              largeLabel
                              value={field.value}
                              onChangeText={field.onChange}
                              onBlur={field.onBlur}
                              editable={!writer.busy}
                              placeholder="5,00"
                              keyboardType="decimal-pad"
                              maxLength={11}
                              error={errors.price?.message}
                              style={styles.priceInput}
                            />
                          )}
                        />
                      </View>
                    </View>
                    <Controller
                      control={control}
                      name="stock"
                      render={({ field }) => (
                        <ProductInput
                          ref={field.ref}
                          label="Estoque Atual"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          editable={!writer.busy}
                          keyboardType="number-pad"
                          maxLength={16}
                          error={errors.stock?.message}
                        />
                      )}
                    />
                  </View>
                  <View style={[styles.section, styles.available]}>
                    <Text style={styles.availableText}>
                      Disponível para venda
                    </Text>
                    <Controller
                      control={control}
                      name="is_active"
                      render={({ field }) => (
                        <Switch
                          accessibilityLabel="Disponível para venda"
                          disabled={writer.busy}
                          value={field.value}
                          onValueChange={field.onChange}
                          trackColor={{ false: '#B3B3B3', true: '#64A249' }}
                          thumbColor={field.value ? '#2E7D32' : '#F1EEEE'}
                        />
                      )}
                    />
                  </View>
                  {!!errors.is_active?.message && (
                    <Text
                      accessibilityRole="alert"
                      style={[productControlStyles.error, styles.feedback]}
                    >
                      {errors.is_active.message}
                    </Text>
                  )}
                  {!!feedback && (
                    <Text
                      accessibilityRole="alert"
                      style={[productControlStyles.error, styles.feedback]}
                    >
                      {feedback}
                    </Text>
                  )}
                  <View style={styles.submit}>
                    <Button
                      label={id ? 'Salvar alterações' : 'Cadastrar Hortaliça'}
                      onPress={() => void handleSubmit(save)()}
                      loading={writer.busy}
                      style={styles.submitButton}
                      labelStyle={styles.submitLabel}
                    />
                  </View>
                </>
              )}
              <View style={styles.footer}>
                <Image
                  source={require('../../../../assets/products/form-footer.svg')}
                  style={styles.ellipse}
                  accessible={false}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 8 },
  container: { width: '100%', maxWidth: 377, alignSelf: 'center' },
  back: {
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  backText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.colors.primary,
  },
  form: {
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 617,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
  },
  leaves: { width: 59, height: 34, flexShrink: 0 },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.739,
    lineHeight: 27,
    color: '#2D7A33',
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
  section: {
    backgroundColor: '#F1EEEE',
    borderColor: '#AABCA2',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginHorizontal: 21,
    marginBottom: 13,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.739,
    lineHeight: 27,
    color: '#2D7A33',
    includeFontPadding: false,
    marginBottom: 4,
  },
  priceRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  half: { flex: 1, minWidth: 105 },
  priceInput: { minHeight: 36.536 },
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 0,
    minHeight: 48,
    marginTop: 10,
  },
  availableText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14.934,
    lineHeight: 23,
    color: '#2D7A33',
    flexShrink: 1,
  },
  submit: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 9 },
  submitButton: { width: 234, maxWidth: '100%', borderRadius: 6 },
  submitLabel: {
    fontFamily: theme.fonts.footer,
    fontSize: 14.559,
    lineHeight: 22,
  },
  feedback: { marginHorizontal: 22, marginBottom: 12 },
  footer: { height: 27, overflow: 'hidden', marginTop: 'auto' },
  ellipse: {
    position: 'absolute',
    left: '50%',
    marginLeft: -217.5,
    top: 0,
    width: 473,
    height: 48,
  },
});
