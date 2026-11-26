import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSession } from '@/shared/session/SessionProvider';
import { Button } from '@/shared/ui/Button';
import { Input, type InputRef } from '@/shared/ui/Input';
import { passwordRecovery } from '../api';
import {
  RecoveryLayout,
  recoveryStyles as styles,
} from '../components/RecoveryLayout';
import {
  newPasswordSchema,
  recoveryFailure,
  resetCredentials,
  type RecoveryErrors,
  type ResetCredentials,
} from '../passwordRecovery';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    uid?: string | string[];
    token?: string | string[];
  }>();
  return (
    <ResetForm
      key={JSON.stringify([params.uid, params.token])}
      credentials={resetCredentials(params)}
    />
  );
}
function ResetForm({ credentials }: { credentials: ResetCredentials | null }) {
  const { passwordResetCompleted } = useSession();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [invalid, setInvalid] = useState(!credentials);
  const [errors, setErrors] = useState<RecoveryErrors>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmationInput = useRef<InputRef>(null);
  const flight = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      flight.current?.abort();
    },
    [],
  );
  async function submit() {
    if (flight.current || !credentials || invalid) return;
    const result = newPasswordSchema.safeParse({
      password,
      password_confirm: confirmation,
    });
    if (!result.success) {
      const fields: RecoveryErrors = {};
      for (const issue of result.error.issues) {
        const name = issue.path[0];
        if (name === 'password' || name === 'password_confirm')
          fields[name] ??= issue.message;
      }
      setErrors(fields);
      return;
    }
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setErrors({});
    setFeedback('');
    Keyboard.dismiss();
    let confirmed = false;
    try {
      await passwordRecovery.confirm(
        credentials,
        result.data,
        controller.signal,
      );
      confirmed = true;
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = recoveryFailure(error);
        setErrors(failure.fields);
        setFeedback(failure.message);
        setInvalid(failure.invalidLink);
        if (failure.invalidLink) {
          setPassword('');
          setConfirmation('');
        }
      }
      return;
    } finally {
      // Manter o botão bloqueado também durante a limpeza segura da sessão.
      if (!confirmed) {
        if (flight.current === controller) flight.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    // O servidor já alterou a senha: limpar a sessão mesmo se a tela saiu de foco.
    try {
      await passwordResetCompleted();
      router.replace('/(public)/login');
    } catch {
      // O estado global de recuperação exige concluir a limpeza segura.
    }
  }
  const reveal = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar senhas' : 'Mostrar senhas'}
      disabled={busy}
      onPress={() => setVisible((value) => !value)}
      style={styles.visibility}
    >
      <Text style={styles.linkText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
    </Pressable>
  );
  return (
    <RecoveryLayout
      title={invalid ? 'Vamos pedir outro link?' : 'Crie uma nova senha.'}
      subtitle={
        invalid
          ? 'Este link é inválido ou expirou. Solicite um novo para recuperar seu acesso.'
          : 'Escolha uma senha diferente. Ao salvar, as sessões da conta serão encerradas em todos os dispositivos.'
      }
      busy={busy}
    >
      {invalid ? (
        <Button
          label="Solicitar novo link"
          onPress={() => router.replace('/recuperar-senha')}
          style={styles.button}
        />
      ) : (
        <>
          <Input
            label="Nova senha"
            appearance="outlined"
            labelGap={8}
            placeholder="Crie uma nova senha"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors({});
              setFeedback('');
            }}
            error={errors.password}
            secureTextEntry={!visible}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="next"
            onSubmitEditing={() => confirmationInput.current?.focus()}
            rightElement={reveal}
          />
          <Input
            ref={confirmationInput}
            label="Confirmar nova senha"
            appearance="outlined"
            labelGap={8}
            placeholder="Repita a nova senha"
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              setErrors({});
              setFeedback('');
            }}
            error={errors.password_confirm}
            secureTextEntry={!visible}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            rightElement={reveal}
          />
          <Text style={styles.text}>
            Use pelo menos 8 caracteres. Evite senhas comuns ou apenas números.
          </Text>
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
            label={busy ? 'Salvando…' : 'Salvar nova senha'}
            loading={busy}
            onPress={() => void submit()}
            style={styles.button}
          />
        </>
      )}
      <Pressable
        accessibilityRole="link"
        disabled={busy}
        onPress={() => router.replace('/(public)/login')}
        style={styles.link}
      >
        <Text style={styles.linkText}>Voltar ao login</Text>
      </Pressable>
    </RecoveryLayout>
  );
}
