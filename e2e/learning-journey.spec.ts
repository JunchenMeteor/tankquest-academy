import { expect, test } from '@playwright/test';

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
  await startButton.click();
  await expect(page.locator('.game-canvas canvas')).toBeVisible();

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
        name: index === 2 ? 'Complete mission' : 'Next challenge',
      })
      .click();
  }

  await expect(
    page.getByRole('heading', { name: 'Mission complete' })
  ).toBeVisible();
  await expect(page.getByText('3 cannon parts earned')).toBeVisible();
  await page
    .getByRole('button', { name: 'Spend 2 parts: upgrade firepower' })
    .click();
  await expect(
    page.getByText(/Firepower upgrade level 1; 1 parts remain/)
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
