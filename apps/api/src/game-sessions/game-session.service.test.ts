import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  FinishSessionResponse,
  LevelDto,
  TankDto,
} from '@tankquest/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  NewSession,
  RecordedAnswer,
  SessionSetup,
  SessionState,
} from './game-session.models.js';
import { GameSessionRepository } from './game-session.repository.js';
import { GameSessionService } from './game-session.service.js';

const setup: SessionSetup = {
  level: {
    id: 'level_1',
    code: 'addition-range',
    titleKey: 'level.additionRange.title',
    mode: 'child_learning',
    baseDifficulty: 1,
    config: { theme: 'training-base' },
  },
  tank: {
    id: 'tank_1',
    code: 'star-shield',
    nameKey: 'tank.starShield.name',
    role: 'medium',
    stats: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
  },
  questions: [
    {
      id: 'question_1',
      subject: 'math',
      difficulty: 1,
      prompt: '8 + 7 = ?',
      choices: [
        { id: 'answer_a', text: '12' },
        { id: 'answer_b', text: '15' },
      ],
      correctAnswerId: 'answer_b',
      explanation: '8 + 7 = 15',
    },
  ],
};

class MemoryRepository extends GameSessionRepository {
  session: SessionState | null = null;
  allowSetup = true;

  async listLevels(): Promise<LevelDto[]> {
    return [setup.level];
  }

  async listTanks(): Promise<TankDto[]> {
    return [setup.tank];
  }

  async loadSetup(): Promise<SessionSetup | null> {
    return this.allowSetup ? setup : null;
  }

  async createSession(session: NewSession): Promise<string> {
    this.session = {
      id: 'session_1',
      childId: session.childId,
      status: 'active',
      setup,
      answers: [],
      settlement: null,
    };
    return this.session.id;
  }

  async findSession(): Promise<SessionState | null> {
    return this.session;
  }

  async recordAnswer(
    _sessionId: string,
    answer: RecordedAnswer
  ): Promise<void> {
    this.session?.answers.push(answer);
  }

  async recordEvent(): Promise<void> {}

  async settleSession(
    sessionId: string,
    settlement: FinishSessionResponse
  ): Promise<FinishSessionResponse> {
    void sessionId;
    if (!this.session) {
      throw new Error('Session is missing');
    }
    if (this.session.settlement) {
      return this.session.settlement;
    }
    this.session.status = 'finished';
    this.session.settlement = settlement;
    return settlement;
  }
}

describe('GameSessionService', () => {
  let repository: MemoryRepository;
  let service: GameSessionService;

  beforeEach(() => {
    repository = new MemoryRepository();
    service = new GameSessionService(repository);
  });

  it('starts an allowed session without exposing correct answers', async () => {
    const result = await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });

    expect(result.sessionId).toBe('session_1');
    expect(result.questions[0]).not.toHaveProperty('correctAnswerId');
    expect(result.questions[0]).not.toHaveProperty('explanation');
  });

  it('rejects a session outside the child access boundary', async () => {
    repository.allowSetup = false;
    await expect(
      service.start({
        childId: 'child_1',
        levelId: 'level_1',
        tankId: 'tank_1',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates answers once on the server', async () => {
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });
    const answer = {
      questionId: 'question_1',
      selectedAnswerId: 'answer_b',
      answerTimeMs: 1200,
    };

    await expect(
      service.submitAnswer('session_1', answer)
    ).resolves.toMatchObject({
      correct: true,
      resourceReward: { amount: 1 },
    });
    await expect(
      service.submitAnswer('session_1', answer)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the same settlement for repeated finish requests', async () => {
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });
    await service.submitAnswer('session_1', {
      questionId: 'question_1',
      selectedAnswerId: 'answer_b',
      answerTimeMs: 1200,
    });

    const first = await service.finish('session_1');
    const second = await service.finish('session_1');
    expect(first).toEqual(second);
    expect(first.stars).toBe(3);
  });
});
