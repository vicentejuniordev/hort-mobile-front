import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  orderedSchedules,
  scheduledBasket,
  subscriptionDate,
  subscriptionDays,
  weekday,
} from '../src/features/subscriptions/presentation.ts';
import {
  inactiveSubscriptionRead,
  cancelledSubscriptionRead,
  legacySubscriptionRead,
} from './fixtures/mobile-api.mts';

test('datas de calendário e contratação não mudam de dia pelo fuso do aparelho', () => {
  for (const timezone of [
    'America/Fortaleza',
    'Pacific/Honolulu',
    'Asia/Tokyo',
  ]) {
    const previous = process.env.TZ;
    try {
      process.env.TZ = timezone;
      assert.equal(subscriptionDate('2026-12-19'), '19/12/2026');
      assert.equal(subscriptionDate('2026-11-19T00:30:00Z'), '19/11/2026');
      assert.equal(subscriptionDate('2028-02-29'), '29/02/2028');
      for (const invalid of [null, '', '2026-02-29', '2026-04-31', 'invalid'])
        assert.equal(subscriptionDate(invalid), 'Não informada');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  }
});

test('agenda ordena dias ISO e ordem contratada sem modificar a resposta', () => {
  const base = inactiveSubscriptionRead.programacoes[0];
  const subscription = {
    ...inactiveSubscriptionRead,
    programacoes: [
      { ...base, id: 23, dia_semana: 7 as const, ordem: 3 },
      { ...base, id: 22, dia_semana: 1 as const, ordem: 2 },
      { ...base, id: 21, dia_semana: 1 as const, ordem: 1 },
    ],
  };
  assert.deepEqual(
    orderedSchedules(subscription).map((row) => row.id),
    [21, 22, 23],
  );
  assert.deepEqual(
    subscription.programacoes.map((row) => row.id),
    [23, 22, 21],
  );
  assert.equal(subscriptionDays(subscription), 'Segunda-feira · Domingo');
  assert.equal(weekday(0), 'Dia não informado');
  assert.equal(weekday(8), 'Dia não informado');
});

test('canceladas mantêm recorrência histórica e legadas não ganham programação', () => {
  assert.equal(
    subscriptionDays(cancelledSubscriptionRead),
    subscriptionDays(inactiveSubscriptionRead),
  );
  assert.equal(
    subscriptionDays(legacySubscriptionRead),
    'Sem programação semanal',
  );
  assert.deepEqual(orderedSchedules(legacySubscriptionRead), []);
});

test('cesta usa nome atual por ID e preserva identificação quando ausente do plano atual', () => {
  assert.equal(
    scheduledBasket(inactiveSubscriptionRead, 401),
    'Nome atual da cesta',
  );
  assert.equal(scheduledBasket(inactiveSubscriptionRead, 999), 'Cesta #999');
});
