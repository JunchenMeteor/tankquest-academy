export type CombatLogEvent =
  | 'scene_started'
  | 'player_projectile_hit_enemy'
  | 'enemy_projectile_hit_player'
  | 'invalid_projectile_collision'
  | 'ram_impact'
  | 'enemy_destroyed'
  | 'player_destroyed';

export interface CombatLogEntry {
  event: CombatLogEvent;
  occurredAt: string;
  details: Record<string, number | string>;
}

const combatLogLimit = 100;
const combatLogKey = '__TANKQUEST_COMBAT_LOGS__';

export function logCombatEvent(
  event: CombatLogEvent,
  details: Record<string, number | string> = {}
) {
  const entry: CombatLogEntry = {
    event,
    occurredAt: new Date().toISOString(),
    details,
  };
  const target = globalThis as typeof globalThis & {
    [combatLogKey]?: CombatLogEntry[];
  };
  const history = target[combatLogKey] ?? [];
  history.push(entry);
  if (history.length > combatLogLimit) {
    history.splice(0, history.length - combatLogLimit);
  }
  target[combatLogKey] = history;
  console.info(`[TankQuest][combat] ${event}`, details);
  return entry;
}
