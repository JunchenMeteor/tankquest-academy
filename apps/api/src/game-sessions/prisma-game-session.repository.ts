import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ageGroupSchema,
  gameModeSchema,
  subjectSchema,
  type FinishSessionResponse,
  type GameEventRequest,
  type LevelDto,
  type StartSessionRequest,
  type TankDto,
} from '@tankquest/shared';

import { PrismaService } from '../prisma.service.js';
import type {
  InternalQuestion,
  NewSession,
  RecordedAnswer,
  SessionSetup,
  SessionState,
} from './game-session.models.js';
import { GameSessionRepository } from './game-session.repository.js';
import { applyTankUpgrades } from './tank-upgrades.js';

const setupInclude = {
  child: { include: { controls: true } },
  level: {
    include: {
      questions: {
        include: {
          question: { include: { answers: { orderBy: { sortOrder: 'asc' } } } },
        },
      },
    },
  },
  tank: { include: { stats: true } },
  answers: true,
} satisfies Prisma.GameSessionInclude;

@Injectable()
export class PrismaGameSessionRepository extends GameSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listLevels(): Promise<LevelDto[]> {
    const levels = await this.prisma.level.findMany({
      where: { status: 'published' },
      orderBy: [{ baseDifficulty: 'asc' }, { code: 'asc' }],
    });
    return levels.map((level) => this.toLevel(level));
  }

  async listTanks(): Promise<TankDto[]> {
    const tanks = await this.prisma.tank.findMany({
      where: { isActive: true },
      include: { stats: true },
      orderBy: { code: 'asc' },
    });
    return tanks.flatMap((tank) =>
      tank.stats ? [this.toTank(tank, tank.stats)] : []
    );
  }

  async loadSetup(request: StartSessionRequest): Promise<SessionSetup | null> {
    const [child, level, tank] = await Promise.all([
      this.prisma.child.findUnique({
        where: { id: request.childId },
        include: {
          controls: true,
          tanks: {
            where: { tankId: request.tankId },
            include: { upgrades: true, selectedSkin: true },
          },
        },
      }),
      this.prisma.level.findUnique({
        where: { id: request.levelId },
        include: {
          questions: {
            include: {
              question: {
                include: { answers: { orderBy: { sortOrder: 'asc' } } },
              },
            },
          },
        },
      }),
      this.prisma.tank.findUnique({
        where: { id: request.tankId },
        include: {
          stats: true,
          skins: { where: { isDefault: true, isActive: true }, take: 1 },
        },
      }),
    ]);

    const controls = child?.controls;
    const ownedTank = child?.tanks[0];
    if (
      !child ||
      !controls ||
      !ownedTank ||
      !level ||
      level.status !== 'published' ||
      !controls.allowedModes.includes(level.mode) ||
      !controls.allowedSubjects.includes(level.subjectFocus) ||
      level.baseDifficulty > controls.maxDifficulty ||
      !tank?.stats ||
      !tank.isActive
    ) {
      return null;
    }

    return {
      level: this.toLevel(level),
      tank: this.toTank(
        tank,
        applyTankUpgrades(tank.stats, ownedTank.upgrades),
        ownedTank.selectedSkin ?? tank.skins[0]
      ),
      questions: level.questions.map(({ question }) =>
        this.toInternalQuestion(question)
      ),
      learner: {
        ageGroup: ageGroupSchema.parse(child.ageGroup),
        aiExplanationEnabled: controls.aiExplanationEnabled,
      },
    };
  }

  async createSession(session: NewSession): Promise<string> {
    const created = await this.prisma.gameSession.create({
      data: {
        childId: session.childId,
        levelId: session.levelId,
        tankId: session.tankId,
        mode: session.mode,
        difficultySnapshot: { questionDifficulty: session.difficulty },
      },
      select: { id: true },
    });
    return created.id;
  }

  async findSession(sessionId: string): Promise<SessionState | null> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: setupInclude,
    });
    if (!session?.tank.stats) {
      return null;
    }

    return {
      id: session.id,
      childId: session.childId,
      status: session.status,
      setup: {
        level: this.toLevel(session.level),
        tank: this.toTank(session.tank, session.tank.stats),
        questions: session.level.questions.map(({ question }) =>
          this.toInternalQuestion(question)
        ),
        learner: {
          ageGroup: ageGroupSchema.parse(session.child.ageGroup),
          aiExplanationEnabled:
            session.child.controls?.aiExplanationEnabled ?? false,
        },
      },
      answers: session.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedAnswerId: answer.selectedAnswerId,
        correct: answer.isCorrect,
        answerTimeMs: answer.answerTimeMs,
      })),
      settlement: session.rewardSummary
        ? (session.rewardSummary as unknown as FinishSessionResponse)
        : null,
    };
  }

  async recordAnswer(sessionId: string, answer: RecordedAnswer): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.gameSessionAnswer.create({
        data: {
          sessionId,
          questionId: answer.questionId,
          selectedAnswerId: answer.selectedAnswerId,
          isCorrect: answer.correct,
          answerTimeMs: answer.answerTimeMs,
        },
      });
      const [session, question] = await Promise.all([
        transaction.gameSession.findUniqueOrThrow({
          where: { id: sessionId },
          select: { childId: true },
        }),
        transaction.question.findUniqueOrThrow({
          where: { id: answer.questionId },
          select: { subject: true, skillKey: true, difficulty: true },
        }),
      ]);
      const key = {
        childId_subject_skillKey: {
          childId: session.childId,
          subject: question.subject,
          skillKey: question.skillKey,
        },
      };
      const existing = await transaction.learningRecord.findUnique({
        where: key,
      });
      const attempts = (existing?.attempts ?? 0) + 1;
      const averageAnswerTimeMs = Math.round(
        ((existing?.averageAnswerTimeMs ?? 0) * (attempts - 1) +
          answer.answerTimeMs) /
          attempts
      );
      await transaction.learningRecord.upsert({
        where: key,
        update: {
          attempts: { increment: 1 },
          correctCount: { increment: answer.correct ? 1 : 0 },
          averageAnswerTimeMs,
          currentDifficulty: question.difficulty,
        },
        create: {
          childId: session.childId,
          subject: question.subject,
          skillKey: question.skillKey,
          attempts: 1,
          correctCount: answer.correct ? 1 : 0,
          averageAnswerTimeMs: answer.answerTimeMs,
          currentDifficulty: question.difficulty,
        },
      });
    });
  }

  async recordEvent(sessionId: string, event: GameEventRequest): Promise<void> {
    await this.prisma.gameSessionEvent.create({
      data: {
        sessionId,
        eventType: event.eventType,
        payloadJson: event.payload as Prisma.InputJsonValue,
        clientTimeMs: event.clientTimeMs,
      },
    });
  }

  async settleSession(
    sessionId: string,
    settlement: FinishSessionResponse
  ): Promise<FinishSessionResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const rewardSummary = JSON.parse(
        JSON.stringify(settlement)
      ) as Prisma.InputJsonValue;
      const claimed = await transaction.gameSession.updateMany({
        where: { id: sessionId, status: 'active' },
        data: { status: 'finished', finishedAt: new Date(), rewardSummary },
      });
      if (claimed.count === 0) {
        const existing = await transaction.gameSession.findUniqueOrThrow({
          where: { id: sessionId },
        });
        if (!existing.rewardSummary) {
          throw new Error('Finished session has no reward summary');
        }
        return existing.rewardSummary as unknown as FinishSessionResponse;
      }

      const session = await transaction.gameSession.findUniqueOrThrow({
        where: { id: sessionId },
      });

      for (const reward of settlement.rewards) {
        await transaction.gameSessionReward.create({
          data: {
            sessionId,
            rewardType: reward.type,
            rewardKey: reward.key,
            amount: reward.amount,
            reason: 'session_complete',
          },
        });
        await transaction.childInventory.upsert({
          where: {
            childId_itemType_itemKey: {
              childId: session.childId,
              itemType: reward.type,
              itemKey: reward.key,
            },
          },
          update: { amount: { increment: reward.amount } },
          create: {
            childId: session.childId,
            itemType: reward.type,
            itemKey: reward.key,
            amount: reward.amount,
          },
        });
      }

      return settlement;
    });
  }

  private toLevel(level: {
    id: string;
    code: string;
    titleKey: string;
    mode: string;
    baseDifficulty: number;
    configJson: Prisma.JsonValue;
  }): LevelDto {
    return {
      id: level.id,
      code: level.code,
      titleKey: level.titleKey,
      mode: gameModeSchema.parse(level.mode),
      baseDifficulty: level.baseDifficulty,
      config: this.asRecord(level.configJson),
    };
  }

  private toTank(
    tank: { id: string; code: string; nameKey: string; role: string },
    stats: {
      firepower: number;
      mobility: number;
      armor: number;
      stealth: number;
      vision: number;
    },
    skin?: {
      id: string;
      code: string;
      nameKey: string;
      primaryColor: string;
      secondaryColor: string;
    }
  ): TankDto {
    return {
      id: tank.id,
      code: tank.code,
      nameKey: tank.nameKey,
      role: tank.role,
      stats: {
        firepower: stats.firepower,
        mobility: stats.mobility,
        armor: stats.armor,
        stealth: stats.stealth,
        vision: stats.vision,
      },
      ...(skin
        ? {
            skin: {
              id: skin.id,
              code: skin.code,
              nameKey: skin.nameKey,
              primaryColor: skin.primaryColor,
              secondaryColor: skin.secondaryColor,
            },
          }
        : {}),
    };
  }

  private toInternalQuestion(question: {
    id: string;
    subject: string;
    difficulty: number;
    skillKey: string;
    prompt: string;
    explanation: string;
    answers: Array<{ id: string; text: string; isCorrect: boolean }>;
  }): InternalQuestion {
    const correctAnswer = question.answers.find((answer) => answer.isCorrect);
    if (!correctAnswer) {
      throw new Error(
        `Published question ${question.id} has no correct answer`
      );
    }
    return {
      id: question.id,
      subject: subjectSchema.parse(question.subject),
      difficulty: question.difficulty,
      skillKey: question.skillKey,
      prompt: question.prompt,
      choices: question.answers.map((answer) => ({
        id: answer.id,
        text: answer.text,
      })),
      correctAnswerId: correctAnswer.id,
      explanation: question.explanation,
    };
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
