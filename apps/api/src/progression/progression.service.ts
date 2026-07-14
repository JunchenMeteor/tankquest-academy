import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  OwnedTankDto,
  TankSkinDto,
  TankStats,
  UpgradeTankRequest,
  UpgradeTankResponse,
} from '@tankquest/shared';

import { ProgressionRepository } from './progression.repository.js';

const upgradeMaterials: Record<keyof TankStats, string> = {
  firepower: 'cannon',
  mobility: 'track',
  armor: 'armor_plate',
  stealth: 'camouflage',
  vision: 'optics',
};

@Injectable()
export class ProgressionService {
  constructor(
    @Inject(ProgressionRepository)
    private readonly repository: ProgressionRepository
  ) {}

  listOwnedTanks(childId: string): Promise<OwnedTankDto[]> {
    return this.repository.listOwnedTanks(childId);
  }

  listSkins(childId: string, tankId: string): Promise<TankSkinDto[]> {
    return this.repository.listSkins(childId, tankId);
  }

  async equipSkin(
    childId: string,
    tankId: string,
    skinId: string
  ): Promise<TankSkinDto> {
    const result = await this.repository.equipSkin(childId, tankId, skinId);
    if (result.status === 'unavailable') {
      throw new ForbiddenException('Skin is not available for this tank');
    }
    return result.skin;
  }

  async upgradeTank(
    childId: string,
    tankId: string,
    request: UpgradeTankRequest
  ): Promise<UpgradeTankResponse> {
    const result = await this.repository.upgradeTank(
      childId,
      tankId,
      request.stat,
      { itemKey: upgradeMaterials[request.stat], amount: 2 }
    );

    if (result.status === 'unavailable') {
      throw new ForbiddenException('Tank is not available for this child');
    }
    if (result.status === 'insufficient_parts') {
      throw new ConflictException('Not enough parts for this upgrade');
    }
    if (result.status === 'max_level') {
      throw new ConflictException(
        `${request.stat.charAt(0).toUpperCase()}${request.stat.slice(1)} is already at maximum level`
      );
    }
    return result.upgrade;
  }
}
