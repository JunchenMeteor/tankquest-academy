import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { AssetController } from './asset.controller.js';
import { AssetRepository } from './asset.repository.js';
import { AssetService } from './asset.service.js';
import { PrismaAssetRepository } from './prisma-asset.repository.js';

@Module({
  controllers: [AssetController],
  providers: [
    PrismaService,
    AssetService,
    { provide: AssetRepository, useClass: PrismaAssetRepository },
  ],
})
export class AssetModule {}
