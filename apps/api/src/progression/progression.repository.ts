import type { OwnedTankDto } from '@tankquest/shared';

import type {
  UpgradeMaterial,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';

export abstract class ProgressionRepository {
  abstract listOwnedTanks(childId: string): Promise<OwnedTankDto[]>;

  abstract upgradeTank(
    childId: string,
    tankId: string,
    stat: UpgradeStat,
    material: UpgradeMaterial
  ): Promise<UpgradeResult>;
}
