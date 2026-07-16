import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AssetController } from './asset.controller.js';
import type { AssetService } from './asset.service.js';

const manifest = {
  levelId: 'level_addition_range',
  levelVersion: 2,
  assets: [],
};

describe('AssetController', () => {
  it('wraps a public manifest in the API response envelope', async () => {
    const service = {
      getManifest: async () => manifest,
    } as unknown as AssetService;
    const controller = new AssetController(service);

    await expect(
      controller.manifest({ levelId: 'level_addition_range' })
    ).resolves.toMatchObject({
      data: manifest,
      error: null,
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it('rejects missing and unexpected query parameters', async () => {
    const service = {
      getManifest: async () => manifest,
    } as unknown as AssetService;
    const controller = new AssetController(service);

    await expect(controller.manifest({})).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      controller.manifest({ levelId: 'level_1', childId: 'child_1' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
