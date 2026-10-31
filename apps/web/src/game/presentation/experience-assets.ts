import type { AssetBundle } from '../../client/assets/index.js';
import {
  ambientAudioKey,
  type AmbientAudioTheme,
  combatAudioKey,
  type CombatAudioAsset,
} from '../audio/combat-audio.js';
import { combatFeedbackCues } from './combat-feedback.js';

export const EXPERIENCE_GROUND_TEXTURE = 'experience-ground-texture';

const textureAssetIds: Record<AmbientAudioTheme, string> = {
  'training-base': 'asset_training_base_ground_v2',
  'forest-camp': 'asset_forest_camp_ground_v2',
  'snow-field': 'asset_snow_field_ground_v2',
};

const cueAssetIds = {
  fire: 'asset_cannon_fire_v1',
  'reload-ready': 'asset_reload_ready_v1',
  ricochet: 'asset_ricochet_v1',
  blocked: 'asset_blocked_v1',
  penetrated: 'asset_penetrated_v1',
  'low-health': 'asset_low_health_v1',
  destroyed: 'asset_destroyed_v1',
} as const;

const ambientAssetIds: Record<AmbientAudioTheme, string> = {
  'training-base': 'asset_training_base_ambience_v1',
  'forest-camp': 'asset_forest_camp_ambience_v1',
  'snow-field': 'asset_snow_field_ambience_v1',
};

interface ObjectUrlFactory {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export interface PreparedExperienceAssets {
  audio: CombatAudioAsset[];
  groundTextureUrl?: string;
  release(): void;
}

const browserObjectUrls: ObjectUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

export function prepareExperienceAssets(
  bundle: AssetBundle | undefined,
  theme: AmbientAudioTheme,
  objectUrls: ObjectUrlFactory = browserObjectUrls
): PreparedExperienceAssets {
  const createdUrls: string[] = [];
  let released = false;
  const create = (assetId: string, mimeType: string) => {
    const bytes = bundle?.resources.get(assetId);
    if (!bytes) return undefined;
    try {
      const url = objectUrls.create(
        new Blob([Uint8Array.from(bytes)], { type: mimeType })
      );
      createdUrls.push(url);
      return url;
    } catch {
      return undefined;
    }
  };

  const groundTextureUrl = create(textureAssetIds[theme], 'image/webp');
  const audio = combatFeedbackCues.flatMap((cue) => {
    const url = create(cueAssetIds[cue], 'audio/ogg; codecs=opus');
    return url ? [{ key: combatAudioKey(cue), urls: url }] : [];
  });
  const ambientUrl = create(ambientAssetIds[theme], 'audio/ogg; codecs=opus');
  if (ambientUrl) {
    audio.push({ key: ambientAudioKey(theme), urls: ambientUrl });
  }

  return {
    audio,
    ...(groundTextureUrl ? { groundTextureUrl } : {}),
    release() {
      if (released) return;
      released = true;
      for (const url of createdUrls) {
        try {
          objectUrls.revoke(url);
        } catch {
          // Revocation failure is cleanup-only and must not affect gameplay.
        }
      }
    },
  };
}
