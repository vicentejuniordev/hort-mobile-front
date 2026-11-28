import type { Subscription } from './model';

export const weekdays = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export function weekday(day: number) {
  return weekdays[day - 1] ?? 'Dia não informado';
}

// Dates from the API are calendar dates, independent of the device timezone.
export function subscriptionDate(value: string | null) {
  if (!value) return 'Não informada';
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Não informada';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return 'Não informada';
  return date.split('-').reverse().join('/');
}

export function subscriptionDays(subscription: Subscription) {
  const days = [
    ...new Set(subscription.programacoes.map((item) => item.dia_semana)),
  ];
  return days.length
    ? days
        .sort((a, b) => a - b)
        .map(weekday)
        .join(' · ')
    : 'Sem programação semanal';
}

export function scheduledBasket(subscription: Subscription, basketId: number) {
  return (
    subscription.plano_atual.cestas.find((basket) => basket.id === basketId)
      ?.nome ?? `Cesta #${basketId}`
  );
}

export function orderedSchedules(subscription: Subscription) {
  return [...subscription.programacoes].sort(
    (a, b) => a.dia_semana - b.dia_semana || a.ordem - b.ordem || a.id - b.id,
  );
}
