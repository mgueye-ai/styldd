import { PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases';

export const STYLD_MONTHLY_PRODUCT_ID = 'styld_monthly';
export const STYLD_YEARLY_PRODUCT_ID = 'styld_yearly';

export const FALLBACK_MONTHLY_PRICE = 49.99;
export const FALLBACK_YEARLY_PRICE = 299.99;

export type Plan = 'monthly' | 'yearly';

export type PlanPricing = {
  monthlyPkg: PurchasesPackage | null;
  yearlyPkg: PurchasesPackage | null;
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  yearlyPerMonthLabel: string;
  savingsPercent: number;
  hasLivePackages: boolean;
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function findPaywallPackage(
  packages: PurchasesPackage[],
  plan: Plan,
): PurchasesPackage | null {
  const productId = plan === 'monthly' ? STYLD_MONTHLY_PRODUCT_ID : STYLD_YEARLY_PRODUCT_ID;
  const loose = plan === 'monthly' ? 'monthly' : 'yearly';
  const annualLoose = plan === 'yearly' ? 'annual' : 'yearly';
  const packageType = plan === 'monthly' ? PACKAGE_TYPE.MONTHLY : PACKAGE_TYPE.ANNUAL;

  return (
    packages.find((pkg) => pkg.product.identifier === productId) ??
    packages.find((pkg) => pkg.identifier.toLowerCase().includes(loose)) ??
    packages.find((pkg) => pkg.identifier.toLowerCase().includes(annualLoose)) ??
    packages.find((pkg) => pkg.product.identifier.toLowerCase().includes(loose)) ??
    packages.find((pkg) => pkg.packageType === packageType) ??
    null
  );
}

export function getPlanPricing(packages: PurchasesPackage[]): PlanPricing {
  const monthlyPkg = findPaywallPackage(packages, 'monthly');
  const yearlyPkg = findPaywallPackage(packages, 'yearly');

  const monthlyAmount = monthlyPkg?.product.price ?? FALLBACK_MONTHLY_PRICE;
  const yearlyAmount = yearlyPkg?.product.price ?? FALLBACK_YEARLY_PRICE;

  const monthlyAnnualized = monthlyAmount * 12;
  const savingsPercent =
    monthlyAnnualized > 0
      ? Math.max(0, Math.round((1 - yearlyAmount / monthlyAnnualized) * 100))
      : 0;

  const yearlyPerMonth = yearlyAmount / 12;
  const yearlyPerMonthFromStore = yearlyPkg?.product.pricePerMonthString;

  return {
    monthlyPkg,
    yearlyPkg,
    monthlyPriceLabel: monthlyPkg?.product.priceString ?? `${formatMoney(monthlyAmount)}/mo`,
    yearlyPriceLabel: yearlyPkg?.product.priceString ?? `${formatMoney(yearlyAmount)}/yr`,
    yearlyPerMonthLabel: yearlyPerMonthFromStore
      ? `(${yearlyPerMonthFromStore}/mo)`
      : `(${formatMoney(yearlyPerMonth)}/mo)`,
    savingsPercent,
    hasLivePackages: Boolean(monthlyPkg && yearlyPkg),
  };
}
