import type {
  ApiResponse,
  EnemyTankConfigDto,
  LevelDto,
  OwnedTankDto,
  StartSessionResponse,
} from '@tankquest/shared';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const correctAnswers: Record<string, string> = {
  '8 + 7 = ?': '15',
  '9 + 6 = ?': '15',
  '13 - 5 = ?': '8',
  'Which word means a young cat?': 'kitten',
  'Which word means fast?': 'quick',
  'Where can you borrow books?': 'library',
  'You face north and turn left. Which direction do you face?': 'West',
  'Which direction is opposite east?': 'West',
  'The supply crate is on your right. Which way should you turn?': 'Right',
};

test('completes the authoritative learning and upgrade journey', async ({
  page,
  request,
}) => {
  const health = await request.get('http://127.0.0.1:3000/api/health');
  expect(health.ok()).toBe(true);
  expect(health.headers()['x-content-type-options']).toBe('nosniff');

  const invalidStart = await request.post(
    'http://127.0.0.1:3000/api/game-sessions',
    { data: {} }
  );
  expect(invalidStart.status()).toBe(400);
  await expect(invalidStart.json()).resolves.toMatchObject({
    data: null,
    error: { code: 'HTTP_400' },
    requestId: expect.stringMatching(/^req_/),
  });

  for (const resource of ['levels', 'tanks']) {
    const catalog = await request.get(`http://127.0.0.1:3000/api/${resource}`);
    expect(catalog.ok(), `${resource} catalog: ${await catalog.text()}`).toBe(
      true
    );
  }

  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  const startButton = page.getByRole('button', { name: 'Start training' });
  await expect(startButton)
    .toBeVisible({ timeout: 10_000 })
    .catch(async (error: unknown) => {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nPage content: ${await page.locator('body').innerText()}`
      );
    });
  await expect(page.getByText('Range map · 2 scouts')).toBeVisible();
  await startButton.click();
  await expect(page.locator('.mission-status')).toContainText(
    /Addition range · Firepower [3-5]/
  );
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  await expect(page.getByText('150/150')).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    const prompt = await page.locator('.learning-console h2').textContent();
    const answer = prompt ? correctAnswers[prompt] : undefined;
    expect(answer, `known seed answer for ${prompt}`).toBeTruthy();
    await page.getByRole('button', { name: answer, exact: true }).click();
    await expect(page.locator('.feedback strong')).toHaveText(
      'Supply secured!'
    );
    await page
      .getByRole('button', {
        name: index === 2 ? 'Return to battle' : 'Next challenge',
      })
      .click();
  }

  const progressResponse = await request.get(
    'http://127.0.0.1:3000/api/children/child_demo/progress'
  );
  expect(progressResponse.ok()).toBe(true);
  await expect(progressResponse.json()).resolves.toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({
        subject: 'math',
        skillKey: 'addition-within-20',
        correctCount: expect.any(Number),
        accuracy: expect.any(Number),
      }),
      expect.objectContaining({
        subject: 'math',
        skillKey: 'subtraction-within-20',
        averageAnswerTimeMs: expect.any(Number),
      }),
    ]),
  });

  await expect(
    page.getByRole('heading', { name: '2 training tanks remain' })
  ).toBeVisible();
  await fireAt(page, 720, 145, 4);
  await fireAt(page, 790, 390, 4);
  await expect(
    page.getByRole('heading', { name: 'Training field secured' })
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Complete mission' }).click();

  await expect(
    page.getByRole('heading', { name: 'Mission complete' })
  ).toBeVisible();
  await expect(page.getByText('3 cannon parts earned')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Replay mission' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Return to mission selection' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Spend 2 parts: upgrade firepower' })
    .click();
  await expect(
    page.getByText(/Upgrade complete: Firepower [4-5]\/5/)
  ).toBeVisible();
  await expect(
    page.getByText(/cannon parts remain/, { exact: false })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Use upgrade in another mission' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Choose a training mission' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /parent/i })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.locator('.mission-status')).toContainText(
    /Firepower [4-5]/
  );
  await page.goto('/parent');
  await expect(
    page.getByRole('heading', { name: '30-day learning report' })
  ).toBeVisible();
  await expect(page.getByText('Completed missions')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Math', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Learning coach summary' })
  ).toBeVisible();
  await expect(page.getByText('Practice content')).toBeVisible();
  await expect(page.getByText('Progress evidence')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Addition within 20', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Spend the next practice session on', { exact: false })
  ).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/report?locale=zh-CN')
    ),
    page.getByLabel('Language').selectOption('zh-CN'),
  ]);
  await expect(
    page.getByRole('heading', { name: '近 30 天学习报告' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '学习教练摘要' })
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('continues combat after repeated enemy projectile impacts', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/game-sessions', async (route) => {
    const response = await route.fetch();
    const payload =
      (await response.json()) as ApiResponse<StartSessionResponse>;
    const enemyTanks = payload.data?.level.config.enemyTanks;
    if (!payload.data || !Array.isArray(enemyTanks) || !enemyTanks[0]) {
      throw new Error('Expected a configured enemy tank in the session');
    }
    const closeEnemy = enemyTanks[0] as EnemyTankConfigDto;
    payload.data.level.config = {
      ...payload.data.level.config,
      enemyTanks: [
        {
          ...closeEnemy,
          stats: { ...closeEnemy.stats, firepower: 5 },
          x: 300,
          y: 270,
          ai: {
            ...closeEnemy.ai,
            attackRange: 500,
            detectionRange: 600,
            fireCooldownMs: 500,
            speedMultiplier: 0.1,
          },
        },
      ],
      map: {
        style: 'range',
        playerSpawn: { x: 120, y: 270 },
        obstacles: [],
      },
    };
    await route.fulfill({ response, json: payload });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start training' }).click();
  const hullIntegrity = page.locator('.hud dd').filter({ hasText: '/150' });
  await expect(hullIntegrity).not.toHaveText('150/150', { timeout: 5_000 });
  const healthAfterFirstImpact = await hullIntegrity.textContent();
  await expect
    .poll(() => hullIntegrity.textContent(), { timeout: 5_000 })
    .not.toBe(healthAfterFirstImpact);
  const impacts = await page.evaluate(() => {
    const target = globalThis as typeof globalThis & {
      __TANKQUEST_COMBAT_LOGS__?: Array<{
        event: string;
        details: Record<string, number | string>;
      }>;
    };
    return (target.__TANKQUEST_COMBAT_LOGS__ ?? [])
      .filter((entry) => entry.event === 'enemy_projectile_hit_player')
      .map((entry) => entry.details);
  });

  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  expect(impacts.length).toBeGreaterThanOrEqual(2);
  expect(impacts.every((impact) => impact.outcome === 'penetrated')).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('starts a mission with the selected owned tank', async ({ page }) => {
  await page.goto('/');
  const starShield = page.getByRole('button', { name: /Star Shield/ });
  const swiftFox = page.getByRole('button', { name: /Swift Fox/ });
  await expect(starShield).toBeVisible();
  await expect(swiftFox).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Iron Mountain/ })
  ).toBeVisible();
  await expect(
    starShield.locator('[data-tank-visual="star-shield"]')
  ).toBeVisible();
  await expect(
    swiftFox.locator('[data-tank-visual="swift-fox"]')
  ).toBeVisible();

  await swiftFox.click();
  const arcticSkin = page.getByRole('button', { name: 'Arctic Dash' });
  await expect(arcticSkin).toBeVisible();
  await arcticSkin.click();
  await expect(arcticSkin).toHaveAttribute('aria-pressed', 'true');
  await expect(swiftFox.locator('[fill="#85aebf"]')).not.toHaveCount(0);
  await expect(swiftFox.locator('[fill="#f2f7f8"]')).not.toHaveCount(0);
  const sessionRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/game-sessions') &&
      request.method() === 'POST'
  );
  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/game-sessions') &&
      response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Start training' }).click();

  expect((await sessionRequest).postDataJSON()).toMatchObject({
    tankId: 'tank_swift_fox',
  });
  await expect(
    sessionResponse.then((response) => response.json())
  ).resolves.toMatchObject({
    data: { tank: { skin: { code: 'arctic-dash' } } },
  });
  await expect(
    page.getByText(/Firepower 2 · Mobility 5 · Armor 1 · Stealth 4 · Vision 4/)
  ).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
});

test('persists language and theme preferences', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Choose a training mission' })
  ).toBeVisible();

  await page.getByLabel('Language').selectOption('zh-CN');
  await expect(
    page.getByRole('heading', { name: '选择训练任务' })
  ).toBeVisible();
  await page.getByLabel('主题').selectOption('snow-field');
  await expect
    .poll(() => page.locator('html').getAttribute('data-theme'))
    .toBe('snow-field');

  await page.reload();
  await expect(
    page.getByRole('heading', { name: '选择训练任务' })
  ).toBeVisible();
  await expect(page.getByLabel('语言')).toHaveValue('zh-CN');
  await expect(page.getByLabel('主题')).toHaveValue('snow-field');
  await page.getByRole('button', { name: '开始训练' }).click();
  const trainingGround = page.locator('.game-canvas');
  await expect(trainingGround).toHaveAttribute('data-render-mode', '2.5d');
  await expect(trainingGround).toHaveAttribute(
    'data-scene-theme',
    'snow-field'
  );

  await page.getByLabel('主题').selectOption('forest-camp');
  await expect
    .poll(() => page.locator('html').getAttribute('data-theme'))
    .toBe('forest-camp');
  await expect(trainingGround).toHaveAttribute(
    'data-scene-theme',
    'snow-field'
  );
});

test('completes English and direction missions through the shared API', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /Word match camp/ })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Compass trail/ })
  ).toBeVisible();

  await completeMission(request, 'word-match-camp');
  await completeMission(request, 'compass-trail');

  const progress = await request.get(
    'http://127.0.0.1:3000/api/children/child_demo/progress'
  );
  await expect(progress.json()).resolves.toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({
        subject: 'english',
        skillKey: 'basic-word-meaning',
        attempts: 3,
      }),
      expect.objectContaining({
        subject: 'direction',
        skillKey: 'cardinal-directions',
        attempts: 2,
      }),
      expect.objectContaining({
        subject: 'direction',
        skillKey: 'left-and-right',
        attempts: 1,
      }),
    ]),
  });
});

async function completeMission(request: APIRequestContext, levelCode: string) {
  const levelsPayload = (await (
    await request.get('http://127.0.0.1:3000/api/levels')
  ).json()) as ApiResponse<LevelDto[]>;
  const tanksPayload = (await (
    await request.get('http://127.0.0.1:3000/api/children/child_demo/tanks')
  ).json()) as ApiResponse<OwnedTankDto[]>;
  const level = levelsPayload.data?.find((item) => item.code === levelCode);
  const tank = tanksPayload.data?.[0];
  expect(level, `published level ${levelCode}`).toBeTruthy();
  expect(tank, 'owned tank').toBeTruthy();
  if (!level || !tank) return;

  const start = await request.post('http://127.0.0.1:3000/api/game-sessions', {
    data: { childId: 'child_demo', levelId: level.id, tankId: tank.id },
  });
  const started = (await start.json()) as ApiResponse<StartSessionResponse>;
  expect(start.ok(), JSON.stringify(started)).toBe(true);
  expect(started.data).not.toBeNull();
  if (!started.data) return;

  for (const question of started.data.questions) {
    const correctText = correctAnswers[question.prompt];
    const answer = question.choices.find(
      (choice) => choice.text === correctText
    );
    expect(answer, `known answer for ${question.prompt}`).toBeTruthy();
    if (!answer) continue;
    const submitted = await request.post(
      `http://127.0.0.1:3000/api/game-sessions/${started.data.sessionId}/answers`,
      {
        data: {
          questionId: question.id,
          selectedAnswerId: answer.id,
          answerTimeMs: 1000,
        },
      }
    );
    expect(submitted.ok(), await submitted.text()).toBe(true);
  }

  const finished = await request.post(
    `http://127.0.0.1:3000/api/game-sessions/${started.data.sessionId}/finish`
  );
  expect(finished.ok(), await finished.text()).toBe(true);
}

async function fireAt(
  page: Page,
  worldX: number,
  worldY: number,
  shots: number
) {
  const canvas = page.locator('.game-canvas canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const targetX = box.x + (worldX / 960) * box.width;
  const targetY = box.y + (worldY / 540) * box.height;
  await page.mouse.move(targetX, targetY);
  await page.waitForTimeout(100);
  for (let shot = 0; shot < shots; shot += 1) {
    await page.mouse.click(targetX, targetY);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1600);
}
