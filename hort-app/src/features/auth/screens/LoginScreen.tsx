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
  const [showPassword, setShowPassword] = useState(false);
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
      <View style={styles.navigation}>
        <BackButton disabled={busy} />
      </View>
      <View style={styles.content}>
        <Image
          source={authAssets.logo}
          contentFit="contain"
          accessibilityLabel="Hort"
          style={styles.logo}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Bem-vindo de volta.
        </Text>
        <Text style={styles.subtitle}>
          Entre na sua conta e fique mais perto de quem produz.
        </Text>
        <View style={styles.form}>
          <Input
            label="E-mail"
            appearance="outlined"
            labelGap={8}
            placeholder="seu@email.com"
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
              label="Senha"
              appearance="outlined"
              labelGap={8}
              placeholder="Digite sua senha"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
                setFeedback('');
              }}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => void run(true)}
              rightElement={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Ocultar senha' : 'Mostrar senha'
                  }
                  disabled={busy}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.visibilityButton}
                >
                  <Text style={styles.visibilityText}>
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </Pressable>
              }
            />
          </View>
          {!!feedback && (
            <View
              style={[
                styles.feedbackBox,
                feedback === 'API disponível.' && styles.successBox,
              ]}
            >
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[
                  styles.feedback,
                  feedback === 'API disponível.' && styles.successText,
                ]}
              >
                {feedback}
              </Text>
            </View>
          )}
          <Button
            label={busy ? 'Entrando…' : 'Entrar'}
            loading={busy}
            onPress={() => void run(true)}
            style={styles.submit}
          />
        </View>
        <View style={styles.signup}>
          <Text style={styles.signupText}>Ainda não tem conta?</Text>
          <Pressable
            accessibilityRole="link"
            disabled={busy}
            onPress={() => router.navigate('/(public)/escolher-perfil')}
            style={styles.signupLink}
          >
            <Text style={styles.signupLinkText}>Cadastre-se</Text>
          </Pressable>
        </View>
        <View style={styles.socialSection}>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>Outras formas de acesso</Text>
            <View style={styles.line} />
          </View>
          <SocialAccess outlined disabled={busy} />
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
  navigation: { paddingTop: 8, paddingLeft: 12, height: 64 },
  content: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 24 },
  logo: { width: 160, height: 68, marginLeft: -12 },
  title: {
    marginTop: 24,
    maxWidth: 280,
    fontFamily: theme.fonts.semibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: theme.colors.heading,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  form: { marginTop: 28 },
  passwordField: { marginTop: 20 },
  submit: { marginTop: 24, minHeight: 56, borderRadius: 14 },
  visibilityButton: {
    minHeight: 48,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  visibilityText: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
  feedbackBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.errorBackground,
  },
  feedback: {
    fontFamily: theme.fonts.medium,
    color: theme.colors.error,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
  },
  successBox: { backgroundColor: theme.colors.successBackground },
  successText: { color: theme.colors.primary },
  signup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 6,
    marginTop: 12,
  },
  signupText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
  signupLink: { minHeight: 48, justifyContent: 'center' },
  signupLinkText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    lineHeight: 22,
    color: theme.colors.primary,
    includeFontPadding: false,
  },
  socialSection: { marginTop: 24, gap: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { height: 1, flex: 1, backgroundColor: theme.colors.divider },
  dividerText: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: 'center',
  },
  diagnostics: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  diagnosticsText: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
  },
});
