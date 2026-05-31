import { expect, test } from '@playwright/test';

test('internal signal page renders and updates the signal meter', async ({ page }) => {
  await page.goto('/internal-signal/');

  await expect(page).toHaveTitle(/Internal Signal \/ External World/);
  await expect(page.getByRole('heading', { name: 'Make a place for the signal.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to tmsteph' })).toHaveAttribute('href', '../index.html');

  const meter = page.locator('#meterResult');
  await expect(meter).toContainText('Good integration zone.');

  await page.locator('#signalRange').fill('85');
  await expect(meter).toContainText('Return to the center.');
});
