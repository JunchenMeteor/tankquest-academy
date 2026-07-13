import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
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
    return result.upgrade;
  }
}
