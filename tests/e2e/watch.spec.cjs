const { test, expect } = require('@playwright/test');

const emptyJsResponse = {
  status: 200,
  contentType: 'application/javascript',
  body: '',
};

async function stubWatcherDependencies(page) {
  await page.route('**/_vercel/analytics/script.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/iframe_api*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.YT = {
          Player: function Player(element, options) {
            var mount = typeof element === 'string' ? document.getElementById(element) : element;
            var frame = document.createElement('iframe');
            frame.className = 'playwright-stub-frame';
            frame.src = 'about:blank';
            mount.appendChild(frame);
            var player = {
              getIframe: function () { return frame; },
              getVideoData: function () { return { title: 'Stub ' + options.videoId }; },
              setVolume: function () {},
              mute: function () {},
              unMute: function () {},
              destroy: function () { frame.remove(); }
            };
            setTimeout(function () {
              if (options.events && options.events.onReady) {
                options.events.onReady({ target: player });
              }
            }, 0);
            return player;
          }
        };
        if (window.onYouTubeIframeAPIReady) {
          window.onYouTubeIframeAPIReady();
        }
      `,
    });
  });
  await page.route('https://api.piped.private.coffee/search?**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            url: '/watch?v=ScMzIvxBSi4',
            title: 'Search result video',
            uploaderName: 'Playwright DJ',
            thumbnail: 'https://example.com/thumb.jpg',
            duration: 95,
          },
        ],
      }),
    });
  });
}

test('YouTube Video Watcher loads defaults, adds a video, and disables sliders in proxy mode', async ({ page }) => {
  await stubWatcherDependencies(page);

  await page.goto('/watch/index.html');

  await expect(page.getByRole('heading', { name: 'YouTube Video Watcher' })).toBeVisible();
  await expect(page.locator('[data-video-count]')).toHaveText('2');
  await expect(page.locator('.multiview-frame-wrapper')).toHaveCount(2);

  await expect(page.locator('[data-advanced-player-settings]')).not.toHaveAttribute('open', '');
  await page.fill('#video-search-query', 'lofi');
  await page.getByRole('button', { name: 'Search videos' }).click();
  await expect(page.locator('.video-search-card')).toHaveCount(1);
  await page.evaluate(() => {
    const grid = document.querySelector('[data-multiview-grid]');
    const originalInsertBefore = grid.insertBefore.bind(grid);
    window.__watcherMovedExisting = [];
    grid.insertBefore = (node, child) => {
      if (node.parentNode === grid) {
        window.__watcherMovedExisting.push(node.dataset.videoId || '');
      }
      return originalInsertBefore(node, child);
    };
  });
  await page.getByRole('button', { name: 'Add video' }).click();

  await expect(page.locator('[data-video-count]')).toHaveText('3');
  await expect(page.locator('.multiview-frame-wrapper')).toHaveCount(3);
  await expect(page).toHaveURL(/video=/);
  await expect(page.locator('.multiview-frame-wrapper').first()).toHaveAttribute('data-video-id', 'ScMzIvxBSi4');
  await expect.poll(async () => {
    return page.evaluate(() => window.__watcherMovedExisting);
  }).toEqual([]);

  await page.locator('[data-advanced-player-settings] summary').click();
  await expect(page.locator('[data-advanced-player-settings]')).toHaveAttribute('open', '');
  await page.locator('.multiview-player-option', { hasText: 'Proxy mode' }).click();
  await expect(page.locator('.multiview-volume input[type="range"]').first()).toBeDisabled();
  await expect(page.locator('[data-state-summary]')).toContainText('Proxy mode is on');
});

test('YouTube Video Watcher stays stacked and inside the viewport on narrow screens', async ({ page }) => {
  await stubWatcherDependencies(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/watch/index.html');

  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const searchInput = document.getElementById('video-search-query').getBoundingClientRect();
    const searchButton = document.querySelector('[data-video-search-button]').getBoundingClientRect();
    const builderPanels = Array.from(document.querySelectorAll('.watch-builder-grid > *')).map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const actionButtons = Array.from(document.querySelectorAll('.watch-quick-actions > *')).map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });

    return {
      viewportWidth,
      documentWidth,
      searchStacked: searchButton.top >= searchInput.bottom,
      builderPanelsWithinViewport: builderPanels.every((panel) => panel.left >= 0 && panel.right <= viewportWidth + 1),
      builderPanelsStacked:
        builderPanels.length < 2 ||
        (Math.abs(builderPanels[0].left - builderPanels[1].left) < 2 && builderPanels[1].top >= builderPanels[0].bottom - 1),
      quickActionsStacked: actionButtons.every((button, index) => index === 0 || button.top >= actionButtons[index - 1].bottom - 1),
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.searchStacked).toBe(true);
  expect(layout.builderPanelsWithinViewport).toBe(true);
  expect(layout.builderPanelsStacked).toBe(true);
  expect(layout.quickActionsStacked).toBe(true);
});
