import { Module } from '@nestjs/common';

import { AiGatewayModule } from './ai/ai-gateway.module.js';
import { AssetModule } from './assets/asset.module.js';
import { GameSessionModule } from './game-sessions/game-session.module.js';
import { HealthController } from './health.controller.js';
import { LearningRecordModule } from './learning-records/learning-record.module.js';
import { ProgressionModule } from './progression/progression.module.js';
import { ReportModule } from './reports/report.module.js';

@Module({
  imports: [
    AiGatewayModule,
    AssetModule,
    GameSessionModule,
    LearningRecordModule,
    ProgressionModule,
    ReportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
