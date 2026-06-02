export const MONEY_HIDDEN = '****';

export function maskMoney(value: string | number, hidden: boolean) {
  if (!hidden) {
    return typeof value === 'number' ? `$${value.toLocaleString()}` : value;
  }

  return MONEY_HIDDEN;
}

export function maskMoneyInText(text: string, hidden: boolean) {
  if (!hidden) {
    return text;
  }

  return text.replace(/\$[\d,]+(?:\.\d+)?/g, MONEY_HIDDEN);
}
