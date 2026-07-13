import type {
  UpgradeMaterial,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';

export abstract class ProgressionRepository {
  abstract upgradeTank(
    childId: string,
    tankId: string,
    stat: UpgradeStat,
    material: UpgradeMaterial
  ): Promise<UpgradeResult>;
}
