export type OfficialSubject = 'math' | 'english' | 'direction';
export type OfficialDifficulty = 1 | 2 | 3 | 4;

export interface LocalizedText {
  en: string;
  'zh-CN': string;
}

export interface OfficialQuestionSeed {
  id: string;
  code: string;
  subject: OfficialSubject;
  difficulty: OfficialDifficulty;
  skillKey: string;
  prompt: LocalizedText;
  choices: LocalizedText[];
  correctIndex: number;
  explanation: LocalizedText;
}

function seed(
  subject: OfficialSubject,
  difficulty: OfficialDifficulty,
  index: number,
  skillKey: string,
  prompt: LocalizedText,
  choices: LocalizedText[],
  correctIndex: number,
  explanation: LocalizedText
): OfficialQuestionSeed {
  const sequence = String(index + 1).padStart(2, '0');
  return {
    id: `question_official_${subject}_d${difficulty}_${sequence}`,
    code: `official-${subject}-d${difficulty}-${sequence}`,
    subject,
    difficulty,
    skillKey,
    prompt,
    choices,
    correctIndex,
    explanation,
  };
}

function numericChoices(
  correct: number,
  index: number
): {
  choices: LocalizedText[];
  correctIndex: number;
} {
  const values = [Math.max(0, correct - 2), correct, correct + 3];
  const shift = index % values.length;
  const rotated = [...values.slice(shift), ...values.slice(0, shift)];
  return {
    choices: rotated.map((value) => ({
      en: String(value),
      'zh-CN': String(value),
    })),
    correctIndex: rotated.indexOf(correct),
  };
}

