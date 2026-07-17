import { PrismaClient } from '@prisma/client';

import assetCatalog from './asset-catalog.json' with { type: 'json' };
import {
  officialQuestionSeeds,
  validateOfficialQuestions,
} from './content/official-questions.js';

const prisma = new PrismaClient();

const enemyPresets = {
  scout: {
    stats: { firepower: 2, mobility: 4, armor: 1, stealth: 4, vision: 3 },
    ai: {
      detectionRange: 300,
      attackRange: 205,
      fireCooldownMs: 1900,
      speedMultiplier: 0.42,
      alertMemoryMs: 6000,
      nearMissRadius: 64,
      allyAlertRadius: 240,
      searchLeashRange: 560,
    },
  },
  medium: {
    stats: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
    ai: {
      detectionRange: 310,
      attackRange: 230,
      fireCooldownMs: 1650,
      speedMultiplier: 0.38,
      alertMemoryMs: 6500,
      nearMissRadius: 64,
      allyAlertRadius: 260,
      searchLeashRange: 560,
    },
  },
  heavy: {
    stats: { firepower: 4, mobility: 2, armor: 5, stealth: 1, vision: 2 },
    ai: {
      detectionRange: 280,
      attackRange: 250,
      fireCooldownMs: 1450,
      speedMultiplier: 0.32,
      alertMemoryMs: 7000,
      nearMissRadius: 72,
      allyAlertRadius: 280,
      searchLeashRange: 520,
    },
  },
} as const;

const tankSeeds = [
  {
    id: 'tank_star_shield',
    code: 'star-shield',
    nameKey: 'tank.starShield.name',
    role: 'medium',
    stats: { firepower: 3, mobility: 3, armor: 3, stealth: 2, vision: 3 },
    skins: [
      ['field-olive', 'skin.fieldOlive.name', '#5d7d46', '#e8c65a'],
      ['academy-blue', 'skin.academyBlue.name', '#426b8a', '#d7edf7'],
    ],
  },
  {
    id: 'tank_swift_fox',
    code: 'swift-fox',
    nameKey: 'tank.swiftFox.name',
    role: 'scout',
    stats: { firepower: 2, mobility: 5, armor: 1, stealth: 4, vision: 4 },
    skins: [
      ['forest-fox', 'skin.forestFox.name', '#4f7748', '#d8a34c'],
      ['arctic-dash', 'skin.arcticDash.name', '#85aebf', '#f2f7f8'],
    ],
  },
  {
    id: 'tank_iron_mountain',
    code: 'iron-mountain',
    nameKey: 'tank.ironMountain.name',
    role: 'heavy',
    stats: { firepower: 4, mobility: 1, armor: 5, stealth: 1, vision: 2 },
    skins: [
      ['iron-red', 'skin.ironRed.name', '#733f39', '#d7aa57'],
      ['night-fortress', 'skin.nightFortress.name', '#343b47', '#91a3bc'],
    ],
  },
] as const;

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

function getQuestionId(questions: Map<string, string>, code: string) {
  const questionId = questions.get(code);
  if (!questionId) throw new Error(`Missing seeded question: ${code}`);
  return questionId;
}

function officialQuestionCodes(
  subject: (typeof officialQuestionSeeds)[number]['subject'],
  difficulty: 1 | 2 | 3 | 4
) {
  return officialQuestionSeeds
    .filter(
      (question) =>
        question.subject === subject && question.difficulty === difficulty
    )
    .map((question) => question.code);
}

