import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyRegistration,
  registrationFieldErrors,
  registrationPayload,
  registrationSchema,
} from '../src/features/auth/registration.ts';

const values = {
  ...emptyRegistration,
  nome: ' Pessoa de exemplo ',
  email: ' pessoa@example.test ',
  password: ' Example!8246 ',
  password_confirm: ' Example!8246 ',
  documento: '529.982.247-25',
  cidade: ' Fortaleza ',
  estado: 'ce',
  bairro: ' Centro ',
  rua: ' Rua de Exemplo ',
  numero: ' S/N ',
};
test('cliente e produtor validam documentos com dígitos verificadores', () => {
  assert.ok(registrationSchema('cliente').safeParse(values).success);
  assert.ok(
    registrationSchema('produtor').safeParse({
      ...values,
      documento: '11.222.333/0001-81',
    }).success,
  );
  for (const documento of [
    '11111111111',
    '52998224724',
    '',
    '11222333000181',
  ]) {
    assert.equal(
      registrationSchema('cliente').safeParse({ ...values, documento }).success,
      false,
    );
  }
  for (const documento of ['11111111111111', '11222333000180', '52998224725']) {
    assert.equal(
      registrationSchema('produtor').safeParse({ ...values, documento })
        .success,
      false,
    );
  }
});
test('confirmação é validada já na primeira etapa, com as outras vazias', () => {
  const result = registrationSchema('cliente').safeParse({
    ...emptyRegistration,
    email: values.email,
    password: values.password,
    password_confirm: 'diferente',
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.ok(
      result.error.issues.some((issue) => issue.path[0] === 'password_confirm'),
    );
});
test('payload preserva senha, normaliza documento/UF e envia número com a rua', () => {
  const input = registrationPayload(values, 'cliente');
  assert.equal(input.password, values.password);
  assert.equal(input.password_confirm, values.password_confirm);
  assert.equal(input.email, 'pessoa@example.test');
  assert.equal(input.cpf, '52998224725');
  assert.deepEqual(input.endereco, {
    rua: 'Rua de Exemplo, S/N',
    bairro: 'Centro',
    cidade: 'Fortaleza',
    estado: 'CE',
  });
  assert.ok(
    !('documento' in input) && !('numero' in input) && !('cnpj' in input),
  );
  const producer = registrationPayload(
    { ...values, documento: '11.222.333/0001-81' },
    'produtor',
  );
  assert.equal(producer.cnpj, '11222333000181');
  assert.ok(!('cpf' in producer));
});
test('erros aninhados retornam aos campos corretos sem exibir estruturas desconhecidas', () => {
  assert.deepEqual(
    registrationFieldErrors({
      email: ['E-mail em uso.'],
      cpf: ['CPF em uso.'],
      password_confirm: 'As senhas não conferem.',
      endereco: { rua: ['Endereço inválido.'], estado: ['UF inválida.'] },
      non_field_errors: ['Falha geral.'],
    }),
    {
      email: 'E-mail em uso.',
      documento: 'CPF em uso.',
      password_confirm: 'As senhas não conferem.',
      rua: 'Endereço inválido.',
      estado: 'UF inválida.',
    },
  );
  assert.deepEqual(registrationFieldErrors(null), {});
});
test('campos obrigatórios e tamanho do endereço cabem no contrato', () => {
  assert.equal(
    registrationSchema('cliente').safeParse(emptyRegistration).success,
    false,
  );
  assert.equal(
    registrationSchema('cliente').safeParse({ ...values, estado: 'Ceará' })
      .success,
    false,
  );
  const largest = { ...values, rua: 'R'.repeat(230), numero: '1'.repeat(20) };
  assert.ok(registrationSchema('cliente').safeParse(largest).success);
  assert.ok(registrationPayload(largest, 'cliente').endereco.rua.length <= 255);
});
