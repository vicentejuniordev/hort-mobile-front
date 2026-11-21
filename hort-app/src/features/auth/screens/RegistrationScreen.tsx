import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import { ApiError } from '@/shared/api/http';
import { theme } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { PublicScreen } from '@/shared/ui/PublicScreen';
import { registerAccount } from '../api';
import { authAssets } from '../components/assets';
import {
  emptyRegistration,
  registrationFieldErrors,
  registrationSchema,
  registrationSteps,
  type RegistrationField,
  type RegistrationProfile,
  type RegistrationValues,
} from '../registration';

const titles = ['Crie sua conta.', 'Vamos nos conhecer.', 'Onde você está?'];
const subtitles = [
  'Prepare-se para novos sabores. Comece com seu e-mail e uma senha.',
  'Preencha os dados do seu perfil para continuar.',
  'Informe seu endereço para concluir o cadastro.',
];

export default function RegistrationScreen({
  profile,
}: {
  profile: RegistrationProfile;
}) {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const advancing = useRef(false);
  const mounted = useRef(true);
  const {
    control,
    trigger,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema(profile)),
    defaultValues: emptyRegistration,
    shouldFocusError: false,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const back = useCallback(() => {
    if (locked.current || advancing.current) return;
    Keyboard.dismiss();
    if (step > 0 && !created) {
      setFeedback('');
      setStep((value) => value - 1);
    } else if (created) router.replace('/(public)/login');
    else if (router.canGoBack()) router.back();
    else router.replace('/(public)/escolher-perfil');
  }, [step, created]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          back();
          return true;
        },
      );
      return () => subscription.remove();
    }, [back]),
  );

  async function submit(values: RegistrationValues) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback('');
    Keyboard.dismiss();
    try {
      await registerAccount(profile, values);
      if (!mounted.current) return;
      reset(emptyRegistration);
      setShowPassword(false);
      setCreated(true);
    } catch (error) {
      if (!mounted.current) return;
      const fields = registrationFieldErrors(
        error instanceof ApiError ? error.details : null,
      );
      for (const [field, message] of Object.entries(fields)) {
        setError(field as RegistrationField, { type: 'server', message });
      }
      const firstStep = registrationSteps.findIndex((names) =>
        names.some((name) => fields[name]),
      );
      if (firstStep >= 0) setStep(firstStep);
      setFeedback(
        error instanceof ApiError &&
          (error.code === 'timeout' || error.code === 'network_error')
          ? 'Não foi possível confirmar o cadastro. Tente entrar com seu e-mail e senha antes de enviar novamente.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível cadastrar. Tente novamente.',
      );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function next() {
    if (locked.current || advancing.current) return;
    advancing.current = true;
    try {
      setFeedback('');
      const names = [...registrationSteps[step]];
      if (!(await trigger(names, { shouldFocus: true })) || !mounted.current)
        return;
      Keyboard.dismiss();
      if (step < 2) setStep(step + 1);
      else
        await handleSubmit(submit, (invalid) => {
          const firstStep = registrationSteps.findIndex((fields) =>
            fields.some((field) => invalid[field]),
          );
          if (mounted.current && firstStep >= 0) setStep(firstStep);
        })();
    } finally {
      advancing.current = false;
    }
  }
  const fields: Record<
    RegistrationField,
    { label: string; placeholder: string } & TextInputProps
  > = {
    email: {
      label: 'E-mail',
      placeholder: 'seu@email.com',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoComplete: 'email',
      maxLength: 254,
    },
    password: {
      label: 'Senha',
      placeholder: 'Crie uma senha',
      autoComplete: 'new-password',
      autoCapitalize: 'none',
    },
    password_confirm: {
      label: 'Confirmar senha',
      placeholder: 'Repita sua senha',
      autoComplete: 'new-password',
      autoCapitalize: 'none',
    },
    nome: {
      label:
        profile === 'cliente' ? 'Nome completo' : 'Nome da empresa ou horta',
      placeholder:
        profile === 'cliente'
          ? 'Como você se chama?'
          : 'Como sua empresa ou horta se chama?',
      autoCapitalize: 'words',
      maxLength: 150,
    },
    documento: {
      label: profile === 'cliente' ? 'CPF' : 'CNPJ',
      placeholder:
        profile === 'cliente' ? '000.000.000-00' : '00.000.000/0000-00',
      keyboardType: 'number-pad',
      maxLength: profile === 'cliente' ? 14 : 18,
    },
    cidade: {
      label: 'Cidade',
      placeholder: 'Sua cidade',
      maxLength: 120,
      autoCapitalize: 'words',
    },
    estado: {
      label: 'Estado (UF)',
      placeholder: 'Ex.: CE',
      autoCapitalize: 'characters',
      maxLength: 2,
    },
    bairro: {
      label: 'Bairro',
      placeholder: 'Seu bairro',
      maxLength: 120,
      autoCapitalize: 'words',
    },
    rua: {
      label: 'Rua',
      placeholder: 'Nome da rua ou avenida',
      maxLength: 230,
      autoCapitalize: 'words',
    },
    numero: { label: 'Número', placeholder: 'Ex.: 123 ou S/N', maxLength: 20 },
  };
  return (
    <PublicScreen key={created ? 'success' : step}>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          disabled={busy}
          onPress={back}
          style={styles.back}
        >
          <Image
            source={authAssets.back}
            contentFit="contain"
            style={styles.backImage}
            accessible={false}
          />
        </Pressable>
      </View>
      <View style={styles.content}>
        <Image
          source={authAssets.logo}
          contentFit="contain"
          accessibilityLabel="Hort"
          style={styles.logo}
        />
        {created ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              Sua conta está pronta!
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              Cadastro realizado com sucesso. Agora entre com seu e-mail e
              senha.
            </Text>
            <Button
              label="Ir para o login"
              onPress={() => router.replace('/(public)/login')}
              style={styles.submit}
            />
          </>
        ) : (
          <>
            <Text style={styles.progress}>
              Cadastro de {profile} · Etapa {step + 1} de 3
            </Text>
            <View style={styles.track} accessible={false}>
              {registrationSteps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    index <= step && styles.activeSegment,
                  ]}
                />
              ))}
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {titles[step]}
            </Text>
            <Text style={styles.subtitle}>{subtitles[step]}</Text>
            <View style={styles.form}>
              {registrationSteps[step].map((name, index, names) => {
                const password =
                  name === 'password' || name === 'password_confirm';
                return (
                  <Controller
                    key={name}
                    control={control}
                    name={name}
                    render={({ field }) => (
                      <Input
                        {...fields[name]}
                        ref={field.ref}
                        appearance="outlined"
                        labelGap={8}
                        value={field.value}
                        onChangeText={(value) => {
                          field.onChange(value);
                          setFeedback('');
                        }}
                        onBlur={field.onBlur}
                        autoCorrect={false}
                        editable={!busy}
                        error={errors[name]?.message}
                        secureTextEntry={password && !showPassword}
                        returnKeyType={
                          index === names.length - 1
                            ? step === 2
                              ? 'go'
                              : 'done'
                            : 'next'
                        }
                        onSubmitEditing={() =>
                          index < names.length - 1
                            ? setFocus(names[index + 1])
                            : void next()
                        }
                        rightElement={
                          password ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={
                                showPassword
                                  ? 'Ocultar senhas'
                                  : 'Mostrar senhas'
                              }
                              disabled={busy}
                              onPress={() => setShowPassword((value) => !value)}
                              style={styles.visibilityButton}
                            >
                              <Text style={styles.linkText}>
                                {showPassword ? 'Ocultar' : 'Mostrar'}
                              </Text>
                            </Pressable>
                          ) : undefined
                        }
                      />
                    )}
                  />
                );
              })}
            </View>
            {step === 0 && (
              <Text style={styles.hint}>
                Use pelo menos 8 caracteres. Evite senhas comuns ou apenas
                números.
              </Text>
            )}
            {!!feedback && (
              <View style={styles.feedbackBox}>
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.feedback}
                >
                  {feedback}
                </Text>
              </View>
            )}
            <Button
              label={
                busy
                  ? 'Criando conta…'
                  : step === 2
                    ? 'Criar conta'
                    : 'Continuar'
              }
              loading={busy}
              onPress={() => void next()}
              style={styles.submit}
            />
            <View style={styles.login}>
              <Text style={styles.subtitle}>Já tem conta?</Text>
              <Pressable
                accessibilityRole="link"
                disabled={busy}
                onPress={() => router.replace('/(public)/login')}
                style={styles.loginLink}
              >
                <Text style={styles.linkText}>Entrar</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </PublicScreen>
  );
}
const styles = StyleSheet.create({
  navigation: { paddingTop: 8, paddingLeft: 12, height: 64 },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backImage: { width: 41, height: 40 },
  content: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 24 },
  logo: { width: 160, height: 68, marginLeft: -12 },
  progress: {
    marginTop: 24,
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  track: { flexDirection: 'row', gap: 8, marginTop: 10 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.divider,
  },
  activeSegment: { backgroundColor: theme.colors.primary },
  title: {
    marginTop: 24,
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
  form: { marginTop: 28, gap: 20 },
  hint: {
    marginTop: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  submit: { marginTop: 24, minHeight: 56, borderRadius: 14 },
  visibilityButton: {
    minHeight: 48,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  linkText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.primary,
  },
  login: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: 6,
    marginTop: 12,
  },
  loginLink: { minHeight: 48, justifyContent: 'center' },
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
  },
});
