import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export function useFocusedResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const flight = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    flight.current?.abort();
    const controller = new AbortController();
    flight.current = controller;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await load(controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        flight.current?.abort();
      };
    }, [reload]),
  );
  return { data, error, loading, reload };
}
