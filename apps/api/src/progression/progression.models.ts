import type {
  TankSkinDto,
  UpgradeableStat,
  UpgradeTankResponse,
} from '@tankquest/shared';

export type UpgradeStat = UpgradeableStat;

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
