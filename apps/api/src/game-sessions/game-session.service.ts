import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AgeGroup,
  FinishSessionResponse,
  GameEventRequest,
  NextPracticeRecommendationDto,
  StartSessionRequest,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  Subject,
} from '@tankquest/shared';

import { AiGatewayService } from '../ai/ai-gateway.service.js';
import {
  buildAdaptivePracticePolicy,
  resolveNextPractice,
} from './adaptive-learning.js';
import { GameSessionRepository } from './game-session.repository.js';
import type {
  AdaptiveLearningContext,
  InternalQuestion,
  SessionState,
} from './game-session.models.js';
import { calculateSettlement } from './settlement.js';

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);

  constructor(
    @Inject(GameSessionRepository)
    private readonly repository: GameSessionRepository,
    @Inject(AiGatewayService)
    private readonly aiGateway: AiGatewayService
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
      locale: request.locale ?? 'en',
      questionIds: setup.questions.map((question) => question.id),
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

    const selectedChoice = question.choices.find(
      (choice) => choice.id === request.selectedAnswerId
    );
    if (!selectedChoice) {
      throw new ForbiddenException('Answer is not part of this question');
    }
    const correctChoice = question.choices.find(
      (choice) => choice.id === question.correctAnswerId
    );
    if (!correctChoice) {
      throw new Error('Question has no matching correct answer');
    }

    const correct = question.correctAnswerId === request.selectedAnswerId;
    await this.repository.recordAnswer(sessionId, {
      questionId: request.questionId,
      selectedAnswerId: request.selectedAnswerId,
      answerTimeMs: request.answerTimeMs,
      correct,
    });

    const explanation = correct
      ? question.explanation
      : await this.explainWrongAnswer(
          session,
          question,
          selectedChoice.text,
          correctChoice.text,
          session.locale
        );

    return {
      correct,
      explanation,
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

    const baseSettlement = calculateSettlement(
      sessionId,
      session.answers,
      session.setup.questions.length
    );
    const context = await this.loadAdaptiveContext(session.childId);
    const policy = context ? buildAdaptivePracticePolicy(context) : null;
    let nextPractice: NextPracticeRecommendationDto | null = null;
    if (policy && context) {
      const ageGroup = toAiAgeGroup(context.ageGroup);
      const aiResponse =
        policy.skipAi || !ageGroup || !isAiSubject(policy.focus.subject)
          ? null
          : await this.aiGateway.createPracticeRecommendation({
              ageGroup,
              subject: policy.focus.subject,
              skillKey: policy.focus.skillKey,
              currentDifficulty: policy.currentDifficulty,
              attempts: policy.focus.attempts,
              accuracy: policy.focus.accuracy,
              averageAnswerTimeMs: policy.focus.averageAnswerTimeMs,
              completedSessions: policy.completedSessions + 1,
              allowedDifficulty: policy.allowedDifficulty,
            });
      nextPractice = resolveNextPractice(policy, aiResponse);
    }
    const settlement = nextPractice
      ? { ...baseSettlement, nextPractice }
      : baseSettlement;
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

  private async loadAdaptiveContext(
    childId: string
  ): Promise<AdaptiveLearningContext | null> {
    try {
      return await this.repository.loadAdaptiveContext(childId);
    } catch {
      this.logger.warn(
        'Adaptive practice context unavailable; settling without a recommendation'
      );
      return null;
    }
  }

  private async explainWrongAnswer(
    session: SessionState,
    question: InternalQuestion,
    selectedAnswer: string,
    correctAnswer: string,
    locale: 'en' | 'zh-CN'
  ): Promise<string> {
    const ageGroup = toAiAgeGroup(session.setup.learner.ageGroup);
    if (
      !session.setup.learner.aiExplanationEnabled ||
      !ageGroup ||
      !isAiSubject(question.subject)
    ) {
      return question.explanation;
    }

    const result = await this.aiGateway.createWrongAnswerExplanation({
      ageGroup,
      locale,
      subject: question.subject,
      skillKey: question.skillKey,
      difficulty: question.difficulty,
      question: question.prompt,
      selectedAnswer,
      correctAnswer,
    });
    return result?.correctAnswer === correctAnswer
      ? result.explanation
      : question.explanation;
  }
}

function toAiAgeGroup(ageGroup: AgeGroup): '6-8' | '9-12' | null {
  if (ageGroup === 'child_6_8') return '6-8';
  if (ageGroup === 'child_9_12') return '9-12';
  return null;
}

function isAiSubject(
  subject: Subject
): subject is 'math' | 'english' | 'direction' {
  return subject === 'math' || subject === 'english' || subject === 'direction';
}
