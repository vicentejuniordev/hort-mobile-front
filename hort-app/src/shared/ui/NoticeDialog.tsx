import { Modal, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/shared/theme/tokens';
import { Button } from './Button';
type Props = {
  title: string;
  message: string;
  visible: boolean;
  onClose: () => void;
  action?: { label: string; onPress: () => void };
};
export function NoticeDialog({
  title,
  message,
  visible,
  onClose,
  action,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          {action && <Button label={action.label} onPress={action.onPress} />}
          <Button label="Entendi" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.overlay,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    fontSize: 20,
    lineHeight: 30,
    includeFontPadding: false,
  },
  message: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
