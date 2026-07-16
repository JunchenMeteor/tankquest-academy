import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import type { PublishedLevelAssetSnapshot } from './asset.models.js';
import { AssetRepository } from './asset.repository.js';

@Injectable()
export class PrismaAssetRepository extends AssetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findPublishedLevelAssets(
    levelId: string
  ): Promise<PublishedLevelAssetSnapshot | null> {
    const level = await this.prisma.level.findFirst({
      where: { id: levelId, status: 'published' },
      select: {
        id: true,
        version: true,
        assets: {
          orderBy: [{ sortOrder: 'asc' }, { assetId: 'asc' }],
          select: { assetId: true },
        },
      },
    });
    if (!level) return null;

    const publishedAssets = await this.prisma.asset.findMany({
      where: { status: 'published' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        type: true,
        version: true,
        url: true,
        sha256: true,
        sizeBytes: true,
        tags: true,
        previewUrl: true,
        dependencies: true,
      },
    });

    return {
      levelId: level.id,
      levelVersion: level.version,
      rootAssetIds: level.assets.map(({ assetId }) => assetId),
      publishedAssets: publishedAssets.map((asset) => ({
        assetId: asset.id,
        type: asset.type,
        version: asset.version,
        url: asset.url,
        sha256: asset.sha256,
        sizeBytes: asset.sizeBytes,
        tags: asset.tags,
        preview: asset.previewUrl,
        dependencies: asset.dependencies,
      })),
    };
  }
}
