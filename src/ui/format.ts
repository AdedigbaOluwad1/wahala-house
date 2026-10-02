export function formatMoney(billions: number): string {
  const v = Math.round(billions);
  return Math.abs(v) >= 1000 ? `₦${(v / 1000).toFixed(2)}tn` : `₦${v}bn`;
}
