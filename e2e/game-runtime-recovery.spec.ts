import { expect, test } from '@playwright/test';

test('replaces a stale lazy game chunk with a reload action', async ({
  page,
}) => {
  await page.route('**/src/game/runtime/create-game.ts*', (route) =>
    route.abort()
  );
  /* The recovery path belongs to the Phaser loader, so exercise it explicitly. */
  await page.goto('/?renderer=2d');
  await page.getByRole('button', { name: 'Start training' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('The game update could not load');
  await expect(
    alert.getByRole('button', { name: 'Refresh game' })
  ).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(0);
});
