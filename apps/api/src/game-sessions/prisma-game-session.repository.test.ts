import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma.service.js';
import { PrismaGameSessionRepository } from './prisma-game-session.repository.js';

function question(id: string, prompt = id) {
  return {
    id,
    subject: 'math',
    difficulty: 1,
    skillKey: 'addition-within-20',
    prompt: `Legacy ${prompt}`,
    explanation: `Legacy explanation ${prompt}`,
    status: 'published',
    translations: [
      {
        locale: 'en',
        prompt: `English ${prompt}`,
        explanation: `English explanation ${prompt}`,
      },
      {
        locale: 'zh-CN',
        prompt: `中文 ${prompt}`,
        explanation: `中文讲解 ${prompt}`,
      },
    ],
    answers: [
      {
        id: `${id}_wrong`,
        text: 'Wrong',
        isCorrect: false,
        translations: [{ locale: 'zh-CN', text: '错误' }],
      },
      {
        id: `${id}_correct`,
        text: 'Correct',
        isCorrect: true,
        translations: [{ locale: 'zh-CN', text: '正确' }],
      },
    ],
  };
}

describe('PrismaGameSessionRepository', () => {
  const prisma = {
    child: { findUnique: vi.fn() },
    level: { findUnique: vi.fn(), findMany: vi.fn() },
    tank: { findUnique: vi.fn(), findMany: vi.fn() },
    gameSession: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  let repository: PrismaGameSessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PrismaGameSessionRepository(
      prisma as unknown as PrismaService
    );
  });

  it('returns each published level subject in the catalog contract', async () => {
    prisma.level.findMany.mockResolvedValue([
      {
        id: 'level_1',
        code: 'addition-range',
        titleKey: 'level.additionRange.title',
        mode: 'child_learning',
        subjectFocus: 'math',
        baseDifficulty: 1,
        configJson: { theme: 'training-base' },
      },
    ]);

    await expect(repository.listLevels()).resolves.toMatchObject([
      { code: 'addition-range', subject: 'math', baseDifficulty: 1 },
    ]);
  });

  it('loads only published localized content and avoids recent questions', async () => {
    prisma.child.findUnique.mockResolvedValue({
      ageGroup: 'child_6_8',
      controls: {
        allowedModes: ['child_learning'],
        allowedSubjects: ['math'],
        maxDifficulty: 3,
        aiExplanationEnabled: true,
      },
      tanks: [{ upgrades: [], selectedSkin: null }],
    });
    prisma.level.findUnique.mockResolvedValue({
      id: 'level_1',
      code: 'addition-range',
      titleKey: 'level.additionRange.title',
      mode: 'child_learning',
      subjectFocus: 'math',
      baseDifficulty: 1,
      configJson: {},
      status: 'published',
      questions: ['q1', 'q2', 'q3', 'q4'].map((id) => ({
        questionId: id,
        question: question(id),
      })),
    });
    prisma.tank.findUnique.mockResolvedValue({
      id: 'tank_1',
      code: 'star-shield',
      nameKey: 'tank.starShield.name',
      role: 'medium',
      isActive: true,
      stats: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
      skins: [],
    });
    prisma.gameSession.findMany.mockResolvedValue([
      { questions: [{ questionId: 'q1' }] },
    ]);

    const setup = await repository.loadSetup({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
      locale: 'zh-CN',
    });

    expect(setup?.questions.map((item) => item.id)).toEqual(['q2', 'q3', 'q4']);
    expect(setup?.questions[0]).toMatchObject({
      prompt: '中文 q2',
      explanation: '中文讲解 q2',
      choices: [{ text: '错误' }, { text: '正确' }],
    });
    expect(prisma.level.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          questions: expect.objectContaining({
            where: { question: { status: 'published' } },
          }),
        }),
      })
    );
    expect(prisma.gameSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  it('persists locale and the ordered question snapshot', async () => {
    prisma.gameSession.create.mockResolvedValue({ id: 'session_1' });

    await repository.createSession({
      childId: 'child_1',
      levelId: 'level_1',
      tankId: 'tank_1',
      locale: 'zh-CN',
      mode: 'child_learning',
      difficulty: 1,
      questionIds: ['q2', 'q3'],
    });

    expect(prisma.gameSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locale: 'zh-CN',
        questions: {
          create: [
            { questionId: 'q2', sortOrder: 0 },
            { questionId: 'q3', sortOrder: 1 },
          ],
        },
      }),
      select: { id: true },
    });
  });

  it('prefers the session snapshot over current level relations', async () => {
    const levelQuestion = question('level_question', 'level question');
    const sessionQuestion = question('session_question', 'session question');
    prisma.gameSession.findUnique.mockResolvedValue({
      id: 'session_1',
      childId: 'child_1',
      locale: 'en',
      status: 'active',
      rewardSummary: null,
      child: {
        ageGroup: 'child_6_8',
        controls: { aiExplanationEnabled: true },
      },
      level: {
        id: 'level_1',
        code: 'addition-range',
        titleKey: 'level.additionRange.title',
        mode: 'child_learning',
        subjectFocus: 'math',
        baseDifficulty: 1,
        configJson: {},
        questions: [{ question: levelQuestion }],
      },
      tank: {
        id: 'tank_1',
        code: 'star-shield',
        nameKey: 'tank.starShield.name',
        role: 'medium',
        stats: {
          firepower: 3,
          mobility: 3,
          armor: 3,
          stealth: 2,
          vision: 3,
        },
      },
      questions: [{ question: sessionQuestion }],
      answers: [],
    });

    const session = await repository.findSession('session_1');

    expect(session?.setup.questions.map((item) => item.id)).toEqual([
      'session_question',
    ]);
    expect(session?.setup.questions[0]?.prompt).toBe(
      'English session question'
    );
  });

  it('falls back to level questions for a legacy session without a snapshot', async () => {
    const legacyQuestion = question('legacy_question', 'legacy question');
    prisma.gameSession.findUnique.mockResolvedValue({
      id: 'session_legacy',
      childId: 'child_1',
      locale: 'en',
      status: 'active',
      rewardSummary: null,
      child: {
        ageGroup: 'child_6_8',
        controls: { aiExplanationEnabled: false },
      },
      level: {
        id: 'level_1',
        code: 'addition-range',
        titleKey: 'level.additionRange.title',
        mode: 'child_learning',
        subjectFocus: 'math',
        baseDifficulty: 1,
        configJson: {},
        questions: [{ question: legacyQuestion }],
      },
      tank: {
        id: 'tank_1',
        code: 'star-shield',
        nameKey: 'tank.starShield.name',
        role: 'medium',
        stats: {
          firepower: 3,
          mobility: 3,
          armor: 3,
          stealth: 2,
          vision: 3,
        },
      },
      questions: [],
      answers: [],
    });

    const session = await repository.findSession('session_legacy');

    expect(session?.setup.questions[0]?.id).toBe('legacy_question');
  });
});
