import { pathToFileURL } from 'node:url';

export function validateBuildEnvironment(profile, apiUrl) {
  if (profile !== 'preview' && profile !== 'production') return;
  let url;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error(
      'Configure EXPO_PUBLIC_API_URL no ambiente EAS desta build.',
    );
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api/v1/') ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.hostname.endsWith('.invalid')
  ) {
    throw new Error(
      'Preview/produção exigem uma API HTTPS real terminando em /api/v1/.',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    validateBuildEnvironment(
      process.env.EAS_BUILD_PROFILE,
      process.env.EXPO_PUBLIC_API_URL,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
