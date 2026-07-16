import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type {
  PublishedAssetRecord,
  PublishedLevelAssetSnapshot,
} from './asset.models.js';
import { AssetRepository } from './asset.repository.js';
import { AssetService } from './asset.service.js';

const tankVisuals: PublishedAssetRecord = {
  assetId: 'asset_tank_visuals_v1',
  type: 'tank-visuals',
  version: '1.0.0',
  url: '/assets/phase4/v1/tank-visuals.json',
  sha256: 'a'.repeat(64),
  sizeBytes: 1157,
  tags: ['tank', 'visual'],
  preview: null,
  dependencies: [],
};

const trainingGrounds: PublishedAssetRecord = {
  assetId: 'asset_training_grounds_v1',
  type: 'scene-description',
  version: '1.0.0',
  url: '/assets/phase4/v1/training-grounds.json',
  sha256: 'b'.repeat(64),
  sizeBytes: 870,
  tags: ['scene', 'training'],
  preview: null,
  dependencies: ['asset_tank_visuals_v1'],
};

class MemoryAssetRepository extends AssetRepository {
  snapshot: PublishedLevelAssetSnapshot | null = {
    levelId: 'level_addition_range',
    levelVersion: 2,
    rootAssetIds: ['asset_training_grounds_v1'],
    publishedAssets: [
      trainingGrounds,
      tankVisuals,
      { ...tankVisuals, assetId: 'asset_unrelated' },
    ],
  };

  async findPublishedLevelAssets() {
    return this.snapshot;
  }
}

describe('AssetService', () => {
  it('returns a dependency-complete manifest in load order', async () => {
    const service = new AssetService(new MemoryAssetRepository());

    await expect(service.getManifest('level_addition_range')).resolves.toEqual({
      levelId: 'level_addition_range',
      levelVersion: 2,
      assets: [tankVisuals, trainingGrounds],
    });
  });

  it('does not expose unrelated published assets', async () => {
    const service = new AssetService(new MemoryAssetRepository());
    const manifest = await service.getManifest('level_addition_range');

    expect(manifest.assets.map(({ assetId }) => assetId)).not.toContain(
      'asset_unrelated'
    );
  });

  it('fails closed when a root has a missing or unpublished dependency', async () => {
    const repository = new MemoryAssetRepository();
    repository.snapshot = {
      ...repository.snapshot!,
      publishedAssets: [trainingGrounds],
    };
    const service = new AssetService(repository);

    await expect(service.getManifest('level_addition_range')).resolves.toEqual({
      levelId: 'level_addition_range',
      levelVersion: 2,
      assets: [],
    });
  });

  it('filters invalid paths and cyclic dependency roots', async () => {
    const repository = new MemoryAssetRepository();
    repository.snapshot = {
      ...repository.snapshot!,
      rootAssetIds: ['asset_external', 'asset_cycle_a'],
      publishedAssets: [
        {
          ...tankVisuals,
          assetId: 'asset_external',
          url: 'https://cdn.example.invalid/tank.json',
        },
        {
          ...tankVisuals,
          assetId: 'asset_cycle_a',
          dependencies: ['asset_cycle_b'],
        },
        {
          ...tankVisuals,
          assetId: 'asset_cycle_b',
          dependencies: ['asset_cycle_a'],
        },
      ],
    };
    const service = new AssetService(repository);

    await expect(service.getManifest('level_addition_range')).resolves.toEqual({
      levelId: 'level_addition_range',
      levelVersion: 2,
      assets: [],
    });
  });

  it('does not reveal draft or nonexistent levels', async () => {
    const repository = new MemoryAssetRepository();
    repository.snapshot = null;
    const service = new AssetService(repository);

    await expect(service.getManifest('level_draft')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
