import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFCF8' },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: { fontSize: 30, fontWeight: '700', color: '#214B2A' },
  text: { fontSize: 16, lineHeight: 24, color: '#344638' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#66796B',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#18271C',
    backgroundColor: '#FFFFFF',
  },
  feedback: { fontSize: 16, lineHeight: 24, color: '#344638' },
});
