import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  emptyTankUpgradeLevels,
  upgradeableStats,
  type OwnedTankDto,
  type TankSkinDto,
} from '@tankquest/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  EquipSkinResult,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';
import { ProgressionRepository } from './progression.repository.js';
import { ProgressionService } from './progression.service.js';

class MemoryProgressionRepository extends ProgressionRepository {
  ownedTanks: OwnedTankDto[] = [];
  result: UpgradeResult = {
    status: 'upgraded',
    upgrade: {
      tankId: 'tank_1',
      stat: 'firepower',
      level: 1,
      effectiveValue: 4,
      remainingParts: 1,
    },
  };
  requestedStat: UpgradeStat | null = null;
  skins: TankSkinDto[] = [];
  equipResult: EquipSkinResult = { status: 'unavailable' };

  async listOwnedTanks(): Promise<OwnedTankDto[]> {
    return this.ownedTanks;
  }

  async listSkins(): Promise<TankSkinDto[]> {
    return this.skins;
  }

  async equipSkin(): Promise<EquipSkinResult> {
    return this.equipResult;
  }

  async upgradeTank(
    _childId: string,
    _tankId: string,
    stat: UpgradeStat
  ): Promise<UpgradeResult> {
    this.requestedStat = stat;
    return this.result;
  }
}

describe('ProgressionService', () => {
  let repository: MemoryProgressionRepository;
  let service: ProgressionService;

  beforeEach(() => {
    repository = new MemoryProgressionRepository();
    service = new ProgressionService(repository);
  });

  it('delegates every upgradeable stat to the authoritative repository', async () => {
    for (const stat of upgradeableStats) {
      await expect(
        service.upgradeTank('child_1', 'tank_1', { stat })
      ).resolves.toMatchObject({ level: 1, remainingParts: 1 });
      expect(repository.requestedStat).toBe(stat);
    }
  });

  it('returns only the authoritative owned tank list', async () => {
    repository.ownedTanks = [
      {
        id: 'tank_1',
        code: 'star-shield',
        nameKey: 'tank.starShield.name',
        role: 'medium',
        level: 2,
        upgradeLevels: {
          ...emptyTankUpgradeLevels(),
          firepower: 1,
        },
        stats: {
          firepower: 4,
          mobility: 3,
          armor: 3,
          stealth: 2,
          vision: 3,
          accuracy: 3,
          turretTraverse: 3,
        },
      },
    ];

    await expect(service.listOwnedTanks('child_1')).resolves.toEqual(
      repository.ownedTanks
    );
  });

  it('returns unlocked skins and equips an available cosmetic skin', async () => {
    const skin: TankSkinDto = {
      id: 'skin_1',
      code: 'academy-blue',
      nameKey: 'skin.academyBlue.name',
      primaryColor: '#426b8a',
      secondaryColor: '#d7edf7',
      unlocked: true,
      equipped: true,
    };
    repository.skins = [skin];
    repository.equipResult = { status: 'equipped', skin };

    await expect(service.listSkins('child_1', 'tank_1')).resolves.toEqual([
      skin,
    ]);
    await expect(
      service.equipSkin('child_1', 'tank_1', 'skin_1')
    ).resolves.toEqual(skin);
  });

  it('does not reveal whether a locked skin exists', async () => {
    await expect(
      service.equipSkin('child_1', 'tank_1', 'skin_locked')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal whether an unowned tank exists', async () => {
    repository.result = { status: 'unavailable' };
    await expect(
      service.upgradeTank('child_1', 'tank_other', { stat: 'armor' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an upgrade when inventory is insufficient', async () => {
    repository.result = { status: 'insufficient_parts' };
    await expect(
      service.upgradeTank('child_1', 'tank_1', { stat: 'firepower' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a capped stat instead of spending more parts', async () => {
    repository.result = { status: 'max_level' };
    await expect(
      service.upgradeTank('child_1', 'tank_1', { stat: 'firepower' })
    ).rejects.toThrow('Firepower is already at maximum level');
  });
});
