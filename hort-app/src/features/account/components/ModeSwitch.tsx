import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import type { ProfileMode } from '@/shared/session/manager';
import { Text, View } from 'react-native';
import { useSession } from '@/shared/session/SessionProvider';
import { Button } from '@/shared/ui/Button';
import { accountStyles as styles } from './AccountPage';

export function ModeSwitch() {
  const { session, selectMode } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState<ProfileMode | null>(null);
  const flight = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      flight.current?.abort();
    },
    [],
  );
  if (destination)
    return (
      <Redirect
        href={
          destination === 'produtor'
            ? '/(produtor)/resumo'
            : '/(cliente)/catalogo'
        }
      />
    );
  if (
    !session ||
    !session.user.perfis.includes('cliente') ||
    !session.user.perfis.includes('produtor')
  )
    return null;
  const next = session.mode === 'produtor' ? 'cliente' : 'produtor';
  async function change() {
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setError('');
    try {
      await selectMode(next, controller.signal);
      if (!controller.signal.aborted) setDestination(next);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Não foi possível trocar de perfil. Tente novamente.',
        );
    } finally {
      if (flight.current === controller) flight.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.text}>Você está no modo {session.mode}.</Text>
      <Button
        label={busy ? 'Consultando perfis…' : `Usar como ${next}`}
        loading={busy}
        onPress={() => void change()}
      />
      {!!error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
