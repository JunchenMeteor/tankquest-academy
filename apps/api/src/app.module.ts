import { Module } from '@nestjs/common';

import { GameSessionModule } from './game-sessions/game-session.module.js';
import { HealthController } from './health.controller.js';
import { ProgressionModule } from './progression/progression.module.js';
import { LearningRecordModule } from './learning-records/learning-record.module.js';

@Module({
  imports: [GameSessionModule, ProgressionModule, LearningRecordModule],
  controllers: [HealthController],
})
export class AppModule {}
