export function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value)
    throw new Error(
      'Configure EXPO_PUBLIC_API_URL no arquivo .env.local e reinicie o Expo.',
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('A URL da API é inválida.');
  }
  if (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:')) {
    throw new Error('A API precisa usar HTTPS fora do desenvolvimento.');
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api/v1/')
  ) {
    throw new Error('Use a URL pública da API terminando em /api/v1/.');
  }
  return url.toString();
}
