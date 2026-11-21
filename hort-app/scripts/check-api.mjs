import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

export async function checkApi(
  urlValue,
  { allowHttp = false, transport = fetch } = {},
) {
  const url = new URL(urlValue);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api/v1/')
  )
    throw new Error(
      'Use uma URL pública terminando em /api/v1/, sem credenciais ou query.',
    );
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && allowHttp))
    throw new Error(
      'HTTPS obrigatório. --allow-http serve somente ao desenvolvimento local.',
    );
  async function get(target) {
    const response = await transport(target, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`A API respondeu HTTP ${response.status}.`);
    return response.json();
  }
  const schemaUrl = new URL(url);
  schemaUrl.pathname = url.pathname.replace(/api\/v1\/$/, 'api/schema/');
  const [health, remote] = await Promise.all([
    get(new URL('health/', url)),
    get(schemaUrl),
  ]);
  if (health?.status !== 'ok')
    throw new Error('Health check não confirmou status ok.');
  const snapshot = JSON.parse(
    await readFile(
      new URL('../contracts/openapi.json', import.meta.url),
      'utf8',
    ),
  );
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical(value[key])]),
      );
    return value;
  }
  if (JSON.stringify(canonical(remote)) !== JSON.stringify(canonical(snapshot)))
    throw new Error(
      'O OpenAPI servido difere do snapshot. Exporte-o em JSON, atualize o contrato e revise o diff.',
    );
  return { paths: Object.keys(remote.paths).length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const args = process.argv.slice(2);
    let url;
    let allowHttp = false;
    for (let index = 0; index < args.length; index++) {
      if (
        args[index] === '--url' &&
        !url &&
        args[index + 1] &&
        !args[index + 1].startsWith('--')
      )
        url = args[++index];
      else if (args[index] === '--allow-http' && !allowHttp) allowHttp = true;
      else
        throw new Error(
          'Argumento inválido. Uso: npm run api:check -- --url https://HOST/api/v1/ [--allow-http]',
        );
    }
    if (!url) throw new Error('Informe --url https://HOST/api/v1/.');
    const result = await checkApi(url, { allowHttp });
    console.log(`Health e OpenAPI aprovados (${result.paths} rotas).`);
    console.log(
      'Este check não autentica contas, não consulta o banco nem comprova acesso pelo Android.',
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Não foi possível verificar a API.',
    );
    process.exitCode = 1;
  }
}
