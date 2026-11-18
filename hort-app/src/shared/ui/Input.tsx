import { forwardRef, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { theme } from '@/shared/theme/tokens';
type Props = TextInputProps & {
  label: string;
  error?: string;
  labelGap?: number;
};
export type InputRef = ComponentRef<typeof TextInput>;
export const Input = forwardRef<InputRef, Props>(function Input(
  { label, error, labelGap = 20, style, ...props },
  ref,
) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        underlineColorAndroid="transparent"
        {...props}
        style={[
          styles.input,
          { marginTop: labelGap },
          error && styles.invalid,
          style,
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
});
const styles = StyleSheet.create({
  label: {
    marginLeft: 5,
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    color: theme.colors.text,
  },
  input: {
    minHeight: 53,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  invalid: { borderColor: theme.colors.error },
  error: {
    marginTop: 8,
    color: theme.colors.error,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
  },
});
