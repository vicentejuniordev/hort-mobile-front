import { forwardRef, useState, type ReactNode, type ComponentRef } from 'react';
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
  appearance?: 'filled' | 'outlined';
  rightElement?: ReactNode;
};
export type InputRef = ComponentRef<typeof TextInput>;
export const Input = forwardRef<InputRef, Props>(function Input(
  {
    label,
    error,
    labelGap = 20,
    appearance = 'filled',
    rightElement,
    style,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text
        style={[
          styles.label,
          appearance === 'outlined' && styles.outlinedLabel,
        ]}
      >
        {label}
      </Text>
      <View style={{ marginTop: labelGap }}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.muted}
          underlineColorAndroid="transparent"
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            appearance === 'outlined' && styles.outlined,
            focused && appearance === 'outlined' && styles.focused,
            !!rightElement && styles.withAction,
            error && styles.invalid,
            style,
          ]}
        />
        {!!rightElement && <View style={styles.action}>{rightElement}</View>}
      </View>
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
  outlinedLabel: {
    marginLeft: 0,
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.label,
  },
  outlined: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.border,
    minHeight: 56,
    borderRadius: 14,
  },
  focused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.fieldFocus,
  },
  withAction: { paddingRight: 94 },
  action: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
