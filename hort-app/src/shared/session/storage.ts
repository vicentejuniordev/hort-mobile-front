import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionStorage } from './manager';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
// No navegador a sessão é apenas em memória; tokens nunca vão para localStorage.
export function createSecureStorage(key: string): SessionStorage {
  let webValue: string | null = null;
  return {
    async read() {
      return Platform.OS === 'web'
        ? webValue
        : SecureStore.getItemAsync(key, options);
    },
    async write(value) {
      if (Platform.OS === 'web') {
        webValue = value;
        return;
      }
      await SecureStore.setItemAsync(key, value, options);
    },
    async clear() {
      if (Platform.OS === 'web') {
        webValue = null;
        return;
      }
      try {
        await SecureStore.deleteItemAsync(key, options);
      } catch {
        // Sobrescrever com tombstone também remove os tokens se a exclusão falhar.
        await SecureStore.setItemAsync(key, 'null', options);
      }
    },
  };
}
export const sessionStorage = createSecureStorage('hort.auth.session.v1');
