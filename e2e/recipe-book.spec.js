import { expect, test } from '@playwright/test';

test('recipe workflow supports links, ingredients, and meal-planner handoff', async ({ page }) => {
  const id = `browser-${Date.now()}`;
  await page.goto(`/recipe-book/?book=${id}&list=${id}`);

  await page.locator('#recipe-title').fill('Weeknight lemon chicken');
  await page
    .locator('#recipe-url')
    .fill('https://www.allrecipes.com/recipe/242352/greek-lemon-chicken-and-potatoes/');
  await page.locator('#recipe-description').fill('Realistic family dinner test');
  await page.locator('#recipe-servings').fill('4');
  await page
    .locator('#recipe-ingredients')
    .fill('1 1/2 lb | chicken thighs | Meat\n2 | lemons | Produce');
  await page
    .locator('#recipe-directions')
    .fill('Heat oven to 425°F.\nCook chicken to 165°F.');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.locator('#recipe-sync-status')).toContainText('Saved');

  const card = page.locator('[data-recipe-id]').filter({ hasText: 'Weeknight lemon chicken' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 1/2 lb chicken thighs');
  await expect(card).toContainText('Heat oven to 425°F.');

  const planUrl = await card.getByRole('link', { name: 'Plan meal' }).getAttribute('href');
  const mealPage = await page.context().newPage();
  await mealPage.goto(planUrl);
  await expect(mealPage.locator('#meal-menu')).toHaveValue('Weeknight lemon chicken');
  await mealPage.getByRole('button', { name: 'Save meal' }).click();
  const plannedMeal = mealPage
    .locator('.meal-card')
    .filter({ hasText: 'Weeknight lemon chicken' })
    .first();
  await expect(plannedMeal.getByRole('link', { name: 'View recipe' })).toBeVisible();
  mealPage.on('dialog', (dialog) => dialog.accept());
  await plannedMeal.getByRole('button', { name: /Delete/ }).click();
  await mealPage.close();

  page.on('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
});

test('real relay syncs a recipe and its shopping items across browser contexts', async ({
  browser,
}) => {
  test.skip(process.env.REAL_SYNC !== '1', 'Run with REAL_SYNC=1 for live relay verification.');
  test.setTimeout(90_000);

  const id = `sync-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const sharedPath = `/recipe-book/?book=${id}&list=${id}`;
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await firstPage.goto(sharedPath);
    await firstPage.locator('#recipe-title').fill('Relay test lemon chicken');
    await firstPage
      .locator('#recipe-url')
      .fill('https://www.allrecipes.com/recipe/242352/greek-lemon-chicken-and-potatoes/');
    await firstPage
      .locator('#recipe-ingredients')
      .fill('1 1/2 lb | chicken thighs | Meat\n2 | lemons | Produce');
    await firstPage
      .locator('#recipe-directions')
      .fill('Heat oven to 425°F.\nCook chicken to 165°F.');
    await firstPage.getByRole('button', { name: 'Save recipe' }).click();
    await expect(firstPage.locator('#recipe-sync-status')).toContainText('Saved', {
      timeout: 20_000,
    });
    await expect(
      firstPage.getByRole('heading', { name: 'Relay test lemon chicken' })
    ).toBeVisible();
    await firstPage.waitForTimeout(1_500);

    await secondPage.goto(sharedPath);
    const findSyncedCard = () =>
      secondPage
        .locator('[data-recipe-id]')
        .filter({ hasText: 'Relay test lemon chicken' });
    await expect
      .poll(
        async () => {
          const count = await findSyncedCard().count();
          if (!count) {
            await secondPage.reload();
            await secondPage.waitForTimeout(750);
          }
          return count;
        },
        { timeout: 40_000, intervals: [1_000, 2_000, 4_000] }
      )
      .toBeGreaterThan(0);
    const syncedCard = findSyncedCard();
    await syncedCard.getByRole('button', { name: 'Add ingredients' }).click();
    await expect(secondPage.locator('#recipe-sync-status')).toContainText(
      '2 ingredients added'
    );

    await firstPage.goto(`/shopping-list/?list=${id}`);
    await expect(firstPage.getByText(/chicken thighs/i)).toBeVisible({ timeout: 20_000 });
    await expect(firstPage.getByText(/lemons/i)).toBeVisible({ timeout: 20_000 });

    await secondPage.goto(`/shopping-list/?list=${id}`);
    await expect(secondPage.getByText(/chicken thighs/i)).toBeVisible({ timeout: 20_000 });
    await expect(secondPage.getByText(/lemons/i)).toBeVisible({ timeout: 20_000 });

    const deleteButtons = firstPage.getByRole('button', { name: 'Delete' });
    while ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().click();
      await firstPage.waitForTimeout(100);
    }

    firstPage.on('dialog', (dialog) => dialog.accept());
    await firstPage.goto(sharedPath);
    const recipeDelete = firstPage
      .locator('[data-recipe-id]')
      .filter({ hasText: 'Relay test lemon chicken' })
      .getByRole('button', { name: 'Delete' });
    await expect(recipeDelete).toBeVisible({ timeout: 20_000 });
    await recipeDelete.click();
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});
