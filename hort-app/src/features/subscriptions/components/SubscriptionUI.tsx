import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountHeader } from '@/features/account/components/AccountHeader';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';
import type { Subscription, subscriptionFailure } from '../model';

export function SubscriptionPage({
  children,
  back = false,
}: PropsWithChildren<{ back?: boolean }>) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.page}>
        <AccountHeader back={back} fallback="/(cliente)/assinaturas" />
        {children}
      </View>
    </SafeAreaView>
  );
}

export function SubscriptionStatus({
  status,
}: {
  status: Subscription['status'];
}) {
  return (
    <Text style={[styles.status, status === 'cancelada' && styles.cancelled]}>
      {status === 'ativa' ? 'Ativa' : 'Cancelada'}
    </Text>
  );
}

export function ReadFeedback({
  message,
  loading = false,
  retry,
}: {
  message: string;
  loading?: boolean;
  retry?: () => void;
}) {
  return (
    <View style={styles.feedback}>
      {loading && <ActivityIndicator color={theme.colors.primary} />}
      <Text
        style={styles.text}
        accessibilityLiveRegion="polite"
        accessibilityRole={loading ? undefined : 'alert'}
      >
        {message}
      </Text>
      {retry && <Button label="Tentar novamente" compact onPress={retry} />}
    </View>
  );
}

export function ReadFooter({
  failure,
  hasData,
  fetching,
  hasNextPage,
  retry,
  loadMore,
}: {
  failure: ReturnType<typeof subscriptionFailure> | null;
  hasData: boolean;
  fetching: boolean;
  hasNextPage: boolean;
  retry: () => void;
  loadMore: () => void;
}) {
  return (
    <View style={styles.footer}>
      {failure && hasData && (
        <ReadFeedback
          message={`Os dados podem estar desatualizados ou incompletos. ${failure.message}`}
          retry={failure.canRetry && !fetching ? retry : undefined}
        />
      )}
      {hasNextPage && !failure && (
        <Button
          compact
          label="Carregar mais"
          loading={fetching}
          onPress={loadMore}
        />
      )}
    </View>
  );
}

export function FilterChips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={styles.filterTarget}
        >
          <View
            style={[styles.chip, value === option.value && styles.selected]}
          >
            <Text
              style={[
                styles.text,
                value === option.value && styles.selectedText,
              ]}
            >
              {option.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  page: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 16, flexGrow: 1 },
  heading: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  title: {
    fontFamily: theme.fonts.semibold,
    fontSize: 19,
    color: '#3F3F3F',
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
    lineHeight: 19,
    color: theme.colors.muted,
  },
  price: {
    fontFamily: theme.fonts.semibold,
    fontSize: 18,
    color: theme.colors.heading,
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#AABCA2',
    backgroundColor: '#F9F9F9',
    boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.15)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32 },
  divider: { height: 1, backgroundColor: '#AABCA2' },
  status: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    color: theme.colors.primaryPressed,
    backgroundColor: theme.colors.successBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cancelled: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorBackground,
  },
  feedback: { gap: 12, paddingVertical: 12, alignItems: 'center' },
  footer: { paddingBottom: 12, gap: 12 },
  filters: { gap: 8 },
  filterTarget: { minHeight: 48, justifyContent: 'center' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectedText: { color: theme.colors.surface },
});
