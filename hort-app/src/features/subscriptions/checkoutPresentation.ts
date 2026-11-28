import type { Offer } from '../catalog/model';
import type { CheckoutIntent, CheckoutPayload } from './checkout';

export type DaySelection = Record<number, number | undefined>;
export function selectionFrom(intent: CheckoutIntent | null): DaySelection {
  return Object.fromEntries(
    intent?.payload.programacoes.map((entry) => [
      entry.cesta,
      entry.dia_semana,
    ]) ?? [],
  );
}
export function selectCheckoutDays(
  offer: Offer,
  days: DaySelection,
): CheckoutPayload {
  if (!/^\d+\.\d{2}$/.test(offer.valor) || !/[1-9]/.test(offer.valor))
    throw Object.assign(new Error('Oferta sem valor válido.'), {
      code: 'publicacao_valor_invalido',
    });
  const entries = offer.cestas.map((basket) => ({
    cesta: basket.id,
    dia_semana: days[basket.id] as 1 | 2 | 3 | 4 | 5 | 6 | 7,
  }));
  if (
    !entries.length ||
    entries.length > 7 ||
    new Set(entries.map((entry) => entry.dia_semana)).size !== entries.length ||
    entries.some(
      (entry) =>
        !Number.isInteger(entry.dia_semana) ||
        entry.dia_semana < 1 ||
        entry.dia_semana > 7,
    )
  )
    throw Object.assign(new Error('Escolha um dia distinto para cada cesta.'), {
      code: 'invalid_checkout',
    });
  return { plano: offer.id, programacoes: entries };
}
export function matchesCheckoutBaskets(offer: Offer, payload: CheckoutPayload) {
  return (
    offer.id === payload.plano &&
    offer.cestas.length === payload.programacoes.length &&
    payload.programacoes.every((entry) =>
      offer.cestas.some((basket) => basket.id === entry.cesta),
    )
  );
}

export function checkoutFieldMessages(details: unknown) {
  if (!details || typeof details !== 'object') return [];
  const record = details as Record<string, unknown>;
  const messages: string[] = [];
  const append = (value: unknown, label: string) => {
    if (typeof value === 'string') messages.push(`${label}: ${value}`);
    else if (Array.isArray(value))
      for (const message of value)
        if (typeof message === 'string') messages.push(`${label}: ${message}`);
  };
  append(record.plano, 'Plano');
  append(record.non_field_errors, 'Contratação');
  if (Array.isArray(record.programacoes))
    record.programacoes.forEach((entry, index) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const fields = entry as Record<string, unknown>;
        append(fields.cesta, `Cesta ${index + 1}`);
        append(fields.dia_semana, `Dia da cesta ${index + 1}`);
        append(fields.non_field_errors, `Programação ${index + 1}`);
      } else append(entry, 'Programação');
    });
  else append(record.programacoes, 'Programação');
  return messages;
}
