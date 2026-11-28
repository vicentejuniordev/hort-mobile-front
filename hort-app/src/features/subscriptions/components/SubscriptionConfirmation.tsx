import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/tokens';

export function SubscriptionConfirmation({
  visible,
  title,
  message,
  confirmLabel,
  busy = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.message}>{message}</Text>
            <Button label={confirmLabel} loading={busy} onPress={onConfirm} />
            <Button
              label="Voltar"
              disabled={busy}
              onPress={onClose}
              style={styles.secondary}
              labelStyle={styles.secondaryText}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    padding: 24,
    justifyContent: 'center',
  },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#D2E6D9',
    borderWidth: 2,
    borderColor: '#B8ACAC',
    borderRadius: 19,
    padding: 24,
    gap: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: theme.fonts.semibold,
    color: theme.colors.heading,
    fontSize: 18,
  },
  message: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryText: { color: theme.colors.primary },
});
