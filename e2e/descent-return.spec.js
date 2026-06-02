import { expect, test } from '@playwright/test';

test('descent and return page renders the awakening map', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/descent-return/');

  await expect(page).toHaveTitle(/Descent & Return/);
  await expect(page.getByRole('heading', { name: 'God remembering through matter.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'tmsteph' })).toHaveAttribute('href', '../index.html');
  await expect(page.getByRole('heading', { name: 'The awakening map' })).toBeVisible();

  await page.getByRole('link', { name: 'Begin the practice' }).click();
  await expect(page.getByRole('heading', { name: 'A small daily practice' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
