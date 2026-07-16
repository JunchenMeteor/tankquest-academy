import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  assetManifestEntrySchema,
  assetManifestSchema,
  type AssetManifestDto,
  type AssetManifestEntryDto,
} from '@tankquest/shared';

import { AssetRepository } from './asset.repository.js';

@Injectable()
export class AssetService {
  constructor(
    @Inject(AssetRepository) private readonly repository: AssetRepository
  ) {}

  async getManifest(levelId: string): Promise<AssetManifestDto> {
    const snapshot = await this.repository.findPublishedLevelAssets(levelId);
    if (!snapshot) throw new NotFoundException('Level was not found');

    const publishedAssets = new Map<string, AssetManifestEntryDto>();
    for (const asset of snapshot.publishedAssets) {
      const result = assetManifestEntrySchema.safeParse(asset);
      if (result.success) publishedAssets.set(asset.assetId, result.data);
    }

    let assets: AssetManifestEntryDto[] = [];
    for (const rootAssetId of snapshot.rootAssetIds) {
      const dependencyClosure = this.resolveDependencies(
        rootAssetId,
        publishedAssets
      );
      if (!dependencyClosure) continue;

      const included = new Set(assets.map(({ assetId }) => assetId));
      const candidate = [
        ...assets,
        ...dependencyClosure.filter(({ assetId }) => !included.has(assetId)),
      ];
      const candidateManifest = assetManifestSchema.safeParse({
        levelId: snapshot.levelId,
        levelVersion: snapshot.levelVersion,
        assets: candidate,
      });
      if (candidateManifest.success) assets = candidateManifest.data.assets;
    }

    return assetManifestSchema.parse({
      levelId: snapshot.levelId,
      levelVersion: snapshot.levelVersion,
      assets,
    });
  }

  private resolveDependencies(
    rootAssetId: string,
    assets: ReadonlyMap<string, AssetManifestEntryDto>
  ): AssetManifestEntryDto[] | null {
    const resolved: AssetManifestEntryDto[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (assetId: string): boolean => {
      if (visited.has(assetId)) return true;
      if (visiting.has(assetId)) return false;
      const asset = assets.get(assetId);
      if (!asset) return false;

      visiting.add(assetId);
      if (!asset.dependencies.every(visit)) return false;
      visiting.delete(assetId);
      visited.add(assetId);
      resolved.push(asset);
      return true;
    };

    return visit(rootAssetId) ? resolved : null;
  }
}
