import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const levelSeeds = [
  {
    code: 'addition-range',
    titleKey: 'level.additionRange.title',
    difficulty: 1,
  },
  { code: 'supply-gate', titleKey: 'level.supplyGate.title', difficulty: 1 },
  { code: 'robot-patrol', titleKey: 'level.robotPatrol.title', difficulty: 2 },
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
    await prisma.level.upsert({
      where: { code: item.code },
      update: {},
      create: {
        id: `level_${item.code.replaceAll('-', '_')}`,
        code: item.code,
        titleKey: item.titleKey,
        mode: 'child_learning',
        subjectFocus: 'math',
        baseDifficulty: item.difficulty,
        status: 'published',
        configJson: {
          theme: 'training-base',
          enemyCount: item.difficulty,
          objectives: ['answer_questions', 'reach_exit'],
        },
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
