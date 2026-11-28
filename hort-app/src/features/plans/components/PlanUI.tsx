import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { CatalogState } from '@/features/catalog/components/CatalogState';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import type { planFailure } from '../model';

export function PlanPage({
  children,
  back = true,
}: PropsWithChildren<{ back?: boolean }>) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.page}>
        <AccountHeader back={back} fallback="/(produtor)/planos" />
        {children}
      </View>
    </SafeAreaView>
  );
}
export function PlanFormFrame({
  title,
  children,
  fallback,
  basket = false,
}: PropsWithChildren<{ title: string; fallback: Href; basket?: boolean }>) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.formScroll}
        >
          <View style={styles.form}>
            <View style={styles.formHeader}>
              <Image
                source={require('../../../../assets/products/form-leaves.svg')}
                style={styles.leaves}
                accessible={false}
              />
              <Text accessibilityRole="header" style={styles.heading}>
                {title}
              </Text>
              <Image
                source={require('../../../../assets/products/form-leaves.svg')}
                style={styles.leaves}
                accessible={false}
              />
            </View>
            <View style={styles.formContent}>
              {children}
              <Button
                compact
                label="Voltar"
                onPress={() => router.dismissTo(fallback)}
              />
            </View>
            <View
              pointerEvents="none"
              accessible={false}
              style={styles.decoration}
            >
              <Image
                source={
                  basket
                    ? require('../../../../assets/products/form-footer.svg')
                    : require('../../../../assets/plans/form-footer.svg')
                }
                style={basket ? styles.basketFooter : styles.planFooter}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function FormSection({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}
export function CommandFeedback({
  failure,
  fallback,
}: {
  failure: ReturnType<typeof planFailure> | null;
  fallback: Href;
}) {
  return failure ? (
    <CatalogState
      message={failure.message}
      action={
        failure.uncertain
          ? {
              label: 'Consultar dados atualizados',
              run: () => router.dismissTo(fallback),
            }
          : undefined
      }
    />
  ) : null;
}
export function ReadProblem({
  query,
}: {
  query: {
    failure: ReturnType<typeof planFailure> | null;
    isPending: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  };
}) {
  return (
    <CatalogState
      loading={!query.failure && query.isPending}
      message={query.failure?.message ?? 'Carregando…'}
      action={
        query.failure?.canRetry && !query.isFetching
          ? {
              label: 'Tentar novamente',
              run: () => {
                void query.refetch();
              },
            }
          : undefined
      }
    />
  );
}
export function AddItemButton({
  disabled,
  onPress,
}: {
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Adicionar produto à cesta"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={[styles.addItem, disabled && { opacity: 0.5 }]}
    >
      <Image
        source={require('../../../../assets/plans/add.svg')}
        style={{ width: 14, height: 14 }}
        accessible={false}
      />
      <Text style={styles.actionText}>Adicionar Produto</Text>
    </Pressable>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  page: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  heading: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    lineHeight: 27,
    color: '#2D7A33',
    flexShrink: 1,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
    flexShrink: 1,
  },
  text: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.label,
  },
  muted: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  error: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.error,
  },
  card: {
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    padding: 18,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  titleRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#AABCA2' },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 5,
    padding: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
  },
  formScroll: { flexGrow: 1, padding: 12, alignItems: 'center' },
  form: {
    width: '100%',
    maxWidth: 377,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#AABCA2',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 618,
    flexGrow: 1,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
  },
  formContent: { paddingHorizontal: 22, gap: 16, paddingBottom: 72 },
  leaves: { width: 59, height: 34 },
  section: {
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 10,
    backgroundColor: '#F1EEEE',
    padding: 20,
    gap: 12,
  },
  decoration: {
    position: 'absolute',
    bottom: 0,
    height: 36,
    width: '100%',
    overflow: 'hidden',
  },
  planFooter: {
    position: 'absolute',
    bottom: -21,
    left: -39,
    width: 482,
    height: 55,
  },
  basketFooter: {
    position: 'absolute',
    bottom: -20,
    left: -30,
    width: 473,
    height: 48,
  },
  addItem: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.primary,
    fontSize: 12,
    flexShrink: 1,
  },
});
