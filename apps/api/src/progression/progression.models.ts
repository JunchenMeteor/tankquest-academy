import type {
  TankSkinDto,
  TankStats,
  UpgradeTankResponse,
} from '@tankquest/shared';

export type UpgradeStat = keyof TankStats;

export interface UpgradeMaterial {
  itemKey: string;
  amount: number;
}

export type UpgradeResult =
  | { status: 'upgraded'; upgrade: UpgradeTankResponse }
  | { status: 'unavailable' }
  | { status: 'insufficient_parts' }
  | { status: 'max_level' };

export type EquipSkinResult =
  { status: 'equipped'; skin: TankSkinDto } | { status: 'unavailable' };
