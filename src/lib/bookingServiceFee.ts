/** Matches STYLD_PLATFORM_FEE_PERCENT default (1%) in stripe-booking-pay + templatesite/js/booking.js */
export const STYLD_PLATFORM_RATE = 0.01;

export function computeServiceFeeCents(amountCents: number): number {
  if (!amountCents || amountCents <= 0) return 0;
  const chargeAmount = Math.round((amountCents * (1 + STYLD_PLATFORM_RATE) + 30) / (1 - 0.029));
  return chargeAmount - amountCents;
}

export function computeServiceFee(amountDollars: number): number {
  return computeServiceFeeCents(Math.round(amountDollars * 100)) / 100;
}

export function totalChargeWithServiceFee(amountDollars: number): number {
  if (!amountDollars || amountDollars <= 0) return 0;
  return Math.round((amountDollars + computeServiceFee(amountDollars)) * 100) / 100;
}
