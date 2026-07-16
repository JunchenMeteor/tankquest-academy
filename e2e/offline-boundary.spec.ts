import { expect, test } from '@playwright/test';

test('blocks authoritative training actions while offline', async ({
  context,
  page,
}) => {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start training' });
  await expect(start).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/Offline mode:/)).toBeVisible();
  await expect(start).toBeDisabled();

  await context.setOffline(false);
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator('.game-canvas canvas')).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.locator('.learning-console .choices button').first()
  ).toBeDisabled();
  await context.setOffline(false);
});
