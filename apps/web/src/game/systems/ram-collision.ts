export interface RamBodyState {
  armorReduction: number;
  mass: number;
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
}

export interface RamDamage {
  damageToFirst: number;
  damageToSecond: number;
  relativeSpeed: number;
}

const minimumImpactSpeed = 40;
const maximumRamDamage = 45;
export const ramDamageCooldownMs = 650;

export function calculateRamDamage(
  first: RamBodyState,
  second: RamBodyState
): RamDamage {
  const offsetX = second.x - first.x;
  const offsetY = second.y - first.y;
  const distance = Math.hypot(offsetX, offsetY) || 1;
  const normalX = offsetX / distance;
  const normalY = offsetY / distance;
  const relativeSpeed = Math.max(
    0,
    (first.velocityX - second.velocityX) * normalX +
      (first.velocityY - second.velocityY) * normalY
  );

  if (relativeSpeed < minimumImpactSpeed) {
    return { damageToFirst: 0, damageToSecond: 0, relativeSpeed };
  }

  const firstMass = Math.max(1, first.mass);
  const secondMass = Math.max(1, second.mass);
  const reducedMass = (firstMass * secondMass) / (firstMass + secondMass);
  const impact = ((relativeSpeed - minimumImpactSpeed) * reducedMass) / 220;

  return {
    damageToFirst: boundedDamage(
      impact * Math.sqrt(secondMass / firstMass),
      first.armorReduction
    ),
    damageToSecond: boundedDamage(
      impact * Math.sqrt(firstMass / secondMass),
      second.armorReduction
    ),
    relativeSpeed,
  };
}

export function isRamDamageReady(
  lastImpactAt: number | undefined,
  now: number
) {
  return (
    lastImpactAt === undefined || now - lastImpactAt >= ramDamageCooldownMs
  );
}

function boundedDamage(rawDamage: number, armorReduction: number) {
  const mitigation = Math.min(0.75, Math.max(0, armorReduction));
  return Math.round(
    Math.min(maximumRamDamage, Math.max(0, rawDamage * (1 - mitigation)))
  );
}
