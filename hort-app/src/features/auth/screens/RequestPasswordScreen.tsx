import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { passwordRecovery } from '../api';
import {
  RecoveryLayout,
  recoveryStyles as styles,
} from '../components/RecoveryLayout';
import { recoveryEmailSchema, recoveryFailure } from '../passwordRecovery';

export default function RequestPasswordScreen() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const flight = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      flight.current?.abort();
    },
    [],
  );
  async function submit() {
    if (flight.current) return;
    const result = recoveryEmailSchema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setFieldError('');
    setFeedback('');
    Keyboard.dismiss();
    try {
      await passwordRecovery.request(result.data.email, controller.signal);
      if (!controller.signal.aborted) {
        setEmail('');
        setSent(true);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = recoveryFailure(error, 'request');
        setFieldError(failure.fields.email ?? '');
        setFeedback(failure.message);
      }
    } finally {
      if (flight.current === controller) flight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <RecoveryLayout
      title={sent ? 'Confira seu e-mail.' : 'Esqueceu sua senha?'}
      subtitle={
        sent
          ? 'Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.'
          : 'Informe o e-mail da sua conta para receber o link de recuperação.'
      }
      busy={busy}
    >
      {sent ? (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            Confira também o spam. Se a mensagem não chegar, aguarde alguns
            minutos antes de solicitar novamente.
          </Text>
          <Button
            label="Voltar ao login"
            onPress={() => router.replace('/(public)/login')}
            style={styles.button}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setSent(false)}
            style={styles.link}
          >
            <Text style={styles.linkText}>Tentar com outro e-mail</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Input
            label="E-mail"
            appearance="outlined"
            labelGap={8}
            placeholder="seu@email.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldError('');
              setFeedback('');
            }}
            error={fieldError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
            editable={!busy}
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
          {!!feedback && (
            <View style={styles.feedback}>
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.error}
              >
                {feedback}
              </Text>
            </View>
          )}
          <Button
            label={busy ? 'Solicitando…' : 'Enviar link de recuperação'}
            loading={busy}
            onPress={() => void submit()}
            style={styles.button}
          />
          <Pressable
            accessibilityRole="link"
            disabled={busy}
            onPress={() => router.replace('/(public)/login')}
            style={styles.link}
          >
            <Text style={styles.linkText}>Lembrei minha senha</Text>
          </Pressable>
        </>
      )}
    </RecoveryLayout>
  );
}
