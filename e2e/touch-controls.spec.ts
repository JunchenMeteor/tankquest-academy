import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

test('offers localized coarse-pointer movement, aim, and fire controls', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Start training' }).click();

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
    await expect(controls.getByRole('button', { name: label })).toBeVisible();
  }

  await expect(page.locator('.game-canvas canvas')).toBeVisible();
  const fire = controls.getByRole('button', { name: 'Fire' });
  await fire.tap();
  await expect(page.locator('.hud dd').nth(1)).toHaveText('1');
  expect(pageErrors).toEqual([]);
});
