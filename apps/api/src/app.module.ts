import { Module } from '@nestjs/common';

import { GameSessionModule } from './game-sessions/game-session.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [GameSessionModule],
  controllers: [HealthController],
})
export class AppModule {}
