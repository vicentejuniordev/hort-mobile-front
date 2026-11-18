import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/shared/api/http';
import { useSession } from '@/shared/session/SessionProvider';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Input, type InputRef } from '@/shared/ui/Input';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { authAssets } from '../components/assets';
import { BackButton } from '../components/BackButton';
import { SocialAccess } from '../components/SocialAccess';
import { checkHealth } from '../api';

type Errors = { email?: string; password?: string };
export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [feedback, setFeedback] = useState('');
  const passwordInput = useRef<InputRef>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(login: boolean) {
    if (locked.current) return;
    if (login) {
      const next: Errors = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        next.email = 'Informe um e-mail válido.';
      if (!password) next.password = 'Informe sua senha.';
      setErrors(next);
      if (Object.keys(next).length) return;
    }
    locked.current = true;
    setBusy(true);
    setFeedback('');
    Keyboard.dismiss();
    try {
      if (login) {
        await signIn(email.trim(), password);
        if (mounted.current) setPassword('');
      } else {
        await checkHealth();
        if (mounted.current) setFeedback('API disponível.');
      }
    } catch (error) {
      if (!mounted.current) return;
      if (
        error instanceof ApiError &&
        error.code === 'validation_error' &&
        error.details &&
        typeof error.details === 'object'
      ) {
        const details = error.details as Record<string, unknown>;
        const fieldError = (value: unknown) =>
          Array.isArray(value)
            ? value.filter((item) => typeof item === 'string').join(' ')
            : typeof value === 'string'
              ? value
              : undefined;
        setErrors({
          email: fieldError(details.email),
          password: fieldError(details.password),
        });
      }
      setFeedback(
        error instanceof Error ? error.message : 'Não foi possível concluir.',
      );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <PublicScreen>
      <View style={styles.header}>
        <BackButton disabled={busy} />
        <Image
          source={authAssets.leaves}
          style={styles.leaves}
          accessible={false}
        />
      </View>
      <Text accessibilityRole="header" style={styles.welcome}>
        SEJA BEM-VINDO!
      </Text>
      <Text style={styles.subtitle}>EXPLORE NOVAS POSSIBILIDADES</Text>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          LOGIN
        </Text>
        <View style={styles.card}>
          <View style={styles.fields}>
            <Input
              label="E-MAIL"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
                setFeedback('');
              }}
              error={errors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
            />
            <View style={styles.passwordField}>
              <Input
                ref={passwordInput}
                label="SENHA"
                labelGap={11}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({ ...current, password: undefined }));
                  setFeedback('');
                }}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => void run(true)}
              />
            </View>
          </View>
          {!!feedback && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.feedback}
            >
              {feedback}
            </Text>
          )}
          <Button
            label={busy ? 'AGUARDE…' : 'ENTRAR'}
            variant="login"
            loading={busy}
            onPress={() => void run(true)}
            style={styles.submit}
          />
          <View style={styles.social}>
            <SocialAccess disabled={busy} />
          </View>
        </View>
        <View style={styles.signup}>
          <Text style={styles.signupText}>Não tem conta ainda?</Text>
          <Pressable
            accessibilityRole="link"
            disabled={busy}
            onPress={() => router.navigate('/(public)/escolher-perfil')}
            style={styles.signupLink}
          >
            <Text style={styles.signupLinkText}>Cadastre-se</Text>
          </Pressable>
        </View>
        {__DEV__ && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void run(false)}
            style={styles.diagnostics}
          >
            <Text style={styles.diagnosticsText}>
              Verificar conexão com a API
            </Text>
          </Pressable>
        )}
      </View>
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    height: 72,
    paddingTop: 10,
    paddingLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  leaves: { width: 93, height: 55, marginRight: -9 },
  welcome: {
    marginTop: 11,
    marginHorizontal: 16,
    fontFamily: theme.fonts.bold,
    fontSize: 23,
    lineHeight: 35,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 13,
    marginHorizontal: 22,
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.text,
    includeFontPadding: false,
  },
  section: {
    flexGrow: 1,
    marginTop: 13,
    marginHorizontal: -14,
    borderTopLeftRadius: theme.radius.section,
    borderTopRightRadius: theme.radius.section,
    paddingTop: 37,
    paddingHorizontal: 30,
    paddingBottom: 26,
    backgroundColor: theme.colors.loginBackground,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 36,
    lineHeight: 54,
    color: theme.colors.surface,
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 35,
  },
  card: {
    borderRadius: theme.radius.card,
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 15,
    backgroundColor: theme.colors.surface,
  },
  fields: { alignSelf: 'center', width: '100%', maxWidth: 280, marginLeft: 8 },
  passwordField: { marginTop: 22 },
  submit: { marginTop: 53, alignSelf: 'center', width: '100%', maxWidth: 250 },
  social: { marginTop: 35 },
  feedback: {
    marginTop: 16,
    fontFamily: theme.fonts.medium,
    color: theme.colors.error,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
  signup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 8,
    marginTop: 15,
  },
  signupText: {
    fontFamily: theme.fonts.footer,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.surface,
    includeFontPadding: false,
  },
  signupLink: { minHeight: 48, justifyContent: 'center' },
  signupLinkText: {
    fontFamily: theme.fonts.footer,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.accent,
    includeFontPadding: false,
  },
  diagnostics: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  diagnosticsText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.text,
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
});
