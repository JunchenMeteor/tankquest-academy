import { describe, expect, it } from 'vitest';

import type { AiGatewayService } from './ai/ai-gateway.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('keeps the API operational when AI is degraded', async () => {
    const aiGateway = {
      getDependencyStatus: async () => 'degraded' as const,
    } as AiGatewayService;

    await expect(new HealthController(aiGateway).getHealth()).resolves.toEqual({
      status: 'ok',
      dependencies: { ai: 'degraded' },
    });
  });
});
