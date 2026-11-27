import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';

export function CatalogState({
  message,
  loading = false,
  action,
}: {
  message: string;
  loading?: boolean;
  action?: { label: string; run: () => void };
}) {
  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator color={theme.colors.primary} />}
      <Text
        style={styles.message}
        accessibilityRole={loading ? undefined : 'alert'}
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>
      {action && <Button label={action.label} onPress={action.run} />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, alignItems: 'center' },
  message: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.heading,
    textAlign: 'center',
  },
});
