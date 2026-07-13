import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import {
  gameEventSchema,
  startSessionRequestSchema,
  submitAnswerRequestSchema,
} from '@tankquest/shared';
import { randomUUID } from 'node:crypto';

import { GameSessionRepository } from './game-session.repository.js';
import { GameSessionService } from './game-session.service.js';
import { parseRequest } from './parse-request.js';

@Controller('api')
export class GameSessionController {
  constructor(
    @Inject(GameSessionService)
    private readonly service: GameSessionService,
    @Inject(GameSessionRepository)
    private readonly repository: GameSessionRepository
  ) {}

  @Get('levels')
  async listLevels() {
    return this.success(await this.repository.listLevels());
  }

  @Get('tanks')
  async listTanks() {
    return this.success(await this.repository.listTanks());
  }

  @Post('game-sessions')
  async start(@Body() body: unknown) {
    return this.success(
      await this.service.start(parseRequest(startSessionRequestSchema, body))
    );
  }

  @Post('game-sessions/:sessionId/answers')
  async answer(@Param('sessionId') sessionId: string, @Body() body: unknown) {
    return this.success(
      await this.service.submitAnswer(
        sessionId,
        parseRequest(submitAnswerRequestSchema, body)
      )
    );
  }

  @Post('game-sessions/:sessionId/events')
  async event(@Param('sessionId') sessionId: string, @Body() body: unknown) {
    await this.service.recordEvent(
      sessionId,
      parseRequest(gameEventSchema, body)
    );
    return this.success({ accepted: true });
  }

  @Post('game-sessions/:sessionId/finish')
  async finish(@Param('sessionId') sessionId: string) {
    return this.success(await this.service.finish(sessionId));
  }

  private success<T>(data: T) {
    return { data, error: null, requestId: `req_${randomUUID()}` };
  }
}
