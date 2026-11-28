import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Always creates a new SQLite database. Never uses the checkout's configured DB.
const backend = process.env.HORT_E2E_BACKEND_DIR;
if (!backend)
  throw new Error(
    'Defina HORT_E2E_BACKEND_DIR com o checkout backend da MOB-23.',
  );
await stat(join(backend, 'manage.py'));
const python = process.env.HORT_E2E_PYTHON ?? 'python3';
const directory = await mkdtemp(join(tmpdir(), 'hort-offer-e2e-'));
const manifest = join(directory, 'manifest.json');
const env = {
  ...process.env,
  PYTHONDONTWRITEBYTECODE: '1',
  DATABASE_ENGINE: 'django.db.backends.sqlite3',
  DATABASE_NAME: join(directory, 'database.sqlite3'),
  SECRET_KEY: randomBytes(40).toString('hex'),
  DEBUG: 'False',
  ALLOWED_HOSTS: '127.0.0.1,localhost',
  HORT_E2E_MANIFEST: manifest,
};
let server;
let browser;
async function run(args) {
  const child = spawn(python, ['manage.py', ...args], {
    cwd: backend,
    env,
    stdio: 'inherit',
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Preparação backend falhou: ${args[0]}`);
}
const stop = () => {
  browser?.kill('SIGTERM');
  server?.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  // Refuse an occupied API port, including an existing development service.
  const { createServer } = await import('node:net');
  const probe = createServer();
  await new Promise((ok, fail) => {
    probe.once('error', fail);
    probe.listen(8214, '127.0.0.1', ok);
  });
  await new Promise((ok) => probe.close(ok));
  await run(['migrate', '--noinput']);
  await run(['seed_mobile_beta', '--manifest', manifest]);
  server = spawn(
    python,
    ['manage.py', 'runserver', '127.0.0.1:8214', '--noreload'],
    { cwd: backend, env, stdio: 'ignore' },
  );
  server.on('error', () => {});
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error('API E2E encerrou antes de iniciar.');
    try {
      await fetch('http://127.0.0.1:8214/api/v1/', {
        signal: AbortSignal.timeout(1000),
      });
      ready = true;
      break;
    } catch {
      /* waiting for loopback */
    }
    await new Promise((ok) => setTimeout(ok, 100));
  }
  if (!ready) throw new Error('API E2E não iniciou.');
  browser = spawn(
    process.execPath,
    [resolve('node_modules/@playwright/test/cli.js'), 'test'],
    { env, stdio: 'inherit' },
  );
  const [code] = await once(browser, 'exit');
  process.exitCode = code ?? 1;
} finally {
  stop();
  if (server && server.exitCode === null) await once(server, 'exit');
  await rm(directory, { recursive: true, force: true });
}
