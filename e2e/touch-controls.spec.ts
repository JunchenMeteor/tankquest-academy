import type {
  ApiResponse,
  EnemyTankConfigDto,
  StartSessionResponse,
} from '@tankquest/shared';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { officialQuestionSeeds } from '../apps/api/prisma/content/official-questions.js';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('offers localized coarse-pointer movement, aim, and fire controls', async ({
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
    const enemy = enemyTanks[0] as EnemyTankConfigDto;
    payload.data.level.config = {
      ...payload.data.level.config,
      enemyTanks: [
        {
          ...enemy,
          x: 330,
          y: 270,
          stats: { ...enemy.stats, armor: 1, mobility: 1 },
          ai: {
            ...enemy.ai,
            attackRange: 60,
            detectionRange: 80,
            speedMultiplier: 0.1,
          },
        },
      ],
      map: {
        style: 'range',
        playerSpawn: { x: 120, y: 270 },
        obstacles: [],
      },
      objectiveSet: {
        completion: 'all',
        objectives: [
          { id: 'touch_eliminate', type: 'eliminate', targetCount: 1 },
        ],
      },
    };
    await route.fulfill({ response, json: payload });
  });

  await page.goto('/');
  await expect(page.locator('main[data-phase="ready"]')).toBeVisible();
  const start = page.getByRole('button', { name: 'Start training' });
  await expectTouchTarget(start);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await start.click();

  const controls = page.getByRole('region', { name: 'Touch tank controls' });
  await expect(controls).toBeVisible();
  for (const label of [
    'Drive forward',
    'Reverse',
    'Turn left',
    'Turn right',
    'Aim left',
    'Aim right',
    'Fire',
  ]) {
    const button = controls.getByRole('button', { name: label });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    const prompt = await page.locator('.learning-console h2').textContent();
    const question = officialQuestionSeeds.find(
      (candidate) => candidate.prompt.en === prompt
    );
    const answer = question?.choices[question.correctIndex]?.en;
    expect(answer, `known seed answer for ${prompt}`).toBeTruthy();
    if (!answer) throw new Error(`Missing answer for ${prompt}`);
    const answerButton = page.getByRole('button', {
      name: answer,
      exact: true,
    });
    await expectTouchTarget(answerButton);
    await answerButton.tap();
    await expect(page.locator('.feedback.good')).toBeVisible();
    const continueButton = page.getByRole('button', {
      name: index === 2 ? 'Return to battle' : 'Next challenge',
    });
    await expectTouchTarget(continueButton);
    await continueButton.tap();
  }

  const fire = controls.getByRole('button', { name: 'Fire' });
  await fire.tap();
  await expect(page.locator('.hud dd').nth(1)).toHaveText('1');
  await fireAt(page, 330, 270, 4);
  await expect(
    page.getByRole('heading', { name: 'Training field secured' })
  ).toBeVisible({ timeout: 10_000 });
  await controls
    .getByRole('button', { name: 'Drive forward' })
    .click({ delay: 120 });
  await controls.getByRole('button', { name: 'Reverse' }).click({ delay: 120 });
  await controls
    .getByRole('button', { name: 'Aim left' })
    .click({ delay: 120 });
  await controls
    .getByRole('button', { name: 'Aim right' })
    .click({ delay: 120 });
  const complete = page.getByRole('button', { name: 'Complete mission' });
  await expectTouchTarget(complete);
  await complete.tap();
  await expect(
    page.getByRole('heading', { name: 'Mission complete' })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const upgrade = page.getByRole('button', {
    name: /Spend 2 parts: upgrade firepower|Firepower is at maximum/,
  });
  await expectTouchTarget(upgrade);
  if ((await upgrade.textContent())?.includes('Spend 2 parts')) {
    await upgrade.tap();
    await expect(page.locator('.upgrade-confirmation')).toContainText(
      'Upgrade complete'
    );
  } else {
    await expect(upgrade).toBeDisabled();
  }
  const replay = page.getByRole('button', { name: 'Replay mission' });
  await expectTouchTarget(replay);
  await replay.tap();
  await expect(page.locator('main[data-phase="active"]')).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  expect(pageErrors).toEqual([]);
});

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
}

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}

async function fireAt(
  page: Page,
  worldX: number,
  worldY: number,
  shots: number
) {
  const canvas = page.locator('.game-canvas canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const targetX = box.x + (worldX / 960) * box.width;
  const targetY = box.y + (worldY / 540) * box.height;
  await page.mouse.move(targetX, targetY);
  await page.waitForTimeout(400);
  for (let shot = 0; shot < shots; shot += 1) {
    await page.mouse.click(targetX, targetY);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1_000);
}
