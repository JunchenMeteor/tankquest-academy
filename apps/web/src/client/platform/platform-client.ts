export type RuntimePlatform = 'web' | 'windows' | 'android' | 'ios';

export interface PlatformClient {
  getPlatform(): RuntimePlatform;
  isTouchDevice(): boolean;
  supportsGamepad(): boolean;
  supportsFileCache(): boolean;
  supportsNativeNotification(): boolean;
  isOnline(): boolean;
  subscribeNetwork(listener: (online: boolean) => void): () => void;
  registerServiceWorker(): Promise<boolean>;
}
