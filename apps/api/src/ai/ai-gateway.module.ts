import { Module } from '@nestjs/common';

import { AiGatewayClient } from './ai-gateway.client.js';
import { readAiGatewayConfig } from './ai-gateway.config.js';
import { AiGatewayService } from './ai-gateway.service.js';

@Module({
  providers: [
    {
      provide: AiGatewayClient,
      useFactory: () => new AiGatewayClient(readAiGatewayConfig()),
    },
    AiGatewayService,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
