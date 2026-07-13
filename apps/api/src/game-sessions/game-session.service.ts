import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FinishSessionResponse,
  GameEventRequest,
  StartSessionRequest,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '@tankquest/shared';

import { GameSessionRepository } from './game-session.repository.js';
import { calculateSettlement } from './settlement.js';

@Injectable()
export class GameSessionService {
  constructor(
    @Inject(GameSessionRepository)
    private readonly repository: GameSessionRepository
  ) {}

  async start(request: StartSessionRequest): Promise<StartSessionResponse> {
    const setup = await this.repository.loadSetup(request);
    if (!setup) {
      throw new ForbiddenException('Child, level, or tank is not available');
    }

    const sessionId = await this.repository.createSession({
      ...request,
      mode: setup.level.mode,
      difficulty: setup.level.baseDifficulty,
    });

    return {
      sessionId,
      level: setup.level,
      tank: setup.tank,
      questions: setup.questions.map((question) => ({
        id: question.id,
        subject: question.subject,
        difficulty: question.difficulty,
        prompt: question.prompt,
        choices: question.choices,
      })),
    };
  }

  async submitAnswer(
    sessionId: string,
    request: SubmitAnswerRequest
  ): Promise<SubmitAnswerResponse> {
    const session = await this.requireActiveSession(sessionId);
    const question = session.setup.questions.find(
      (item) => item.id === request.questionId
    );
    if (!question) {
      throw new ForbiddenException('Question is not part of this session');
    }
    if (
      session.answers.some((answer) => answer.questionId === request.questionId)
    ) {
      throw new ConflictException('Question has already been answered');
    }

    const correct = question.correctAnswerId === request.selectedAnswerId;
    await this.repository.recordAnswer(sessionId, {
      ...request,
      correct,
    });

    return {
      correct,
      explanation: question.explanation,
      resourceReward: { type: 'ammo', amount: correct ? 1 : 0 },
    };
  }

  async recordEvent(sessionId: string, event: GameEventRequest): Promise<void> {
    await this.requireActiveSession(sessionId);
    await this.repository.recordEvent(sessionId, event);
  }

  async finish(sessionId: string): Promise<FinishSessionResponse> {
    const session = await this.repository.findSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session was not found');
    }
    if (session.settlement) {
      return session.settlement;
    }

    const settlement = calculateSettlement(
      sessionId,
      session.answers,
      session.setup.questions.length
    );
    return this.repository.settleSession(sessionId, settlement);
  }

  private async requireActiveSession(sessionId: string) {
    const session = await this.repository.findSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session was not found');
    }
    if (session.status !== 'active') {
      throw new ConflictException('Session is not active');
    }
    return session;
  }
}
