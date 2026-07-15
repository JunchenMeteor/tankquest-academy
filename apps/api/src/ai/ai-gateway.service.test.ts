import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiGatewayClient } from './ai-gateway.client.js';
import { AiGatewayService } from './ai-gateway.service.js';

describe('AiGatewayService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('degrades without surfacing client errors and rate-limits warnings', async () => {
    const client = {
      getHealth: vi.fn().mockRejectedValue(new Error('raw provider failure')),
    } as unknown as AiGatewayClient;
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const service = new AiGatewayService(client);

    await expect(service.getDependencyStatus()).resolves.toBe('degraded');
    await expect(service.getDependencyStatus()).resolves.toBe('degraded');
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalledWith(
      expect.stringContaining('raw provider failure')
    );
  });

  it('returns null when draft generation is unavailable', async () => {
    const client = {
      createQuestionDraft: vi.fn().mockRejectedValue(new Error('unavailable')),
    } as unknown as AiGatewayClient;
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      new AiGatewayService(client).createQuestionDraft({
        ageGroup: '9-12',
        locale: 'zh-CN',
        subject: 'direction',
        skillKey: 'cardinal-directions',
        difficulty: 2,
      })
    ).resolves.toBeNull();
  });
});
