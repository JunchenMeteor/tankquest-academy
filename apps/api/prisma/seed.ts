import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const enemyPresets = {
  scout: {
    stats: { firepower: 2, mobility: 4, armor: 1, stealth: 4, vision: 3 },
    ai: {
      detectionRange: 300,
      attackRange: 205,
      fireCooldownMs: 1900,
      speedMultiplier: 0.42,
    },
  },
  medium: {
    stats: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
    ai: {
      detectionRange: 310,
      attackRange: 230,
      fireCooldownMs: 1650,
      speedMultiplier: 0.38,
    },
  },
  heavy: {
    stats: { firepower: 4, mobility: 2, armor: 5, stealth: 1, vision: 2 },
    ai: {
      detectionRange: 280,
      attackRange: 250,
      fireCooldownMs: 1450,
      speedMultiplier: 0.32,
    },
  },
} as const;

function enemyTank(
  id: string,
  role: keyof typeof enemyPresets,
  x: number,
  y: number,
  elite = false
) {
  const preset = enemyPresets[role];
  return {
    id,
    role,
    x,
    y,
    stats: elite
      ? {
          ...preset.stats,
          firepower: Math.min(5, preset.stats.firepower + 1),
          armor: Math.min(5, preset.stats.armor + 1),
          vision: Math.min(5, preset.stats.vision + 1),
        }
      : preset.stats,
    ai: elite
      ? {
          ...preset.ai,
          detectionRange: preset.ai.detectionRange + 20,
          attackRange: preset.ai.attackRange + 10,
          fireCooldownMs: preset.ai.fireCooldownMs - 150,
          speedMultiplier: preset.ai.speedMultiplier + 0.03,
        }
      : preset.ai,
  };
}

const levelSeeds = [
  {
    code: 'addition-range',
    titleKey: 'level.additionRange.title',
    difficulty: 1,
    enemyTanks: [
      enemyTank('addition_scout_alpha', 'scout', 720, 145),
      enemyTank('addition_scout_bravo', 'scout', 790, 390),
    ],
  },
  {
    code: 'supply-gate',
    titleKey: 'level.supplyGate.title',
    difficulty: 2,
    enemyTanks: [
      enemyTank('supply_scout', 'scout', 690, 110),
      enemyTank('supply_medium_alpha', 'medium', 780, 270),
      enemyTank('supply_medium_bravo', 'medium', 690, 430),
    ],
  },
  {
    code: 'robot-patrol',
    titleKey: 'level.robotPatrol.title',
    difficulty: 3,
    enemyTanks: [
      enemyTank('patrol_scout', 'scout', 665, 90, true),
      enemyTank('patrol_medium_alpha', 'medium', 800, 170, true),
      enemyTank('patrol_medium_bravo', 'medium', 800, 370, true),
      enemyTank('patrol_heavy', 'heavy', 665, 450, true),
    ],
  },
];

const questionSeeds = [
  { prompt: '8 + 7 = ?', correct: '15', choices: ['12', '15', '17'] },
  { prompt: '9 + 6 = ?', correct: '15', choices: ['14', '15', '16'] },
  { prompt: '13 - 5 = ?', correct: '8', choices: ['7', '8', '9'] },
];

async function seed() {
  const parent = await prisma.user.upsert({
    where: { email: 'family@example.invalid' },
    update: {},
    create: {
      email: 'family@example.invalid',
      passwordHash: 'development-seed-not-a-login',
      displayName: 'TankQuest Family',
    },
  });

  const child = await prisma.child.upsert({
    where: { id: 'child_demo' },
    update: {},
    create: {
      id: 'child_demo',
      parentUserId: parent.id,
      nickname: 'Cadet',
      birthYear: 2018,
      ageGroup: 'child_6_8',
      controls: { create: {} },
    },
  });

  await prisma.parentControl.upsert({
    where: { childId: child.id },
    update: { maxDifficulty: 3 },
    create: { childId: child.id, maxDifficulty: 3 },
  });

  const tank = await prisma.tank.upsert({
    where: { code: 'star-shield' },
    update: {},
    create: {
      id: 'tank_star_shield',
      code: 'star-shield',
      nameKey: 'tank.starShield.name',
      role: 'medium',
      stats: {
        create: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
      },
    },
  });

  await prisma.childTank.upsert({
    where: { childId_tankId: { childId: child.id, tankId: tank.id } },
    update: {},
    create: { childId: child.id, tankId: tank.id },
  });

  const questions = [];
  for (const [index, item] of questionSeeds.entries()) {
    const id = `question_math_${index + 1}`;
    questions.push(
      await prisma.question.upsert({
        where: { id },
        update: {},
        create: {
          id,
          subject: 'math',
          mode: 'child_learning',
          difficulty: index === 2 ? 2 : 1,
          prompt: item.prompt,
          explanation: `${item.prompt.replace('?', item.correct)}`,
          status: 'published',
          answers: {
            create: item.choices.map((choice, choiceIndex) => ({
              id: `${id}_answer_${choiceIndex + 1}`,
              text: choice,
              isCorrect: choice === item.correct,
              sortOrder: choiceIndex,
            })),
          },
        },
      })
    );
  }

  for (const item of levelSeeds) {
    const configJson = {
      theme: 'training-base',
      enemyTanks: item.enemyTanks,
      objectives: ['answer_questions', 'defeat_training_tanks'],
    };
    await prisma.level.upsert({
      where: { code: item.code },
      update: {
        baseDifficulty: item.difficulty,
        configJson,
        version: 2,
      },
      create: {
        id: `level_${item.code.replaceAll('-', '_')}`,
        code: item.code,
        titleKey: item.titleKey,
        mode: 'child_learning',
        subjectFocus: 'math',
        baseDifficulty: item.difficulty,
        status: 'published',
        configJson,
        questions: {
          create: questions.map((question) => ({ questionId: question.id })),
        },
      },
    });
  }
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
