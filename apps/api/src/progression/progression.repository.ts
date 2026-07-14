import type { OwnedTankDto, TankSkinDto } from '@tankquest/shared';

import type {
  EquipSkinResult,
  UpgradeMaterial,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';

export abstract class ProgressionRepository {
  abstract listOwnedTanks(childId: string): Promise<OwnedTankDto[]>;

  abstract listSkins(childId: string, tankId: string): Promise<TankSkinDto[]>;

  abstract equipSkin(
    childId: string,
    tankId: string,
    skinId: string
  ): Promise<EquipSkinResult>;

  abstract upgradeTank(
    childId: string,
    tankId: string,
    stat: UpgradeStat,
    material: UpgradeMaterial
  ): Promise<UpgradeResult>;
}
