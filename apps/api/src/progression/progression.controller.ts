import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { upgradeTankRequestSchema } from '@tankquest/shared';
import { randomUUID } from 'node:crypto';

import { parseRequest } from '../game-sessions/parse-request.js';
import { ProgressionService } from './progression.service.js';

@Controller('api/children/:childId/tanks')
export class ProgressionController {
  constructor(
    @Inject(ProgressionService)
    private readonly service: ProgressionService
  ) {}

  @Get()
  async list(@Param('childId') childId: string) {
    const data = await this.service.listOwnedTanks(childId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }

  @Get(':tankId/skins')
  async listSkins(
    @Param('childId') childId: string,
    @Param('tankId') tankId: string
  ) {
    const data = await this.service.listSkins(childId, tankId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }

  @Post(':tankId/skins/:skinId/equip')
  async equipSkin(
    @Param('childId') childId: string,
    @Param('tankId') tankId: string,
    @Param('skinId') skinId: string
  ) {
    const data = await this.service.equipSkin(childId, tankId, skinId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }

  @Post(':tankId/upgrades')
  async upgrade(
    @Param('childId') childId: string,
    @Param('tankId') tankId: string,
    @Body() body: unknown
  ) {
    const data = await this.service.upgradeTank(
      childId,
      tankId,
      parseRequest(upgradeTankRequestSchema, body)
    );
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
