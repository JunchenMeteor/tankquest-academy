export function calculateArmoredDamage(
  incomingDamage: number,
  armorReduction: number
) {
  const safeDamage = Math.max(0, incomingDamage);
  const mitigation = Math.min(0.75, Math.max(0, armorReduction));
  if (safeDamage === 0) return 0;
  return Math.max(1, Math.round(safeDamage * (1 - mitigation)));
}

export function healthAfterDamage(currentHealth: number, damage: number) {
  return Math.max(0, currentHealth - Math.max(0, damage));
}
