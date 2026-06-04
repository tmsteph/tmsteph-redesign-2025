import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initShoppingList } from '../shopping-list/shopping-list.js';

const baseMarkup = `
  <form id="shopping-form">
    <input id="item-name" />
    <input id="item-quantity" />
    <select id="item-category">
      <option value="Produce">Produce</option>
      <option value="Dairy">Dairy</option>
    </select>
    <input id="item-date" />
    <input id="item-store" />
    <textarea id="item-notes"></textarea>
    <button type="submit">Submit</button>
  </form>
  <input id="shopping-share-link" />
  <button id="shopping-copy-link" type="button">Copy link</button>
  <p id="shopping-sync-status"></p>
  <div id="shopping-empty"></div>
  <ul id="shopping-list"></ul>
`;

const createDom = (url = 'https://example.com/shopping-list/') =>
  new JSDOM(`<!doctype html><html><body>${baseMarkup}</body></html>`, {
    url,
  });

const createGunMock = () => {
  const put = vi.fn();
  const on = vi.fn();
  const paths = [];
  const puts = [];
  const createNode = (path = []) => ({
    map: () => ({ on }),
    get: vi.fn((key) => {
      const nextPath = [...path, key];
      paths.push(nextPath);
      return createNode(nextPath);
    }),
    put: (value) => {
      puts.push({ path, value });
      return put(value);
    },
  });
  const Gun = vi.fn(() => createNode());

  return { Gun, put, paths, puts };
};

const pathWasRequested = (paths, expectedPath) =>
  paths.some((path) => path.join('/') === expectedPath.join('/'));

const createClipboardMock = (dom) => {
  const clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };

  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });

  return clipboard;
};

describe('shopping list sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the list id from the URL when present', () => {
    const dom = createDom('https://example.com/shopping-list/?list=family123');
    const { Gun, paths } = createGunMock();

    initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toContain('list=family123');
    expect(pathWasRequested(paths, ['shopping-list', 'family123', 'items'])).toBe(true);
  });

  it('adds a list id to the URL when missing', () => {
    const dom = createDom('https://example.com/shopping-list/');
    const { Gun } = createGunMock();

    initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toMatch(/list=/);
  });

  it('stores submitted items in Gun', () => {
    const dom = createDom('https://example.com/shopping-list/?list=family123');
    const { Gun, put, puts } = createGunMock();
    const documentRef = dom.window.document;

    documentRef.getElementById('item-name').value = 'Milk';
    documentRef.getElementById('item-quantity').value = '2 gallons';
    documentRef.getElementById('item-category').value = 'Dairy';
    documentRef.getElementById('item-date').value = '2025-01-02';
    documentRef.getElementById('item-store').value = 'Corner Market';
    documentRef.getElementById('item-notes').value = 'Organic';

    initShoppingList({
      Gun,
      document: documentRef,
      window: dom.window,
    });

    documentRef
      .getElementById('shopping-form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true }));

    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Milk',
        quantity: '2 gallons',
        category: 'Dairy',
        neededBy: '2025-01-02',
        store: 'Corner Market',
        notes: 'Organic',
      })
    );

    const itemPut = puts.find(
      (entry) =>
        entry.path.slice(0, -1).join('/') === 'shopping-list/family123/items' &&
        entry.value?.name === 'Milk'
    );
    const itemId = itemPut?.path.at(-1);
    const indexPut = puts.find((entry) =>
      pathWasRequested([entry.path], ['shopping-list', 'family123', 'item-index'])
    );

    expect(itemPut).toBeTruthy();
    expect(indexPut?.value?.[itemId]).toBe(true);
  });

  it('reuses the stored list id when returning', () => {
    const dom = createDom('https://example.com/shopping-list/');
    dom.window.localStorage.setItem('shoppingListId', 'returning-456');
    const { Gun, paths } = createGunMock();

    initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toContain('list=returning-456');
    expect(pathWasRequested(paths, ['shopping-list', 'returning-456', 'items'])).toBe(true);
  });

  it('exposes a copyable sync link for the current list', async () => {
    const dom = createDom('https://example.com/shopping-list/?list=family123');
    const clipboard = createClipboardMock(dom);
    const { Gun } = createGunMock();

    const result = initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    const shareInput = dom.window.document.getElementById('shopping-share-link');
    const copyButton = dom.window.document.getElementById('shopping-copy-link');
    const syncStatus = dom.window.document.getElementById('shopping-sync-status');

    expect(result).toEqual(
      expect.objectContaining({
        listId: 'family123',
        shareUrl: 'https://example.com/shopping-list/?list=family123',
      })
    );
    expect(shareInput.value).toBe('https://example.com/shopping-list/?list=family123');

    copyButton.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith(
        'https://example.com/shopping-list/?list=family123'
      );
      expect(syncStatus.textContent).toBe('Current list link copied.');
    });
  });

  it('uses the same Gun list path across isolated browsers when opened from the sync link', () => {
    const sharedUrl = 'https://example.com/shopping-list/?list=family123';
    const chromePwa = createDom(sharedUrl);
    const braveBrowser = createDom(sharedUrl);
    const chromeGun = createGunMock();
    const braveGun = createGunMock();

    const chromeResult = initShoppingList({
      Gun: chromeGun.Gun,
      document: chromePwa.window.document,
      window: chromePwa.window,
    });
    const braveResult = initShoppingList({
      Gun: braveGun.Gun,
      document: braveBrowser.window.document,
      window: braveBrowser.window,
    });

    expect(chromeResult.listId).toBe('family123');
    expect(braveResult.listId).toBe('family123');
    expect(pathWasRequested(chromeGun.paths, ['shopping-list', 'family123', 'items'])).toBe(true);
    expect(pathWasRequested(braveGun.paths, ['shopping-list', 'family123', 'items'])).toBe(true);
  });
});