const levelSeeds = [
  {
    code: 'addition-range',
    titleKey: 'level.additionRange.title',
    subject: 'math',
    questionCodes: officialQuestionCodes('math', 1),
    difficulty: 1,
    map: {
      style: 'range',
      playerSpawn: { x: 120, y: 270 },
      obstacles: [
        { x: 470, y: 85, width: 170, height: 30 },
        { x: 440, y: 455, width: 140, height: 34 },
      ],
    },
    enemyTanks: [
      enemyTank('addition_scout_alpha', 'scout', 720, 145),
      enemyTank('addition_scout_bravo', 'scout', 790, 390),
    ],
  },
  {
    code: 'supply-gate',
    titleKey: 'level.supplyGate.title',
    subject: 'math',
    questionCodes: officialQuestionCodes('math', 2),
    difficulty: 2,
    map: {
      style: 'gate',
      playerSpawn: { x: 110, y: 270 },
      obstacles: [
        { x: 350, y: 115, width: 48, height: 170 },
        { x: 350, y: 425, width: 48, height: 170 },
        { x: 575, y: 270, width: 54, height: 210 },
        { x: 725, y: 70, width: 170, height: 34 },
        { x: 725, y: 470, width: 170, height: 34 },
      ],
    },
    enemyTanks: [
      enemyTank('supply_scout', 'scout', 690, 110),
      enemyTank('supply_medium_alpha', 'medium', 780, 270),
      enemyTank('supply_medium_bravo', 'medium', 690, 430),
    ],
  },
  {
    code: 'robot-patrol',
    titleKey: 'level.robotPatrol.title',
    subject: 'math',
    questionCodes: officialQuestionCodes('math', 3),
    difficulty: 3,
    map: {
      style: 'patrol',
      playerSpawn: { x: 110, y: 270 },
      obstacles: [
        { x: 300, y: 135, width: 110, height: 44 },
        { x: 300, y: 405, width: 110, height: 44 },
        { x: 500, y: 270, width: 80, height: 150 },
        { x: 660, y: 205, width: 92, height: 40 },
        { x: 660, y: 335, width: 92, height: 40 },
        { x: 850, y: 270, width: 42, height: 150 },
      ],
    },
    enemyTanks: [
      enemyTank('patrol_scout', 'scout', 665, 90, true),
      enemyTank('patrol_medium_alpha', 'medium', 800, 170, true),
      enemyTank('patrol_medium_bravo', 'medium', 800, 370, true),
      enemyTank('patrol_heavy', 'heavy', 665, 450, true),
    ],
  },
  {
    code: 'word-match-camp',
    titleKey: 'level.wordMatchCamp.title',
    subject: 'english',
    questionCodes: officialQuestionCodes('english', 1),
    difficulty: 1,
    map: {
      style: 'range',
      playerSpawn: { x: 120, y: 270 },
      obstacles: [
        { x: 420, y: 120, width: 130, height: 34 },
        { x: 520, y: 420, width: 160, height: 34 },
      ],
    },
    enemyTanks: [
      enemyTank('word_scout_alpha', 'scout', 730, 150),
      enemyTank('word_scout_bravo', 'scout', 780, 390),
    ],
  },
  {
    code: 'compass-trail',
    titleKey: 'level.compassTrail.title',
    subject: 'direction',
    questionCodes: officialQuestionCodes('direction', 1),
    difficulty: 1,
    map: {
      style: 'patrol',
      playerSpawn: { x: 120, y: 270 },
      obstacles: [
        { x: 380, y: 160, width: 52, height: 170 },
        { x: 580, y: 380, width: 180, height: 42 },
      ],
    },
    enemyTanks: [
      enemyTank('compass_scout', 'scout', 720, 130),
      enemyTank('compass_medium', 'medium', 790, 390),
    ],
  },
];

