import { Image } from 'expo-image';
import { forwardRef, useRef, useState, type ComponentRef } from 'react';
import {
  Modal,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { theme } from '@/shared/theme/tokens';

export const productControlStyles = StyleSheet.create({
  largeLabel: { fontSize: 11.038, lineHeight: 17 },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: 9.97,
    lineHeight: 15,
    color: '#2D7A33',
    includeFontPadding: false,
  },
  field: { gap: 2 },
  target: { minHeight: 48, justifyContent: 'center' },
  input: {
    minHeight: 33,
    width: '100%',
    borderWidth: 1,
    borderColor: '#AABCA2',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    fontFamily: theme.fonts.regular,
    fontSize: 11.038,
    lineHeight: 17,
    color: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 7,
    boxShadow: '0px 4px 4px rgba(0,0,0,0.25)',
  },
  error: {
    fontFamily: theme.fonts.medium,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.error,
  },
});
export const ProductInput = forwardRef<
  ComponentRef<typeof TextInput>,
  TextInputProps & { label: string; error?: string; largeLabel?: boolean }
>(function ProductInput(
  { label, error, style, largeLabel, ...props },
  forwarded,
) {
  const ref = useRef<ComponentRef<typeof TextInput> | null>(null);
  return (
    <View style={productControlStyles.field}>
      <Text
        style={[
          productControlStyles.label,
          largeLabel && productControlStyles.largeLabel,
        ]}
      >
        {label}
      </Text>
      <Pressable
        accessible={false}
        disabled={props.editable === false}
        onPress={() => ref.current?.focus()}
        style={productControlStyles.target}
      >
        <TextInput
          {...props}
          accessibilityLabel={label}
          ref={(node) => {
            ref.current = node;
            if (typeof forwarded === 'function') forwarded(node);
            else if (forwarded) forwarded.current = node;
          }}
          underlineColorAndroid="transparent"
          style={[
            productControlStyles.input,
            error && { borderColor: theme.colors.error },
            style,
          ]}
        />
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={productControlStyles.error}>
          {error}
        </Text>
      )}
    </View>
  );
});
export function ProductSelect({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
  unit = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  error?: string;
  disabled: boolean;
  unit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    options.find((item) => item.value === value)?.label ??
    'Selecione a categoria';
  return (
    <View style={productControlStyles.field}>
      <Text
        style={[
          productControlStyles.label,
          unit && productControlStyles.largeLabel,
        ]}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={productControlStyles.target}
      >
        <View
          style={[
            productControlStyles.input,
            styles.select,
            { minHeight: unit ? 36.536 : 28 },
            error && { borderColor: theme.colors.error },
          ]}
        >
          <Text style={[styles.value, unit && productControlStyles.largeLabel]}>
            {selected}
          </Text>
          <Image
            source={
              unit
                ? require('../../../../assets/products/unit-down.svg')
                : require('../../../../assets/products/select-down.svg')
            }
            style={unit ? styles.unitArrow : styles.arrow}
            accessible={false}
          />
        </View>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={productControlStyles.error}>
          {error}
        </Text>
      )}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              {label}
            </Text>
            {options.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === item.value }}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={[styles.option, value === item.value && styles.chosen]}
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={styles.option}
            >
              <Text style={styles.optionText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  select: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontFamily: theme.fonts.regular,
    fontSize: 9.97,
    lineHeight: 15,
    color: '#000000',
    flexShrink: 1,
    includeFontPadding: false,
  },
  arrow: { width: 11, height: 11, flexShrink: 0 },
  unitArrow: { width: 12.1786, height: 12.1786, flexShrink: 0 },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 377,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    gap: 4,
  },
  dialogTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17.739,
    color: '#2D7A33',
    marginBottom: 12,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 5,
  },
  chosen: { backgroundColor: '#EFF5ED' },
  optionText: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.primary,
  },
});
