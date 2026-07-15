import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  FinishSessionResponse,
  LevelDto,
  TankDto,
} from '@tankquest/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiGatewayService } from '../ai/ai-gateway.service.js';
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
  learner: { ageGroup: 'child_6_8', aiExplanationEnabled: true },
  questions: [
    {
      id: 'question_1',
      subject: 'math',
      difficulty: 1,
      skillKey: 'addition-within-20',
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
    const sessionSetup = structuredClone(setup);
    this.session = {
      id: 'session_1',
      childId: session.childId,
      status: 'active',
      setup: sessionSetup,
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
  let aiGateway: {
    createWrongAnswerExplanation: ReturnType<typeof vi.fn>;
  };
  let service: GameSessionService;

  beforeEach(() => {
    repository = new MemoryRepository();
    aiGateway = {
      createWrongAnswerExplanation: vi.fn().mockResolvedValue({
        requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
        source: 'template',
        fallbackReason: null,
        correctAnswer: '15',
        explanation: 'Work through the addition one step at a time.',
      }),
    };
    service = new GameSessionService(
      repository,
      aiGateway as unknown as AiGatewayService
    );
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
    expect(aiGateway.createWrongAnswerExplanation).not.toHaveBeenCalled();
    await expect(
      service.submitAnswer('session_1', answer)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses a minimal AI payload only after an incorrect answer', async () => {
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });

    await expect(
      service.submitAnswer('session_1', {
        questionId: 'question_1',
        selectedAnswerId: 'answer_a',
        answerTimeMs: 900,
        locale: 'en',
      })
    ).resolves.toEqual({
      correct: false,
      explanation: 'Work through the addition one step at a time.',
      resourceReward: { type: 'ammo', amount: 0 },
    });
    expect(repository.session?.answers[0]?.correct).toBe(false);
    expect(aiGateway.createWrongAnswerExplanation).toHaveBeenCalledWith({
      ageGroup: '6-8',
      locale: 'en',
      subject: 'math',
      skillKey: 'addition-within-20',
      difficulty: 1,
      question: '8 + 7 = ?',
      selectedAnswer: '12',
      correctAnswer: '15',
    });
    expect(
      aiGateway.createWrongAnswerExplanation.mock.calls[0]?.[0]
    ).not.toHaveProperty('childId');
  });

  it('falls back when AI changes the authoritative correct answer', async () => {
    aiGateway.createWrongAnswerExplanation.mockResolvedValueOnce({
      requestId: 'e96e124f-98d5-44b9-9690-002f7a5a5454',
      source: 'model',
      fallbackReason: null,
      correctAnswer: '12',
      explanation: 'Unsafe mismatch.',
    });
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });

    await expect(
      service.submitAnswer('session_1', {
        questionId: 'question_1',
        selectedAnswerId: 'answer_a',
        answerTimeMs: 900,
      })
    ).resolves.toMatchObject({ explanation: '8 + 7 = 15' });
  });

  it('rejects an answer that is not part of the question before recording it', async () => {
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });

    await expect(
      service.submitAnswer('session_1', {
        questionId: 'question_1',
        selectedAnswerId: 'answer_unknown',
        answerTimeMs: 900,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.session?.answers).toEqual([]);
    expect(aiGateway.createWrongAnswerExplanation).not.toHaveBeenCalled();
  });

  it('keeps the official explanation when parent controls disable AI', async () => {
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });
    if (!repository.session) throw new Error('Session was not created');
    repository.session.setup.learner.aiExplanationEnabled = false;

    await expect(
      service.submitAnswer('session_1', {
        questionId: 'question_1',
        selectedAnswerId: 'answer_a',
        answerTimeMs: 900,
        locale: 'zh-CN',
      })
    ).resolves.toMatchObject({ explanation: '8 + 7 = 15' });
    expect(aiGateway.createWrongAnswerExplanation).not.toHaveBeenCalled();
  });

  it.each(['teen', 'adult'] as const)(
    'keeps the official explanation for the %s age group',
    async (ageGroup) => {
      await service.start({
        childId: 'child_1',
        levelId: 'level_1',
        tankId: 'tank_1',
      });
      if (!repository.session) throw new Error('Session was not created');
      repository.session.setup.learner.ageGroup = ageGroup;

      await expect(
        service.submitAnswer('session_1', {
          questionId: 'question_1',
          selectedAnswerId: 'answer_a',
          answerTimeMs: 900,
        })
      ).resolves.toMatchObject({ explanation: '8 + 7 = 15' });
      expect(aiGateway.createWrongAnswerExplanation).not.toHaveBeenCalled();
    }
  );

  it.each(['logic', 'physics'] as const)(
    'keeps the official explanation for the %s subject',
    async (subject) => {
      await service.start({
        childId: 'child_1',
        levelId: 'level_1',
        tankId: 'tank_1',
      });
      if (!repository.session) throw new Error('Session was not created');
      repository.session.setup.questions[0]!.subject = subject;

      await expect(
        service.submitAnswer('session_1', {
          questionId: 'question_1',
          selectedAnswerId: 'answer_a',
          answerTimeMs: 900,
        })
      ).resolves.toMatchObject({ explanation: '8 + 7 = 15' });
      expect(aiGateway.createWrongAnswerExplanation).not.toHaveBeenCalled();
    }
  );

  it('keeps the official explanation when the AI gateway is unavailable', async () => {
    aiGateway.createWrongAnswerExplanation.mockResolvedValueOnce(null);
    await service.start({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
    });

    await expect(
      service.submitAnswer('session_1', {
        questionId: 'question_1',
        selectedAnswerId: 'answer_a',
        answerTimeMs: 900,
      })
    ).resolves.toMatchObject({ explanation: '8 + 7 = 15' });
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
