import { Module } from '@nestjs/common';

import { GameSessionModule } from './game-sessions/game-session.module.js';
import { HealthController } from './health.controller.js';
import { ProgressionModule } from './progression/progression.module.js';

@Module({
  imports: [GameSessionModule, ProgressionModule],
  controllers: [HealthController],
})
export class AppModule {}
