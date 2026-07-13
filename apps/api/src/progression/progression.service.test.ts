import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  UpgradeMaterial,
  UpgradeResult,
  UpgradeStat,
} from './progression.models.js';
import { ProgressionRepository } from './progression.repository.js';
import { ProgressionService } from './progression.service.js';

class MemoryProgressionRepository extends ProgressionRepository {
  result: UpgradeResult = {
    status: 'upgraded',
    upgrade: {
      tankId: 'tank_1',
      stat: 'firepower',
      level: 1,
      remainingParts: 1,
    },
  };
  material: UpgradeMaterial | null = null;

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
});
