import { expect, test } from '@playwright/test';

test('replaces a stale lazy game chunk with a reload action', async ({
  page,
}) => {
  await page.route('**/src/game/runtime/create-game.ts*', (route) =>
    route.abort()
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Start training' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('The game update could not load');
  await expect(
    alert.getByRole('button', { name: 'Refresh game' })
  ).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
});