function mathQuestions(): OfficialQuestionSeed[] {
  const questions: OfficialQuestionSeed[] = [];
  for (let index = 0; index < 10; index += 1) {
    const addition = index < 5;
    const left = addition ? 6 + index : 14 + index;
    const right = addition ? 3 + (index % 4) : 4 + (index % 3);
    const correct = addition ? left + right : left - right;
    const answer = numericChoices(correct, index);
    questions.push(
      seed(
        'math',
        1,
        index,
        addition ? 'addition-within-20' : 'subtraction-within-20',
        {
          en: `${left} ${addition ? '+' : '-'} ${right} = ?`,
          'zh-CN': `${left} ${addition ? '+' : '-'} ${right} 等于多少？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `${left} ${addition ? 'plus' : 'minus'} ${right} equals ${correct}.`,
          'zh-CN': `${left} ${addition ? '加' : '减'} ${right} 等于 ${correct}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const addition = index % 2 === 0;
    const left = addition ? 28 + index * 3 : 62 + index * 2;
    const right = 11 + index;
    const correct = addition ? left + right : left - right;
    const answer = numericChoices(correct, index + 1);
    questions.push(
      seed(
        'math',
        2,
        index,
        addition ? 'addition-within-100' : 'subtraction-within-100',
        {
          en: `${left} ${addition ? '+' : '-'} ${right} = ?`,
          'zh-CN': `${left} ${addition ? '+' : '-'} ${right} 等于多少？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `${left} ${addition ? 'plus' : 'minus'} ${right} equals ${correct}.`,
          'zh-CN': `${left} ${addition ? '加' : '减'} ${right} 等于 ${correct}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const division = index >= 5;
    const factor = 2 + (index % 5);
    const other = 3 + (index % 4);
    const left = division ? factor * other : factor;
    const right = division ? factor : other;
    const correct = division ? other : factor * other;
    const answer = numericChoices(correct, index + 2);
    questions.push(
      seed(
        'math',
        3,
        index,
        division ? 'division-facts' : 'multiplication-facts',
        {
          en: `${left} ${division ? '÷' : '×'} ${right} = ?`,
          'zh-CN': `${left} ${division ? '÷' : '×'} ${right} 等于多少？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `${left} ${division ? 'divided by' : 'times'} ${right} equals ${correct}.`,
          'zh-CN': `${left} ${division ? '除以' : '乘以'} ${right} 等于 ${correct}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const start = 8 + index;
    const multiplier = 2 + (index % 3);
    const subtract = 3 + (index % 4);
    const correct = start * multiplier - subtract;
    const answer = numericChoices(correct, index);
    questions.push(
      seed(
        'math',
        4,
        index,
        index < 5 ? 'two-step-arithmetic' : 'operation-order',
        {
          en: `Calculate ${start} × ${multiplier} - ${subtract}.`,
          'zh-CN': `计算 ${start} × ${multiplier} - ${subtract}。`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `Multiply first: ${start} × ${multiplier} = ${start * multiplier}; then subtract ${subtract} to get ${correct}.`,
          'zh-CN': `先算乘法：${start} × ${multiplier} = ${start * multiplier}；再减去 ${subtract}，得到 ${correct}。`,
        }
      )
    );
  }
  return questions;
}

const vocabulary = [
  ['brave', 'ready to face danger', '勇敢的', '敢于面对危险'],
  ['tiny', 'very small', '极小的', '非常小'],
  ['rapid', 'very fast', '迅速的', '非常快'],
  ['silent', 'making no sound', '安静的', '没有声音'],
  ['protect', 'keep safe', '保护', '使其安全'],
  ['observe', 'watch carefully', '观察', '仔细观看'],
  ['repair', 'fix something', '修理', '把东西修好'],
  ['collect', 'bring things together', '收集', '把东西聚到一起'],
  ['distant', 'far away', '遥远的', '距离很远'],
  ['narrow', 'not wide', '狭窄的', '不宽'],
] as const;

const sentenceCompletions = [
  ['The tanks ___ ready.', 'are', '坦克已经准备好了。', ['is', 'are', 'am']],
  ['Mia ___ a map.', 'has', '米娅有一张地图。', ['have', 'has', 'having']],
  [
    'We ___ the bridge yesterday.',
    'crossed',
    '我们昨天穿过了桥。',
    ['cross', 'crossed', 'crossing'],
  ],
  [
    'The scout moves ___.',
    'quietly',
    '侦察车安静地移动。',
    ['quiet', 'quietly', 'quieter'],
  ],
  [
    'There ___ two supply crates.',
    'are',
    '那里有两个补给箱。',
    ['is', 'are', 'be'],
  ],
  [
    'Leo can ___ the signal.',
    'see',
    '利奥能看到信号。',
    ['sees', 'saw', 'see'],
  ],
  [
    'The road is ___ than the trail.',
    'wider',
    '这条路比小径更宽。',
    ['wide', 'wider', 'widest'],
  ],
  [
    'She ___ not miss the target.',
    'does',
    '她没有错过目标。',
    ['do', 'does', 'doing'],
  ],
  [
    'They will ___ at noon.',
    'arrive',
    '他们将在中午到达。',
    ['arrive', 'arrived', 'arrives'],
  ],
  [
    'The engine runs ___.',
    'smoothly',
    '发动机运转平稳。',
    ['smooth', 'smoothly', 'smoother'],
  ],
] as const;

const readingFacts = [
  [
    'Nora packed a coat because snow was falling.',
    'Why did Nora pack a coat?',
    'Because it was snowing',
    '诺拉带了一件外套，因为正在下雪。',
    '诺拉为什么带外套？',
    '因为正在下雪',
  ],
  [
    'The bridge was closed, so Amir chose the forest path.',
    'Why did Amir use the forest path?',
    'The bridge was closed',
    '桥关闭了，所以阿米尔选择了森林小路。',
    '阿米尔为什么走森林小路？',
    '因为桥关闭了',
  ],
  [
    'A green light flashed after the code was correct.',
    'What made the green light flash?',
    'The correct code',
    '密码正确后，绿灯闪烁。',
    '什么让绿灯闪烁？',
    '正确的密码',
  ],
  [
    'Lena slowed down when the road became icy.',
    'Why did Lena slow down?',
    'The road was icy',
    '道路结冰时，莉娜减速了。',
    '莉娜为什么减速？',
    '因为道路结冰',
  ],
  [
    'The team filled their bottles before crossing the desert.',
    'What did the team prepare?',
    'Water',
    '队伍在穿越沙漠前装满了水瓶。',
    '队伍准备了什么？',
    '水',
  ],
  [
    'Kai heard thunder and moved inside.',
    'Why did Kai move inside?',
    'A storm was near',
    '凯听到雷声后走进室内。',
    '凯为什么走进室内？',
    '因为暴风雨临近',
  ],
  [
    'The flag on the tower showed the meeting point.',
    'What did the flag mark?',
    'The meeting point',
    '塔上的旗帜标出了集合点。',
    '旗帜标出了什么？',
    '集合点',
  ],
  [
    'The mechanic replaced the flat tire.',
    'What problem was fixed?',
    'A flat tire',
    '机械师更换了没气的轮胎。',
    '修好了什么问题？',
    '轮胎没气',
  ],
  [
    'Jin used binoculars to see the far hill.',
    'Why did Jin use binoculars?',
    'To see far away',
    '金用望远镜观察远处的山丘。',
    '金为什么用望远镜？',
    '为了看清远处',
  ],
  [
    'The team whispered so the guard would not hear them.',
    'Why did the team whisper?',
    'To stay unheard',
    '队伍小声说话，以免守卫听见。',
    '队伍为什么小声说话？',
    '为了不被听见',
  ],
] as const;

const connectors = [
  [
    'The path was muddy, ___ we moved slowly.',
    'so',
    '小路泥泞，所以我们走得很慢。',
    ['but', 'so', 'or'],
  ],
  [
    'We can take the bridge ___ the tunnel.',
    'or',
    '我们可以走桥或者隧道。',
    ['because', 'or', 'although'],
  ],
  [
    'The scout waited ___ the signal appeared.',
    'until',
    '侦察员一直等到信号出现。',
    ['until', 'unless', 'than'],
  ],
  [
    '___ it was cold, the engine started.',
    'Although',
    '虽然天气寒冷，发动机还是启动了。',
    ['Because', 'Although', 'So'],
  ],
  [
    'Take a map ___ you do not get lost.',
    'so that',
    '带上地图，这样你就不会迷路。',
    ['so that', 'but', 'after'],
  ],
  [
    'The gate opened ___ the key was inserted.',
    'after',
    '钥匙插入后，大门打开了。',
    ['before', 'after', 'unless'],
  ],
  [
    'We stayed hidden ___ the patrol passed.',
    'while',
    '巡逻队经过时，我们保持隐蔽。',
    ['while', 'because of', 'than'],
  ],
  [
    'The route is short ___ steep.',
    'but',
    '这条路线很短，但是很陡。',
    ['and then', 'but', 'because'],
  ],
  [
    'Check the fuel ___ you leave.',
    'before',
    '离开前检查燃料。',
    ['before', 'until', 'so'],
  ],
  [
    'The radio worked ___ the battery was new.',
    'because',
    '因为电池是新的，所以无线电能工作。',
    ['or', 'because', 'although'],
  ],
] as const;

function localizedChoices(
  correctEn: string,
  correctZh: string,
  index: number,
  distractors: [LocalizedText, LocalizedText]
) {
  const values: LocalizedText[] = [
    distractors[0],
    { en: correctEn, 'zh-CN': correctZh },
    distractors[1],
  ];
  const shift = index % 3;
  const choices = [...values.slice(shift), ...values.slice(0, shift)];
  return {
    choices,
    correctIndex: choices.findIndex((choice) => choice.en === correctEn),
  };
}

function englishQuestions(): OfficialQuestionSeed[] {
  const questions: OfficialQuestionSeed[] = vocabulary.map((item, index) => {
    const otherA = vocabulary[(index + 3) % vocabulary.length] ?? vocabulary[0];
    const otherB = vocabulary[(index + 6) % vocabulary.length] ?? vocabulary[1];
    const answer = localizedChoices(item[1], item[3], index, [
      { en: otherA[1], 'zh-CN': otherA[3] },
      { en: otherB[1], 'zh-CN': otherB[3] },
    ]);
    return seed(
      'english',
      1,
      index,
      index < 5 ? 'word-meaning' : 'context-vocabulary',
      {
        en: `What does “${item[0]}” mean?`,
        'zh-CN': `“${item[0]}”是什么意思？`,
      },
      answer.choices,
      answer.correctIndex,
      {
        en: `“${item[0]}” means “${item[1]}.”`,
        'zh-CN': `“${item[0]}”的意思是“${item[3]}”。`,
      }
    );
  });

  questions.push(
    ...sentenceCompletions.map((item, index) => {
      const choices = item[3].map((choice) => ({
        en: choice,
        'zh-CN': choice,
      }));
      return seed(
        'english',
        2,
        index,
        index < 5 ? 'subject-verb-agreement' : 'word-form',
        {
          en: `Choose the best word: ${item[0]}`,
          'zh-CN': `选择最合适的词：${item[2]}`,
        },
        choices,
        item[3].findIndex((choice) => choice === item[1]),
        {
          en: `“${item[1]}” completes the sentence correctly.`,
          'zh-CN': `“${item[1]}”能正确补全这个句子。`,
        }
      );
    })
  );

  questions.push(
    ...readingFacts.map((item, index) => {
      const answer = localizedChoices(item[2], item[5], index, [
        { en: 'It was a random choice', 'zh-CN': '这是随机选择' },
        { en: 'The passage does not say', 'zh-CN': '短文没有说明' },
      ]);
      return seed(
        'english',
        3,
        index,
        index < 5 ? 'reading-detail' : 'reading-inference',
        { en: `${item[0]} ${item[1]}`, 'zh-CN': `${item[3]} ${item[4]}` },
        answer.choices,
        answer.correctIndex,
        {
          en: `The passage shows: ${item[2]}.`,
          'zh-CN': `短文表明：${item[5]}。`,
        }
      );
    })
  );

  questions.push(
    ...connectors.map((item, index) => {
      const choices = item[3].map((choice) => ({
        en: choice,
        'zh-CN': choice,
      }));
      return seed(
        'english',
        4,
        index,
        index < 5 ? 'logical-connectors' : 'complex-sentences',
        {
          en: `Choose the connector: ${item[0]}`,
          'zh-CN': `选择连接词：${item[2]}`,
        },
        choices,
        item[3].findIndex((choice) => choice === item[1]),
        {
          en: `“${item[1]}” expresses the correct relationship between the ideas.`,
          'zh-CN': `“${item[1]}”正确表达了句子之间的关系。`,
        }
      );
    })
  );
  return questions;
}

const directions = ['north', 'east', 'south', 'west'] as const;
const directionZh = {
  north: '北',
  east: '东',
  south: '南',
  west: '西',
} as const;

function turn(from: number, steps: number) {
  return (
    directions[(from + steps + directions.length) % directions.length] ??
    'north'
  );
}

function directionAnswer(correct: (typeof directions)[number], index: number) {
  const correctPosition = directions.indexOf(correct);
  const wrongA = turn(correctPosition, 1);
  const wrongB = turn(correctPosition, 2);
  return localizedChoices(correct, directionZh[correct], index, [
    { en: wrongA, 'zh-CN': directionZh[wrongA] },
    { en: wrongB, 'zh-CN': directionZh[wrongB] },
  ]);
}

function directionQuestions(): OfficialQuestionSeed[] {
  const questions: OfficialQuestionSeed[] = [];
  for (let index = 0; index < 10; index += 1) {
    const fromIndex = index % 4;
    const right = index % 2 === 0;
    const from = directions[fromIndex] ?? 'north';
    const correct = turn(fromIndex, right ? 1 : -1);
    const answer = directionAnswer(correct, index);
    questions.push(
      seed(
        'direction',
        1,
        index,
        index < 4 ? 'cardinal-directions' : 'left-and-right',
        {
          en: `Face ${from}, then turn ${right ? 'right' : 'left'}. Which direction now?`,
          'zh-CN': `面朝${directionZh[from]}，然后${right ? '右' : '左'}转。现在面朝哪里？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `Turning ${right ? 'right' : 'left'} from ${from} points ${correct}.`,
          'zh-CN': `面朝${directionZh[from]}时${right ? '右' : '左'}转，会面朝${directionZh[correct]}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const fromIndex = (index + 1) % 4;
    const turns = index % 3 === 0 ? 2 : index % 2 === 0 ? 1 : -1;
    const from = directions[fromIndex] ?? 'north';
    const correct = turn(fromIndex, turns);
    const actionEn =
      turns === 2 ? 'turn around' : `turn ${turns === 1 ? 'right' : 'left'}`;
    const actionZh = turns === 2 ? '掉头' : `${turns === 1 ? '右' : '左'}转`;
    const answer = directionAnswer(correct, index + 1);
    questions.push(
      seed(
        'direction',
        2,
        index,
        index < 5 ? 'relative-turns' : 'orientation-changes',
        {
          en: `You face ${from}. ${actionEn}. Where do you face?`,
          'zh-CN': `你面朝${directionZh[from]}。${actionZh}后面朝哪里？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `After you ${actionEn}, you face ${correct}.`,
          'zh-CN': `${actionZh}后，你会面朝${directionZh[correct]}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const horizontal = index % 2 === 0;
    const amount = 2 + (index % 4);
    const positive = index % 3 !== 0;
    const correct = horizontal
      ? positive
        ? 'east'
        : 'west'
      : positive
        ? 'north'
        : 'south';
    const answer = directionAnswer(correct, index + 2);
    questions.push(
      seed(
        'direction',
        3,
        index,
        index < 5 ? 'coordinate-movement' : 'map-axis-reading',
        {
          en: `From the start, move ${amount} squares ${horizontal ? (positive ? 'right' : 'left') : positive ? 'up' : 'down'}. Which cardinal direction did you travel?`,
          'zh-CN': `从起点出发，向${horizontal ? (positive ? '右' : '左') : positive ? '上' : '下'}移动 ${amount} 格。你沿哪个基本方向前进？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `${horizontal ? (positive ? 'Right' : 'Left') : positive ? 'Up' : 'Down'} on the map is ${correct}.`,
          'zh-CN': `地图上的${horizontal ? (positive ? '右' : '左') : positive ? '上' : '下'}对应${directionZh[correct]}。`,
        }
      )
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const startIndex = index % 4;
    const firstTurn = index % 2 === 0 ? 1 : -1;
    const secondTurn = index % 3 === 0 ? 1 : 0;
    const start = directions[startIndex] ?? 'north';
    const correct = turn(startIndex, firstTurn + secondTurn);
    const answer = directionAnswer(correct, index);
    questions.push(
      seed(
        'direction',
        4,
        index,
        index < 5 ? 'multi-step-routing' : 'route-planning',
        {
          en: `Face ${start}. Turn ${firstTurn === 1 ? 'right' : 'left'}, move forward, then ${secondTurn === 1 ? 'turn right' : 'continue straight'}. What is your final heading?`,
          'zh-CN': `面朝${directionZh[start]}。先${firstTurn === 1 ? '右' : '左'}转并前进，然后${secondTurn === 1 ? '右转' : '直行'}。最终面朝哪里？`,
        },
        answer.choices,
        answer.correctIndex,
        {
          en: `Following both route instructions leaves you facing ${correct}.`,
          'zh-CN': `按顺序执行两步路线指令后，你会面朝${directionZh[correct]}。`,
        }
      )
    );
  }
  return questions;
}

export const officialQuestionSeeds: OfficialQuestionSeed[] = [
  ...mathQuestions(),
  ...englishQuestions(),
  ...directionQuestions(),
];

export function validateOfficialQuestions(questions: OfficialQuestionSeed[]) {
  if (questions.length !== 120) {
    throw new Error(
      `Official content must contain 120 questions; received ${questions.length}`
    );
  }
  const ids = new Set<string>();
  const codes = new Set<string>();
  const bucketCounts = new Map<string, number>();
  for (const question of questions) {
    if (ids.has(question.id) || codes.has(question.code)) {
      throw new Error(`Duplicate official question identity: ${question.id}`);
    }
    ids.add(question.id);
    codes.add(question.code);
    const bucket = `${question.subject}:${question.difficulty}`;
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    if (
      !question.prompt.en.trim() ||
      !question.prompt['zh-CN'].trim() ||
      !question.explanation.en.trim() ||
      !question.explanation['zh-CN'].trim()
    ) {
      throw new Error(`Missing localized content: ${question.id}`);
    }
    if (
      question.choices.length !== 3 ||
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.choices.length
    ) {
      throw new Error(`Invalid answer definition: ${question.id}`);
    }
    for (const locale of ['en', 'zh-CN'] as const) {
      const values = question.choices.map((choice) => choice[locale].trim());
      if (
        values.some((value) => !value) ||
        new Set(values).size !== values.length
      ) {
        throw new Error(
          `Choices must be localized and unique: ${question.id}:${locale}`
        );
      }
    }
  }
  for (const subject of ['math', 'english', 'direction'] as const) {
    for (const difficulty of [1, 2, 3, 4] as const) {
      const bucket = `${subject}:${difficulty}`;
      if (bucketCounts.get(bucket) !== 10) {
        throw new Error(
          `Official content bucket ${bucket} must contain 10 questions`
        );
      }
    }
  }
}

validateOfficialQuestions(officialQuestionSeeds);
