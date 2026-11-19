import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

const root = new URL('../', import.meta.url);
const schemaUrl = new URL('contracts/openapi.json', root);
const metadataUrl = new URL('contracts/source.json', root);
const typesUrl = new URL('src/shared/api/generated/schema.d.ts', root);
const [command, ...args] = process.argv.slice(2);
const checksum = (text) => createHash('sha256').update(text).digest('hex');
function validate(schema) {
  if (
    !schema.openapi?.startsWith('3.') ||
    !schema.paths ||
    !schema.components?.schemas
  )
    throw new Error('Forneça um OpenAPI 3 completo em JSON.');
  for (const path of [
    '/api/v1/health/',
    '/api/v1/auth/login/',
    '/api/v1/auth/me/',
  ]) {
    if (!schema.paths[path])
      throw new Error(`Contrato sem a rota obrigatória ${path}`);
  }
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if ('$ref' in value && !value.$ref.startsWith('#/'))
      throw new Error(
        'O snapshot precisa ser autocontido, com referências locais.',
      );
    Object.values(value).forEach(walk);
  }
  walk(schema);
}
async function generate(schema) {
  validate(schema);
  const directory = await mkdtemp(join(tmpdir(), 'hort-contract-'));
  try {
    const input = join(directory, 'schema.json');
    const output = join(directory, 'schema.d.ts');
    await writeFile(input, JSON.stringify(schema));
    // A ferramenta exige TS 5; o Expo continua usando TS 6 no projeto.
    const result = spawnSync(
      'npm',
      [
        'exec',
        '--yes',
        '--package=openapi-typescript@7.13.0',
        '--package=typescript@5.9.3',
        '--',
        'openapi-typescript',
        input,
        '--output',
        output,
      ],
      { encoding: 'utf8', timeout: 120000 },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `Falha ao gerar tipos: ${result.stderr || result.stdout}`,
      );
    return format(await readFile(output, 'utf8'), {
      ...(await resolveConfig(typesUrl.pathname)),
      parser: 'typescript',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
try {
  if (command === 'update') {
    if (args.length !== 1)
      throw new Error('Uso: npm run contracts:update -- /caminho/openapi.json');
    const schema = JSON.parse(await readFile(resolve(args[0]), 'utf8'));
    const generated = await generate(schema);
    const source = `${JSON.stringify(schema, null, 2)}\n`;
    await writeFile(schemaUrl, source);
    await writeFile(typesUrl, generated);
    await writeFile(
      metadataUrl,
      JSON.stringify(
        {
          capturedOn: new Date().toISOString().slice(0, 10),
          source: 'imported-json',
          backendRevision: null,
          schemaSha256: checksum(source),
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Snapshot e tipos atualizados. Revise o diff e registre a revisão do backend em contracts/source.json.',
    );
  } else if (command === 'generate' || command === 'check') {
    if (args.length) throw new Error('Este comando não recebe argumentos.');
    const source = await readFile(schemaUrl, 'utf8');
    const metadata = JSON.parse(await readFile(metadataUrl, 'utf8'));
    if (metadata.schemaSha256 !== checksum(source))
      throw new Error(
        'Snapshot alterado sem atualizar sua origem. Use contracts:update.',
      );
    const generated = await generate(JSON.parse(source));
    if (command === 'generate') await writeFile(typesUrl, generated);
    else if (generated !== (await readFile(typesUrl, 'utf8')))
      throw new Error(
        'Tipos desatualizados. Execute npm run contracts:generate e revise o diff.',
      );
    console.log(
      command === 'check'
        ? 'Contrato e tipos gerados sincronizados.'
        : 'Tipos gerados a partir do snapshot.',
    );
  } else throw new Error('Comando esperado: generate, check ou update.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha no contrato.');
  process.exitCode = 1;
}
