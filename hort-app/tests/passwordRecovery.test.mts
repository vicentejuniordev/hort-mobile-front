import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpClient,
  type RequestOptions,
} from '../src/shared/api/http.ts';
import {
  createPasswordRecovery,
  newPasswordSchema,
  recoveryEmailSchema,
  recoveryFailure,
  resetCredentials,
} from '../src/features/auth/passwordRecovery.ts';

const credentials = { uid: 'MTI', token: 'd2abc0-example-token' };
const password = {
  password: ' Example-8264! ',
  password_confirm: ' Example-8264! ',
};

test('e-mail é validado e normalizado; senha conserva espaços', () => {
  assert.deepEqual(
    recoveryEmailSchema.parse({ email: ' pessoa@example.test ' }),
    { email: 'pessoa@example.test' },
  );
  assert.equal(
    recoveryEmailSchema.safeParse({ email: 'invalido' }).success,
    false,
  );
  assert.deepEqual(newPasswordSchema.parse(password), password);
  assert.equal(
    newPasswordSchema.safeParse({ ...password, password_confirm: 'outra' })
      .success,
    false,
  );
  assert.equal(
    newPasswordSchema.safeParse({ password: '123', password_confirm: '123' })
      .success,
    false,
  );
});
test('links incompletos, repetidos, grandes ou malformados não liberam o formulário', () => {
  assert.deepEqual(resetCredentials(credentials), credentials);
  for (const input of [
    {},
    { uid: 'MTI' },
    { token: credentials.token },
    { ...credentials, uid: ['MTI', 'MQ'] },
    { ...credentials, token: ['primeiro', 'segundo'] },
    { ...credentials, uid: 'x'.repeat(129) },
    { ...credentials, token: 'x'.repeat(257) },
    { ...credentials, token: ' ' },
    { ...credentials, uid: '../12' },
  ])
    assert.equal(resetCredentials(input), null);
});
test('solicitação 202 e confirmação 204 usam contrato público sem Bearer ou refresh', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const transport: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(null, { status: calls.length === 1 ? 202 : 204 });
  };
  const recovery = createPasswordRecovery(
    createHttpClient(() => 'https://api.example.test/api/v1/', transport),
  );
  await recovery.request(' pessoa@example.test ');
  await recovery.confirm(credentials, password);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    'https://api.example.test/api/v1/auth/password-reset/',
  );
  assert.equal(
    calls[1].url,
    'https://api.example.test/api/v1/auth/password-reset/confirm/',
  );
  assert.deepEqual(JSON.parse(calls[0].options!.body as string), {
    email: 'pessoa@example.test',
  });
  assert.deepEqual(JSON.parse(calls[1].options!.body as string), {
    ...credentials,
    ...password,
  });
  for (const call of calls) {
    assert.equal(call.options!.method, 'POST');
    assert.equal(
      new Headers(call.options!.headers).has('Authorization'),
      false,
    );
  }
});
test('dados locais inválidos não enviam pedidos à API', async () => {
  let calls = 0;
  const recovery = createPasswordRecovery(async <T,>() => {
    calls++;
    return undefined as T;
  });
  await assert.rejects(recovery.request('invalido'));
  await assert.rejects(recovery.confirm({ uid: '', token: '' }, password));
  await assert.rejects(
    recovery.confirm(credentials, {
      ...password,
      password_confirm: 'diferente',
    }),
  );
  assert.equal(calls, 0);
});
test('erros de token/uid exigem novo link; senhas fracas permanecem editáveis', () => {
  for (const field of ['uid', 'token']) {
    const failure = recoveryFailure({
      status: 400,
      details: { [field]: ['Link inválido ou expirado.'] },
    });
    assert.equal(failure.invalidLink, true);
    assert.match(failure.message, /Solicite um novo/);
  }
  const failure = recoveryFailure({
    status: 400,
    details: {
      password: ['Senha comum.'],
      password_confirm: 'As senhas não conferem.',
    },
  });
  assert.equal(failure.invalidLink, false);
  assert.deepEqual(failure.fields, {
    password: 'Senha comum.',
    password_confirm: 'As senhas não conferem.',
  });
  assert.equal(
    recoveryFailure({ details: ['Senha parecida com o nome.'] }).message,
    'Senha parecida com o nome.',
  );
  assert.deepEqual(
    recoveryFailure({
      details: { access: 'oculto', unknown: { token: 'oculto' } },
    }).fields,
    {},
  );
});
test('429, indisponibilidade e timeout não repetem a escrita nem renovam sessão', async () => {
  for (const status of [400, 401, 429, 503]) {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return Response.json(
        {
          error: {
            code: 'validation_error',
            message: 'Falha.',
            details: status === 400 ? { token: ['Inválido.'] } : null,
          },
        },
        { status },
      );
    };
    const recovery = createPasswordRecovery(
      createHttpClient(() => 'https://api.example.test/api/v1/', transport),
    );
    await assert.rejects(recovery.confirm(credentials, password), (error) => {
      const failure = recoveryFailure(error);
      if (status === 429) assert.match(failure.message, /Aguarde/);
      assert.equal(failure.invalidLink, status === 400);
      return true;
    });
    assert.equal(calls, 1);
  }
  for (const code of ['network_error', 'timeout']) {
    assert.match(
      recoveryFailure({ code }).message,
      /tente entrar com a nova senha/,
    );
  }
});
test('cancelamento é encaminhado ao cliente HTTP', async () => {
  let signal: AbortSignal | undefined;
  const recovery = createPasswordRecovery(
    async <T,>(_path: string, options?: RequestOptions) => {
      signal = options?.signal;
      return undefined as T;
    },
  );
  const controller = new AbortController();
  await recovery.request('pessoa@example.test', controller.signal);
  assert.equal(signal, controller.signal);
  controller.abort();
  assert.equal(signal?.aborted, true);
});
