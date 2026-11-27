import type { Offer } from './model';

// IDs come from routes, never from a basket's position in the response.
export function catalogId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function offerMoney(value: string): string {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) return 'Valor não informado';
  const integer = match[1].replace(/^0+(?=\d)/, '');
  return `R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[2]}`;
}

type Item = Offer['cestas'][number]['itens'][number];
export function itemQuantity(item: Pick<Item, 'quantidade' | 'hortalica'>) {
  const units = { unidade: 'un.', kg: 'kg', g: 'g', l: 'L', maco: 'maços' };
  if (!/^\d+(\.\d+)?$/.test(item.quantidade)) return 'Quantidade não informada';
  const [integer, fraction = ''] = item.quantidade.split('.');
  const decimals = fraction.replace(/0+$/, '');
  const quantity =
    integer.replace(/^0+(?=\d)/, '') + (decimals ? `,${decimals}` : '');
  const unit =
    item.hortalica.unit === 'maco' && quantity === '1'
      ? 'maço'
      : units[item.hortalica.unit];
  return `${quantity} ${unit}`;
}

export function basketCount(offer: Offer) {
  return `${offer.cestas.length} ${offer.cestas.length === 1 ? 'cesta' : 'cestas'}`;
}

export function findBasket(offer: Offer, id: number | null) {
  return offer.cestas.find((basket) => basket.id === id);
}
