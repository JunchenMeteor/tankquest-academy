import type { PublishedLevelAssetSnapshot } from './asset.models.js';

export abstract class AssetRepository {
  abstract findPublishedLevelAssets(
    levelId: string
  ): Promise<PublishedLevelAssetSnapshot | null>;
}
