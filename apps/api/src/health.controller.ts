import { Controller, Get, Inject } from '@nestjs/common';

import { AiGatewayService } from './ai/ai-gateway.service.js';

@Controller('api/health')
export class HealthController {
  constructor(
    @Inject(AiGatewayService) private readonly aiGateway: AiGatewayService
  ) {}

  @Get()
  async getHealth() {
    return {
      status: 'ok' as const,
      dependencies: { ai: await this.aiGateway.getDependencyStatus() },
    };
  }
}
