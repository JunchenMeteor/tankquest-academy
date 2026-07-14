import type {
  ApiResponse,
  EnemyTankConfigDto,
  StartSessionResponse,
} from '@tankquest/shared';
import { expect, test, type Page } from '@playwright/test';

const correctAnswers: Record<string, string> = {
  '8 + 7 = ?': '15',
  '9 + 6 = ?': '15',
  '13 - 5 = ?': '8',
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
  await page.reload();
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.locator('.mission-status')).toContainText(
    /Firepower [4-5]/
  );
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
  await expect(page.getByRole('button', { name: /Star Shield/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Swift Fox/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Iron Mountain/ })
  ).toBeVisible();

  await page.getByRole('button', { name: /Swift Fox/ }).click();
  const sessionRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/game-sessions') &&
      request.method() === 'POST'
  );
  await page.getByRole('button', { name: 'Start training' }).click();

  expect((await sessionRequest).postDataJSON()).toMatchObject({
    tankId: 'tank_swift_fox',
  });
  await expect(
    page.getByText(/Firepower 2 · Mobility 5 · Armor 1 · Stealth 4 · Vision 4/)
  ).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
});

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