const questionSeeds = [
  {
    id: 'question_math_1',
    code: 'math-addition-1',
    subject: 'math',
    difficulty: 1,
    skillKey: 'addition-within-20',
    prompt: '8 + 7 = ?',
    promptZh: '8 + 7 = 多少？',
    correct: '15',
    choices: ['12', '15', '17'],
    choicesZh: ['12', '15', '17'],
    explanation: '8 + 7 = 15.',
    explanationZh: '8 加 7 等于 15。',
  },
  {
    id: 'question_math_2',
    code: 'math-addition-2',
    subject: 'math',
    difficulty: 1,
    skillKey: 'addition-within-20',
    prompt: '9 + 6 = ?',
    promptZh: '9 + 6 = 多少？',
    correct: '15',
    choices: ['14', '15', '16'],
    choicesZh: ['14', '15', '16'],
    explanation: '9 + 6 = 15.',
    explanationZh: '9 加 6 等于 15。',
  },
  {
    id: 'question_math_3',
    code: 'math-subtraction-1',
    subject: 'math',
    difficulty: 2,
    skillKey: 'subtraction-within-20',
    prompt: '13 - 5 = ?',
    promptZh: '13 - 5 = 多少？',
    correct: '8',
    choices: ['7', '8', '9'],
    choicesZh: ['7', '8', '9'],
    explanation: '13 - 5 = 8.',
    explanationZh: '13 减 5 等于 8。',
  },
  {
    id: 'question_english_1',
    code: 'english-kitten',
    subject: 'english',
    difficulty: 1,
    skillKey: 'basic-word-meaning',
    prompt: 'Which word means a young cat?',
    promptZh: '哪个英文单词表示“小猫”？',
    correct: 'kitten',
    choices: ['kitten', 'river', 'chair'],
    choicesZh: ['kitten（小猫）', 'river（河流）', 'chair（椅子）'],
    explanation: 'A kitten is a young cat.',
    explanationZh: 'kitten 指年幼的猫，也就是小猫。',
  },
  {
    id: 'question_english_2',
    code: 'english-quick',
    subject: 'english',
    difficulty: 1,
    skillKey: 'basic-word-meaning',
    prompt: 'Which word means fast?',
    promptZh: '哪个英文单词表示“快速的”？',
    correct: 'quick',
    choices: ['quiet', 'round', 'quick'],
    choicesZh: ['quiet（安静的）', 'round（圆的）', 'quick（快速的）'],
    explanation: 'Quick means fast.',
    explanationZh: 'quick 的意思是“快速的”。',
  },
  {
    id: 'question_english_3',
    code: 'english-library',
    subject: 'english',
    difficulty: 1,
    skillKey: 'basic-word-meaning',
    prompt: 'Where can you borrow books?',
    promptZh: '你可以在哪里借书？',
    correct: 'library',
    choices: ['garden', 'library', 'kitchen'],
    choicesZh: ['garden（花园）', 'library（图书馆）', 'kitchen（厨房）'],
    explanation: 'A library is a place where you can borrow books.',
    explanationZh: 'library 是图书馆，可以在那里借书。',
  },
  {
    id: 'question_direction_1',
    code: 'direction-left-turn',
    subject: 'direction',
    difficulty: 1,
    skillKey: 'cardinal-directions',
    prompt: 'You face north and turn left. Which direction do you face?',
    promptZh: '你面朝北方，然后向左转。现在面朝哪个方向？',
    correct: 'West',
    choices: ['East', 'South', 'West'],
    choicesZh: ['东', '南', '西'],
    explanation: 'Turning left from north points west.',
    explanationZh: '面朝北方时向左转，会面朝西方。',
  },
  {
    id: 'question_direction_2',
    code: 'direction-opposite',
    subject: 'direction',
    difficulty: 1,
    skillKey: 'cardinal-directions',
    prompt: 'Which direction is opposite east?',
    promptZh: '哪个方向与东方相反？',
    correct: 'West',
    choices: ['North', 'West', 'South'],
    choicesZh: ['北', '西', '南'],
    explanation: 'West is opposite east.',
    explanationZh: '西方与东方相反。',
  },
  {
    id: 'question_direction_3',
    code: 'direction-right',
    subject: 'direction',
    difficulty: 1,
    skillKey: 'left-and-right',
    prompt: 'The supply crate is on your right. Which way should you turn?',
    promptZh: '补给箱在你的右边。你应该向哪边转？',
    correct: 'Right',
    choices: ['Left', 'Right', 'Straight'],
    choicesZh: ['左转', '右转', '直行'],
    explanation: 'Turn right to move toward an object on your right.',
    explanationZh: '目标在右边时，应该向右转。',
  },
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
    update: {
      maxDifficulty: 3,
      allowedSubjects: ['math', 'english', 'direction'],
    },
    create: {
      childId: child.id,
      maxDifficulty: 3,
      allowedSubjects: ['math', 'english', 'direction'],
    },
  });

  for (const item of tankSeeds) {
    const tank = await prisma.tank.upsert({
      where: { code: item.code },
      update: {
        nameKey: item.nameKey,
        role: item.role,
        isActive: true,
        stats: { upsert: { update: item.stats, create: item.stats } },
      },
      create: {
        id: item.id,
        code: item.code,
        nameKey: item.nameKey,
        role: item.role,
        stats: { create: item.stats },
      },
    });

    const childTank = await prisma.childTank.upsert({
      where: { childId_tankId: { childId: child.id, tankId: tank.id } },
      update: {},
      create: { childId: child.id, tankId: tank.id },
    });

    for (const [index, skinSeed] of item.skins.entries()) {
      const [code, nameKey, primaryColor, secondaryColor] = skinSeed;
      const skin = await prisma.tankSkin.upsert({
        where: { tankId_code: { tankId: tank.id, code } },
        update: {
          nameKey,
          primaryColor,
          secondaryColor,
          isDefault: index === 0,
          isActive: true,
        },
        create: {
          id: `skin_${item.code.replaceAll('-', '_')}_${code.replaceAll('-', '_')}`,
          tankId: tank.id,
          code,
          nameKey,
          primaryColor,
          secondaryColor,
          isDefault: index === 0,
        },
      });
      await prisma.childTankSkin.upsert({
        where: {
          childTankId_skinId: { childTankId: childTank.id, skinId: skin.id },
        },
        update: {},
        create: { childTankId: childTank.id, skinId: skin.id },
      });
      if (index === 0 && !childTank.selectedSkinId) {
        await prisma.childTank.update({
          where: { id: childTank.id },
          data: { selectedSkinId: skin.id },
        });
      }
    }
  }

  const questions = new Map<string, string>();
  for (const item of questionSeeds) {
    const question = await prisma.question.upsert({
      where: { id: item.id },
      update: {
        subject: item.subject,
        mode: 'child_learning',
        difficulty: item.difficulty,
        skillKey: item.skillKey,
        prompt: item.prompt,
        explanation: item.explanation,
        status: 'published',
        translations: {
          upsert: [
            {
              where: {
                questionId_locale: { questionId: item.id, locale: 'en' },
              },
              update: { prompt: item.prompt, explanation: item.explanation },
              create: {
                locale: 'en',
                prompt: item.prompt,
                explanation: item.explanation,
              },
            },
            {
              where: {
                questionId_locale: { questionId: item.id, locale: 'zh-CN' },
              },
              update: {
                prompt: item.promptZh,
                explanation: item.explanationZh,
              },
              create: {
                locale: 'zh-CN',
                prompt: item.promptZh,
                explanation: item.explanationZh,
              },
            },
          ],
        },
      },
      create: {
        id: item.id,
        subject: item.subject,
        mode: 'child_learning',
        difficulty: item.difficulty,
        skillKey: item.skillKey,
        prompt: item.prompt,
        explanation: item.explanation,
        status: 'published',
        translations: {
          create: [
            {
              locale: 'en',
              prompt: item.prompt,
              explanation: item.explanation,
            },
            {
              locale: 'zh-CN',
              prompt: item.promptZh,
              explanation: item.explanationZh,
            },
          ],
        },
      },
    });
    for (const [choiceIndex, choice] of item.choices.entries()) {
      const answerId = `${item.id}_answer_${choiceIndex + 1}`;
      const translatedChoice = item.choicesZh[choiceIndex] ?? choice;
      await prisma.questionAnswer.upsert({
        where: { id: answerId },
        update: {
          text: choice,
          isCorrect: choice === item.correct,
          sortOrder: choiceIndex,
          translations: {
            upsert: [
              {
                where: { answerId_locale: { answerId, locale: 'en' } },
                update: { text: choice },
                create: { locale: 'en', text: choice },
              },
              {
                where: { answerId_locale: { answerId, locale: 'zh-CN' } },
                update: { text: translatedChoice },
                create: {
                  locale: 'zh-CN',
                  text: translatedChoice,
                },
              },
            ],
          },
        },
        create: {
          id: answerId,
          questionId: question.id,
          text: choice,
          isCorrect: choice === item.correct,
          sortOrder: choiceIndex,
          translations: {
            create: [
              { locale: 'en', text: choice },
              { locale: 'zh-CN', text: translatedChoice },
            ],
          },
        },
      });
    }
    questions.set(item.code, question.id);
  }

  validateOfficialQuestions(officialQuestionSeeds);
  for (const item of officialQuestionSeeds) {
    const question = await prisma.question.upsert({
      where: { id: item.id },
      update: {
        subject: item.subject,
        mode: 'child_learning',
        difficulty: item.difficulty,
        skillKey: item.skillKey,
        prompt: item.prompt.en,
        explanation: item.explanation.en,
        status: 'published',
        translations: {
          upsert: [
            {
              where: {
                questionId_locale: { questionId: item.id, locale: 'en' },
              },
              update: {
                prompt: item.prompt.en,
                explanation: item.explanation.en,
              },
              create: {
                locale: 'en',
                prompt: item.prompt.en,
                explanation: item.explanation.en,
              },
            },
            {
              where: {
                questionId_locale: { questionId: item.id, locale: 'zh-CN' },
              },
              update: {
                prompt: item.prompt['zh-CN'],
                explanation: item.explanation['zh-CN'],
              },
              create: {
                locale: 'zh-CN',
                prompt: item.prompt['zh-CN'],
                explanation: item.explanation['zh-CN'],
              },
            },
          ],
        },
      },
      create: {
        id: item.id,
        subject: item.subject,
        mode: 'child_learning',
        difficulty: item.difficulty,
        skillKey: item.skillKey,
        prompt: item.prompt.en,
        explanation: item.explanation.en,
        status: 'published',
        translations: {
          create: [
            {
              locale: 'en',
              prompt: item.prompt.en,
              explanation: item.explanation.en,
            },
            {
              locale: 'zh-CN',
              prompt: item.prompt['zh-CN'],
              explanation: item.explanation['zh-CN'],
            },
          ],
        },
      },
    });

    for (const [choiceIndex, choice] of item.choices.entries()) {
      const answerId = `${item.id}_answer_${choiceIndex + 1}`;
      const isCorrect = choiceIndex === item.correctIndex;
      await prisma.questionAnswer.upsert({
        where: { id: answerId },
        update: {
          text: choice.en,
          isCorrect,
          sortOrder: choiceIndex,
          translations: {
            upsert: [
              {
                where: { answerId_locale: { answerId, locale: 'en' } },
                update: { text: choice.en },
                create: { locale: 'en', text: choice.en },
              },
              {
                where: { answerId_locale: { answerId, locale: 'zh-CN' } },
                update: { text: choice['zh-CN'] },
                create: { locale: 'zh-CN', text: choice['zh-CN'] },
              },
            ],
          },
        },
        create: {
          id: answerId,
          questionId: question.id,
          text: choice.en,
          isCorrect,
          sortOrder: choiceIndex,
          translations: {
            create: [
              { locale: 'en', text: choice.en },
              { locale: 'zh-CN', text: choice['zh-CN'] },
            ],
          },
        },
      });
    }
    questions.set(item.code, question.id);
  }

  for (const asset of assetCatalog) {
    await prisma.asset.upsert({
      where: { id: asset.id },
      update: {
        type: asset.type,
        version: asset.version,
        url: asset.url,
        sha256: asset.sha256,
        sizeBytes: asset.sizeBytes,
        tags: asset.tags,
        previewUrl: asset.preview,
        dependencies: asset.dependencies,
        status: 'published',
      },
      create: {
        id: asset.id,
        type: asset.type,
        version: asset.version,
        url: asset.url,
        sha256: asset.sha256,
        sizeBytes: asset.sizeBytes,
        tags: asset.tags,
        previewUrl: asset.preview,
        dependencies: asset.dependencies,
        status: 'published',
      },
    });
  }

  for (const item of levelSeeds) {
    const configJson = {
      theme: 'training-base',
      enemyTanks: item.enemyTanks,
      map: item.map,
      objectives: ['answer_questions', 'defeat_training_tanks'],
    };
    const level = await prisma.level.upsert({
      where: { code: item.code },
      update: {
        titleKey: item.titleKey,
        mode: 'child_learning',
        subjectFocus: item.subject,
        baseDifficulty: item.difficulty,
        configJson,
        status: 'published',
        version: 2,
        questions: {
          deleteMany: {},
          create: item.questionCodes.map((code) => ({
            questionId: getQuestionId(questions, code),
          })),
        },
      },
      create: {
        id: `level_${item.code.replaceAll('-', '_')}`,
        code: item.code,
        titleKey: item.titleKey,
        mode: 'child_learning',
        subjectFocus: item.subject,
        baseDifficulty: item.difficulty,
        status: 'published',
        configJson,
        questions: {
          create: item.questionCodes.map((code) => ({
            questionId: getQuestionId(questions, code),
          })),
        },
      },
    });
    await prisma.levelAsset.upsert({
      where: {
        levelId_assetId: {
          levelId: level.id,
          assetId: 'asset_training_grounds_v1',
        },
      },
      update: { sortOrder: 0 },
      create: {
        levelId: level.id,
        assetId: 'asset_training_grounds_v1',
        sortOrder: 0,
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
