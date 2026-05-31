import { expect, test } from '@playwright/test';

test('calm structure local app handles meals, tasks, and grounding notes', async ({ page }) => {
  await page.goto('/calm-structure/');

  await expect(page).toHaveTitle(/Calm Structure/);
  await expect(page.getByRole('heading', { name: 'Today\'s Structure' })).toBeVisible();
  await page.locator('#selected-date').fill('2026-06-01');
  await page.locator('#selected-date').dispatchEvent('change');

  await page.getByRole('button', { name: 'Meal Rhythm' }).click();
  await page.locator('#meal-date').fill('2026-06-01');
  await page.locator('#meal-slot').selectOption('dinner');
  await page.locator('#meal-choice').selectOption('herb-roasted-chicken');
  await page.locator('#fallback-meal').selectOption('yogurt-bowl');
  await page.getByRole('button', { name: 'Save meal' }).click();
  await expect(page.locator('#week-plan')).toContainText('Herb Roasted Chicken');

  await page.getByRole('button', { name: 'Generate grocery list' }).click();
  await expect(page.locator('#grocery-list')).toContainText('Organic chicken');
  await expect(page.locator('#grocery-list')).toContainText('Organic yogurt');

  await page.getByRole('button', { name: 'Owned by Me' }).click();
  await page.locator('#task-title').fill('Pack child supplies');
  await page.locator('#task-domain').selectOption('child');
  await page.locator('#task-due').fill('2026-06-01');
  await page.locator('#task-promise').fill('I will check the bag before leaving.');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('#task-list')).toContainText('Pack child supplies');

  await page.getByRole('button', { name: 'Grounding' }).click();
  await expect(page.locator('#grounding-prompts')).toContainText('Pause first');
  await page.locator('#grounding-notes').fill('Local note only');
  await page.getByRole('button', { name: 'Save locally' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Grounding' }).click();
  await expect(page.locator('#grounding-notes')).toHaveValue('Local note only');
});
