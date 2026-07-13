import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { GameSessionController } from './game-session.controller.js';
import { GameSessionRepository } from './game-session.repository.js';
import { GameSessionService } from './game-session.service.js';
import { PrismaGameSessionRepository } from './prisma-game-session.repository.js';

@Module({
  controllers: [GameSessionController],
  providers: [
    PrismaService,
    GameSessionService,
    { provide: GameSessionRepository, useClass: PrismaGameSessionRepository },
  ],
})
export class GameSessionModule {}
