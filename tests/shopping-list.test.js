import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initShoppingList } from '../shopping-list/shopping-list.js';

const baseMarkup = `
  <form id="shopping-form">
    <h3 id="shopping-form-title"></h3>
    <input id="item-name" />
    <input id="item-quantity" />
    <select id="item-category">
      <option value="Produce">Produce</option>
      <option value="Dairy">Dairy</option>
    </select>
    <input id="item-date" />
    <input id="item-store" />
    <textarea id="item-notes"></textarea>
    <button id="shopping-submit" type="submit">Submit</button>
    <button id="shopping-cancel" type="button">Cancel</button>
  </form>
  <select id="shopping-sort">
    <option value="recent">Recently added</option>
    <option value="alpha">Alphabetical</option>
  </select>
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
  const itemsNode = {
    map: () => ({ on }),
    get: vi.fn(() => ({ put })),
  };
  const listIdNode = {
    get: vi.fn(() => itemsNode),
  };
  const listNode = {
    get: vi.fn(() => listIdNode),
  };
  const rootNode = {
    get: vi.fn(() => listNode),
  };
  const Gun = vi.fn(() => rootNode);

  return { Gun, put };
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
    const { Gun } = createGunMock();

    initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toContain('list=family123');
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
    const { Gun, put } = createGunMock();
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
  });

  it('reuses the stored list id when returning', () => {
    const dom = createDom('https://example.com/shopping-list/');
    dom.window.localStorage.setItem('shoppingListId', 'returning-456');
    const { Gun } = createGunMock();

    initShoppingList({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toContain('list=returning-456');
  });
});
