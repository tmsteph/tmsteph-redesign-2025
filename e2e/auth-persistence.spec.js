import { expect, test } from '@playwright/test';

const mockGunScripts = async (page) => {
  const emptyJsResponse = {
    status: 200,
    contentType: 'application/javascript',
    body: ''
  };

  await page.route('**/gun.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/sea.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/pwa.js*', (route) => route.fulfill(emptyJsResponse));
  await page.route('**/_vercel/analytics/script.js*', (route) => route.fulfill(emptyJsResponse));

  await page.addInitScript(() => {
    const makeNode = () => ({
      get: () => makeNode(),
      on: () => {},
      once: (callback) => {
        if (typeof callback === 'function') {
          callback(undefined);
        }
      },
      off: () => {},
      put: (_value, callback) => {
        if (typeof callback === 'function') {
          callback({});
        }
      },
      map: () => ({
        on: () => {}
      })
    });

    const listeners = { auth: [], hi: [], bye: [] };

    const user = {
      is: null,
      _: { sea: {}, alias: '' },
      get: () => makeNode(),
      recall: (options = {}) => {
        const sessionAlias = options.sessionStorage ? sessionStorage.getItem('mock-gun-auth-alias') : null;
        const localAlias = options.localStorage ? localStorage.getItem('mock-gun-auth-alias') : null;
        const alias = sessionAlias || localAlias;
        if (!alias) {
          return;
        }
        user.is = { alias };
        user._.alias = alias;
      },
      create: (_alias, _password, callback) => {
        if (typeof callback === 'function') {
          callback({});
        }
      },
      auth: (alias, _password, callback, options = {}) => {
        user.is = { alias };
        user._.alias = alias;
        const shouldUseSession = options.sessionStorage !== false;
        const shouldUseLocal = options.remember === true || options.localStorage === true;

        if (shouldUseSession) {
          sessionStorage.setItem('mock-gun-auth-alias', alias);
        } else {
          sessionStorage.removeItem('mock-gun-auth-alias');
        }

        if (shouldUseLocal) {
          localStorage.setItem('mock-gun-auth-alias', alias);
        }

        if (typeof callback === 'function') {
          callback({});
        }
        listeners.auth.forEach((listener) => listener());
      },
      leave: () => {
        user.is = null;
        user._.alias = '';
        sessionStorage.removeItem('mock-gun-auth-alias');
        localStorage.removeItem('mock-gun-auth-alias');
      }
    };

    const gun = {
      user: () => user,
      on: (event, callback) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
      },
      _: {
        opt: {
          peers: {}
        }
      }
    };

    const Gun = function () {
      return gun;
    };

    Gun.SEA = {
      encrypt: async (value) => value,
      decrypt: async (value) => value
    };
    Gun.text = {
      random: () => 'mock-random-id'
    };

    window.Gun = Gun;
  });
};

test('admin login survives a page refresh in the same tab', async ({ page }) => {
  await mockGunScripts(page);

  await page.goto('/admin/index.html');
  await page.fill('#alias', 'tmsteph');
  await page.fill('#password', 'test-password');
  await page.click('#auth-submit');

  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.locator('#auth-section')).toBeHidden();

  await page.reload();

  await expect(page.locator('#admin-panel')).toBeVisible();
  await expect(page.locator('#auth-section')).toBeHidden();
});

test('admin login carries over to a new tab', async ({ context, page }) => {
  await mockGunScripts(page);

  await page.goto('/admin/index.html');
  await page.fill('#alias', 'tmsteph');
  await page.fill('#password', 'test-password');
  await page.click('#auth-submit');

  await expect(page.locator('#admin-panel')).toBeVisible();

  const newTab = await context.newPage();
  await mockGunScripts(newTab);
  await newTab.goto('/admin/index.html');

  await expect(newTab.locator('#admin-panel')).toBeVisible();
  await expect(newTab.locator('#auth-section')).toBeHidden();
});

test('homepage login link survives refresh and carries over to a new tab', async ({ context, page }) => {
  await mockGunScripts(page);

  await page.goto('/admin/index.html');
  await page.fill('#alias', 'tmsteph');
  await page.fill('#password', 'test-password');
  await page.click('#auth-submit');

  await page.goto('/index.html');
  await expect(page.locator('#login-link')).toHaveText('tmsteph');

  await page.reload();
  await expect(page.locator('#login-link')).toHaveText('tmsteph');

  const newTab = await context.newPage();
  await mockGunScripts(newTab);
  await newTab.goto('/index.html');
  await expect(newTab.locator('#login-link')).toHaveText('tmsteph');
});
