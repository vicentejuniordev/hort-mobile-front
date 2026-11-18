import { useRef, useState } from 'react';
import { Button, Text, TextInput } from 'react-native';
import { checkHealth } from '../api';
import { useSession } from '@/shared/session/SessionProvider';
import { Screen, styles } from '@/shared/ui/Screen';
export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [feedback, setFeedback] = useState('');
  async function run(login: boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback('');
    try {
      if (login) {
        await signIn(email.trim(), password);
        setPassword('');
      } else {
        await checkHealth();
        setFeedback('API disponível.');
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível concluir.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Text style={styles.title}>Hort</Text>
      <Text style={styles.text}>Acesso técnico · MOB-01</Text>
      <Text style={styles.text}>
        Use sua conta da API para validar a conexão. A sessão desta etapa dura
        até o aplicativo ser reiniciado.
      </Text>
      <Text nativeID="email-label" style={styles.text}>
        E-mail
      </Text>
      <TextInput
        accessibilityLabel="E-mail"
        accessibilityLabelledBy="email-label"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!busy}
      />
      <Text nativeID="password-label" style={styles.text}>
        Senha
      </Text>
      <TextInput
        accessibilityLabel="Senha"
        accessibilityLabelledBy="password-label"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!busy}
        onSubmitEditing={() => {
          if (email.trim() && password) void run(true);
        }}
      />
      <Button
        title={busy ? 'Aguarde…' : 'Entrar'}
        color="#28643A"
        disabled={busy || !email.trim() || !password}
        onPress={() => void run(true)}
      />
      <Button
        title="Verificar conexão com a API"
        color="#28643A"
        disabled={busy}
        onPress={() => void run(false)}
      />
      <Text accessibilityLiveRegion="polite" style={styles.feedback}>
        {feedback}
      </Text>
    </Screen>
  );
}
