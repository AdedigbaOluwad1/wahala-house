export function rebalance<K extends string>(
  values: Record<K, number>,
  key: NoInfer<K>,
  next: number,
): Record<K, number> {
  const clamped = Math.min(1, Math.max(0, next));
  const others = (Object.keys(values) as K[]).filter((k) => k !== key);
  const otherSum = others.reduce((a, k) => a + values[k], 0);
  const remaining = 1 - clamped;
  const out = { ...values, [key]: clamped } as Record<K, number>;
  for (const k of others)
    out[k] =
      otherSum > 0
        ? (values[k] / otherSum) * remaining
        : remaining / others.length;
  return out;
}
