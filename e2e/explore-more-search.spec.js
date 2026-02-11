import { expect, test } from '@playwright/test';

const mockExternalScripts = async (page) => {
  const emptyJsResponse = {
    status: 200,
    contentType: 'application/javascript',
    body: ''
  };

  await page.route('**/gun.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/sea.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/pwa.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/_vercel/analytics/script.js*', (route) => route.fulfill(emptyJsResponse));
};

test('explore more includes the multi-view theater card', async ({ page }) => {
  await mockExternalScripts(page);
  await page.goto('/index.html');

  const exploreSection = page.locator('section.section.card').filter({
    has: page.getByRole('heading', { name: 'Explore More' })
  });

  const theaterCard = exploreSection.locator('#explore-project-grid .project-card', {
    hasText: 'Multi-View Theater'
  });

  await expect(theaterCard).toBeVisible();
  await expect(theaterCard).toHaveAttribute('href', 'watch/index.html');
  await expect(page.getByRole('heading', { name: 'Multi-View Theater', exact: true })).toHaveCount(0);
});

test('explore more search filters app cards', async ({ page }) => {
  await mockExternalScripts(page);
  await page.goto('/index.html');

  const searchInput = page.locator('#explore-search-input');
  const status = page.locator('#explore-search-status');
  const emptyMessage = page.locator('#explore-search-empty');
  const allCards = page.locator('#explore-project-grid .project-card');
  const visibleCards = page.locator('#explore-project-grid .project-card:not([hidden])');
  const theaterCard = page.locator('#explore-project-grid .project-card', {
    hasText: 'Multi-View Theater'
  });
  const spiritualityCard = page.locator('#explore-project-grid .project-card', {
    hasText: 'Spirituality'
  });

  const totalCount = await allCards.count();

  await expect(status).toHaveText(`Showing all ${totalCount} apps.`);
  await expect(visibleCards).toHaveCount(totalCount);

  await searchInput.fill('watch');
  await expect(status).toHaveText(`Showing 1 of ${totalCount} apps for "watch".`);
  await expect(visibleCards).toHaveCount(1);
  await expect(theaterCard).toBeVisible();
  await expect(spiritualityCard).toBeHidden();
  await expect(emptyMessage).toBeHidden();

  await searchInput.fill('zzzz-no-match');
  await expect(status).toHaveText(`Showing 0 of ${totalCount} apps for "zzzz-no-match".`);
  await expect(visibleCards).toHaveCount(0);
  await expect(emptyMessage).toBeVisible();
});
