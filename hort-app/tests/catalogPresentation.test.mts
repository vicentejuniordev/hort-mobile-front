import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  basketCount,
  catalogId,
  findBasket,
  itemQuantity,
  offerMoney,
} from '../src/features/catalog/presentation.ts';
import { offer } from './fixtures/mobile-api.mts';

test('IDs de links aceitam apenas inteiros positivos seguros, sem posições ou arrays', () => {
  assert.equal(catalogId('301'), 301);
  for (const value of [
    undefined,
    ['301'],
    '0',
    '-1',
    '1.5',
    '1e2',
    '01',
    ' 1',
    '9007199254740992',
    'Infinity',
  ]) {
    assert.equal(catalogId(value), null);
  }
});
test('valor da API é formatado sem multiplicar periodicidade ou perder precisão decimal', () => {
  assert.equal(offerMoney(offer.valor), 'R$ 17,50');
  assert.equal(offerMoney('0.00'), 'R$ 0,00');
  assert.equal(
    offerMoney('12345678901234567890.01'),
    'R$ 12.345.678.901.234.567.890,01',
  );
  assert.equal(offerMoney('0019.90'), 'R$ 19,90');
  for (const value of ['NaN', '', '1.001', '-1.00', '1,00'])
    assert.equal(offerMoney(value), 'Valor não informado');
});
test('composição usa ID real pertencente à oferta, mesmo após reordenação', () => {
  const reordered = { ...offer, cestas: [...offer.cestas].reverse() };
  assert.equal(findBasket(reordered, 401)?.nome, offer.cestas[0].nome);
  assert.equal(findBasket(reordered, 402)?.id, 402);
  assert.equal(findBasket(reordered, 0), undefined);
  assert.equal(findBasket(reordered, 1), undefined);
  assert.equal(findBasket(reordered, 999), undefined);
  assert.equal(findBasket(reordered, null), undefined);
});
test('quantidades fracionárias e unidades do contrato conservam seus valores', () => {
  const item = offer.cestas[0].itens[0];
  for (const [unit, quantity, expected] of [
    ['unidade', '3.000', '3 un.'],
    ['kg', '0.125', '0,125 kg'],
    ['g', '100.500', '100,5 g'],
    ['l', '1.050', '1,05 L'],
    ['maco', '1.000', '1 maço'],
    ['maco', '2.000', '2 maços'],
  ] as const) {
    assert.equal(
      itemQuantity({
        quantidade: quantity,
        hortalica: { ...item.hortalica, unit },
      }),
      expected,
    );
  }
  assert.equal(
    itemQuantity({ ...item, quantidade: 'NaN' }),
    'Quantidade não informada',
  );
});
test('número de cestas vem da composição, independente da periodicidade', () => {
  assert.equal(basketCount({ ...offer, periodicidade_semanal: 7 }), '2 cestas');
  assert.equal(basketCount({ ...offer, cestas: [offer.cestas[0]] }), '1 cesta');
  assert.equal(basketCount({ ...offer, cestas: [] }), '0 cestas');
});
