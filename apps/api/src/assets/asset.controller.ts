import { Controller, Get, Inject, Query } from '@nestjs/common';
import { assetManifestRequestSchema } from '@tankquest/shared';
import { randomUUID } from 'node:crypto';

import { parseRequest } from '../game-sessions/parse-request.js';
import { AssetService } from './asset.service.js';

@Controller('api/assets')
export class AssetController {
  constructor(@Inject(AssetService) private readonly service: AssetService) {}

  @Get('manifest')
  async manifest(@Query() query: unknown) {
    const { levelId } = parseRequest(assetManifestRequestSchema, query);
    const data = await this.service.getManifest(levelId);
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
