import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { OwnedTankDto } from '@tankquest/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  UpgradeMaterial,
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
  material: UpgradeMaterial | null = null;

  async listOwnedTanks(): Promise<OwnedTankDto[]> {
    return this.ownedTanks;
  }

  async upgradeTank(
    _childId: string,
    _tankId: string,
    _stat: UpgradeStat,
    material: UpgradeMaterial
  ): Promise<UpgradeResult> {
    this.material = material;
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

  it('spends the mapped part material for an upgrade', async () => {
    await expect(
      service.upgradeTank('child_1', 'tank_1', { stat: 'firepower' })
    ).resolves.toMatchObject({ level: 1, remainingParts: 1 });
    expect(repository.material).toEqual({ itemKey: 'cannon', amount: 2 });
  });

  it('returns only the authoritative owned tank list', async () => {
    repository.ownedTanks = [
      {
        id: 'tank_1',
        code: 'star-shield',
        nameKey: 'tank.starShield.name',
        role: 'medium',
        level: 2,
        stats: {
          firepower: 4,
          mobility: 3,
          armor: 3,
          stealth: 2,
          vision: 3,
        },
      },
    ];

    await expect(service.listOwnedTanks('child_1')).resolves.toEqual(
      repository.ownedTanks
    );
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
