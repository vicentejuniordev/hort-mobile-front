import assert from 'node:assert/strict';
import { checkApi } from '../scripts/check-api.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  cancelledSubscription,
  catalogPage1,
  catalogPage2,
  customerRegistration,
  emptyCatalog,
  loginResponse,
  offer,
  producerRegistration,
  subscribeInput,
  subscription,
  subscriptionRead,
  inactiveSubscriptionRead,
  cancelledSubscriptionRead,
  legacySubscriptionRead,
  subscriptionsPage,
} from './fixtures/mobile-api.mts';
const schemaText = await readFile(
  new URL('../contracts/openapi.json', import.meta.url),
  'utf8',
);
const schema = JSON.parse(schemaText);

test('snapshot identifica a origem e não muda silenciosamente', async () => {
  const source = JSON.parse(
    await readFile(
      new URL('../contracts/source.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(
    createHash('sha256').update(schemaText).digest('hex'),
    source.schemaSha256,
  );
  assert.match(schema.openapi, /^3\./);
  assert.ok(schema.paths['/api/v1/auth/me/'].get);
  assert.ok(schema.paths['/api/v1/catalogo-planos/'].get);
});
test('cadastros incluem confirmação e endereço, sem presumir tokens no 201', () => {
  for (const input of [customerRegistration, producerRegistration]) {
    assert.equal(input.password_confirm, input.password);
    assert.deepEqual(Object.keys(input.endereco).sort(), [
      'bairro',
      'cidade',
      'estado',
      'rua',
    ]);
    assert.equal(input.endereco.estado.length, 2);
  }
  const response =
    schema.paths['/api/v1/auth/register/cliente/'].post.responses['201']
      .content['application/json'].schema;
  assert.equal(response.$ref, '#/components/schemas/Usuario');
  assert.equal('access' in customerRegistration, false);
  assert.notEqual(loginResponse.access, loginResponse.refresh);
});
test('catálogo e gestão são endpoints diferentes e o catálogo exige autenticação', () => {
  const catalog = schema.paths['/api/v1/catalogo-planos/'].get;
  assert.equal(catalog.operationId, 'catalogo_planos_list');
  assert.ok(catalog.security.some((entry) => 'Bearer' in entry));
  assert.ok(schema.paths['/api/v1/planos/'].post);
  assert.equal(schema.paths['/api/v1/catalogo-planos/'].post, undefined);
});
test('fixtures de paginação têm IDs distintos e estado vazio explícito', () => {
  const ids = [...catalogPage1.results, ...catalogPage2.results].map(
    (item) => item.id,
  );
  assert.equal(new Set(ids).size, catalogPage1.count);
  assert.equal(new URL(catalogPage1.next).searchParams.get('page'), '2');
  assert.equal(catalogPage2.next, null);
  assert.equal(emptyCatalog.count, 0);
  assert.deepEqual(emptyCatalog.results, []);
});
test('oferta de exemplo atende a decisão de 1 a 7 cestas e valor positivo', () => {
  assert.ok(offer.cestas.length >= 1 && offer.cestas.length <= 7);
  const scaled = (value: string, decimals: number) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole + fraction.padEnd(decimals, '0'));
  };
  let subtotal = 0n;
  for (const basket of offer.cestas)
    for (const item of basket.itens) {
      assert.match(item.hortalica.price, /^\d+\.\d{2}$/);
      assert.match(item.quantidade, /^\d+\.\d{3}$/);
      if (item.hortalica.unit === 'unidade')
        assert.ok(item.quantidade.endsWith('.000'));
      subtotal += scaled(item.hortalica.price, 2) * scaled(item.quantidade, 3);
    }
  assert.ok(subtotal > 0n);
  assert.equal((subtotal + 500n) / 1000n, scaled(offer.valor, 2));
});
test('contratação usa todas as cestas uma vez, em dias ISO distintos', () => {
  assert.equal(subscribeInput.plano, offer.id);
  assert.deepEqual(
    subscribeInput.programacoes.map((entry) => entry.cesta).sort(),
    offer.cestas.map((basket) => basket.id).sort(),
  );
  const days = subscribeInput.programacoes.map((entry) => entry.dia_semana);
  assert.equal(new Set(days).size, days.length);
  assert.ok(days.every((day) => day >= 1 && day <= 7));
  const parameters = schema.paths['/api/v1/assinaturas/'].post.parameters;
  assert.ok(
    parameters.some(
      (parameter) =>
        parameter.in === 'header' && parameter.name === 'Idempotency-Key',
    ),
  );
});
test('cancelamento preserva valor e programação, sem supor cobrança executada', () => {
  assert.equal(cancelledSubscription.status, 'cancelada');
  assert.ok(cancelledSubscription.data_cancelamento);
  assert.equal(
    cancelledSubscription.valor_contratado,
    subscription.valor_contratado,
  );
  assert.deepEqual(
    cancelledSubscription.programacoes,
    subscription.programacoes,
  );
  assert.equal('pagamento' in subscription, false);
  assert.equal('endereco' in subscription, false);
});

