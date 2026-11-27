import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { theme } from '@/shared/theme/tokens';
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'login';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};
export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  compact,
  style,
  labelStyle,
}: Props) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        variant === 'login' && styles.login,
        pressed && styles.pressed,
        blocked && styles.disabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={variant === 'login' ? theme.colors.text : theme.colors.surface}
        />
      )}
      <Text
        style={[
          styles.label,
          compact && styles.compactLabel,
          variant === 'login' && styles.loginLabel,
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  compact: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16 },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.surface,
    includeFontPadding: false,
    textAlign: 'center',
    flexShrink: 1,
  },
  compactLabel: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  login: {
    backgroundColor: theme.colors.loginButton,
    minHeight: 50,
    paddingVertical: 10,
  },
  loginLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: 20,
    lineHeight: 30,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
