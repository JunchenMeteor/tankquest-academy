export interface PublishedAssetRecord {
  assetId: string;
  type: string;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  tags: string[];
  preview: string | null;
  dependencies: string[];
}

export interface PublishedLevelAssetSnapshot {
  levelId: string;
  levelVersion: number;
  rootAssetIds: string[];
  publishedAssets: PublishedAssetRecord[];
}