test('leitura de assinatura tem contrato próprio e plano atual explícito, mesmo desativado', () => {
  const read =
    schema.paths['/api/v1/assinaturas/{id}/'].get.responses['200'].content[
      'application/json'
    ].schema;
  assert.equal(read.$ref, '#/components/schemas/AssinaturaLeitura');
  assert.equal(
    schema.paths['/api/v1/assinaturas/'].get.responses['200'].content[
      'application/json'
    ].schema.$ref,
    '#/components/schemas/PaginatedAssinaturaLeituraList',
  );
  const current =
    schema.components.schemas.AssinaturaLeitura.properties.plano_atual;
  assert.equal(current.readOnly, true);
  assert.match(current.description, /Não são um snapshot/);
  assert.ok(
    schema.components.schemas.PlanoAtualAssinatura.required.includes(
      'is_ativo',
    ),
  );
  assert.equal(subscriptionRead.plano_atual.is_ativo, true);
  assert.equal(inactiveSubscriptionRead.plano_atual.is_ativo, false);
  assert.equal(subscriptionsPage.results[0].id, inactiveSubscriptionRead.id);
});
test('fixtures distinguem composição e valor atuais do histórico contratado', () => {
  const changed = inactiveSubscriptionRead;
  assert.equal(changed.plano, changed.plano_atual.id);
  assert.equal(changed.valor_contratado, subscription.valor_contratado);
  assert.notEqual(changed.plano_atual.valor, changed.valor_contratado);
  assert.notEqual(changed.plano_atual.nome, offer.nome);
  assert.equal(changed.plano_atual.cestas[0].itens[0].hortalica.price, '4.00');
  assert.equal(changed.plano_atual.cestas[0].itens[0].quantidade, '3.000');
  assert.deepEqual(changed.programacoes, subscription.programacoes);
  assert.deepEqual(
    cancelledSubscriptionRead.programacoes,
    changed.programacoes,
  );
  assert.equal(cancelledSubscriptionRead.status, 'cancelada');
  assert.equal(
    cancelledSubscriptionRead.valor_contratado,
    subscription.valor_contratado,
  );
  assert.deepEqual(legacySubscriptionRead.programacoes, []);
});
test('respostas de comando mantêm contrato original para repetição idempotente', () => {
  for (const [path, code] of [
    ['/api/v1/assinaturas/', '201'],
    ['/api/v1/assinaturas/{id}/cancelar/', '200'],
  ]) {
    assert.equal(
      schema.paths[path].post.responses[code].content['application/json'].schema
        .$ref,
      '#/components/schemas/Assinatura',
    );
  }
  assert.equal(
    'plano_atual' in schema.components.schemas.Assinatura.properties,
    false,
  );
  assert.equal('plano_atual' in subscription, false);
});

test('check da API consulta somente health e schema, sem credenciais', async () => {
  const calls: string[] = [];
  const transport: typeof fetch = async (target, options) => {
    const url = new URL(String(target));
    calls.push(url.pathname);
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.body, undefined);
    return new Response(
      JSON.stringify(
        url.pathname.endsWith('health/') ? { status: 'ok' } : schema,
      ),
    );
  };
  assert.deepEqual(
    await checkApi('https://api.example.test/api/v1/', { transport }),
    { paths: 26 },
  );
  assert.deepEqual(calls.sort(), ['/api/schema/', '/api/v1/health/']);
});
test('check recusa HTTP por padrão e URLs com credenciais', async () => {
  await assert.rejects(
    checkApi('http://localhost:8000/api/v1/'),
    /HTTPS obrigatório/,
  );
  await assert.rejects(
    checkApi('https://user:pass@example.test/api/v1/'),
    /sem credenciais/,
  );
});
test('check detecta contrato divergente mesmo com health saudável', async () => {
  const transport: typeof fetch = async (target) =>
    new Response(
      JSON.stringify(
        String(target).endsWith('health/')
          ? { status: 'ok' }
          : { ...schema, paths: {} },
      ),
    );
  await assert.rejects(
    checkApi('https://api.example.test/api/v1/', { transport }),
    /difere do snapshot/,
  );
});
test('check preserva falhas HTTP e resposta não JSON', async () => {
  await assert.rejects(
    checkApi('https://api.example.test/api/v1/', {
      transport: async () => new Response('{}', { status: 503 }),
    }),
    /HTTP 503/,
  );
  await assert.rejects(
    checkApi('https://api.example.test/api/v1/', {
      transport: async () => new Response('<html>proxy</html>'),
    }),
  );
});
