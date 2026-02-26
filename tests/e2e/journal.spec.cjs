const { test, expect } = require('@playwright/test');

const buildGuestId = () => `pw-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

test('journal guest entry can be created and displayed', async ({ page }) => {
  await page.addInitScript(() => {
    function createNode(parent, key) {
      const children = {};
      const listeners = [];
      const node = {
        _data: undefined,
        _parent: parent || null,
        _key: key || null,
        get(childKey) {
          if (!children[childKey]) {
            children[childKey] = createNode(node, childKey);
          }
          return children[childKey];
        },
        put(data) {
          node._data = data;
          if (node._parent && typeof node._parent._emit === 'function') {
            node._parent._emit(node._key, data);
          }
          return node;
        },
        _emit(childKey, data) {
          listeners.forEach((cb) => cb(data, childKey));
        },
        map() {
          return {
            on(cb) {
              listeners.push(cb);
              Object.keys(children).forEach((childKey) => {
                const child = children[childKey];
                if (child._data !== undefined) {
                  cb(child._data, childKey);
                }
              });
            }
          };
        },
        on() {}
      };
      return node;
    }

    const root = createNode();
    window.Gun = () => ({
      get(key) {
        return root.get(key);
      },
      on() {},
      user() {
        return {
          is: null,
          recall() {},
          create(alias, password, cb) {
            cb({ ok: 1 });
          },
          auth(alias, password, cb) {
            cb({ ok: 1 });
          },
          leave() {},
          get() {
            return createNode();
          }
        };
      }
    });
  });

  await page.route('**/vendor/gun.min.js', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.route('**/vendor/sea.min.js', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  const guestId = buildGuestId();
  await page.goto(`/journal/?journal=${guestId}`);

  await expect(page.evaluate(() => typeof window.Gun)).resolves.toBe('function');
  await expect(page.locator('#journal-share-link')).toContainText('journal=');

  await expect(page.getByRole('heading', { name: 'Journal', level: 1 })).toBeVisible();
  await expect(page.locator('#journal-form')).toBeVisible();

  await page.fill('#journal-title', 'Playwright entry');
  await page.fill('#journal-date', '2026-02-26');
  await page.fill('#journal-body', 'Testing the journal guest entry flow.');
  await page.fill('#journal-tags', 'test, e2e');
  await page.selectOption('#journal-type', 'Idea');

  await page.getByRole('button', { name: 'Save entry' }).click();

  const entryCard = page.locator('#journal-list .journal-entry').first();
  await expect(entryCard).toContainText('Playwright entry');
  await expect(entryCard).toContainText('Idea');
  await expect(entryCard).toContainText('Testing the journal guest entry flow.');
});
