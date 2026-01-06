import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initRecipeBook } from '../recipe-book/recipe-book.js';

const baseMarkup = `
  <div>
    <input id="recipe-share-link" />
    <button id="recipe-share-copy" type="button">Copy</button>
    <p id="recipe-share-status"></p>
  </div>
  <form id="recipe-form">
    <input id="recipe-name" />
    <select id="recipe-category">
      <option value="Breakfast">Breakfast</option>
      <option value="Dinner">Dinner</option>
    </select>
    <input id="recipe-servings" />
    <input id="recipe-time" />
    <textarea id="recipe-ingredients"></textarea>
    <textarea id="recipe-steps"></textarea>
    <input id="recipe-source" />
    <button id="recipe-submit" type="submit">Submit</button>
    <button id="recipe-cancel" type="button">Cancel</button>
  </form>
  <h3 id="recipe-form-title"></h3>
  <div id="recipe-empty"></div>
  <ul id="recipe-list"></ul>
`;

const createDom = (url = 'https://example.com/recipe-book/') =>
  new JSDOM(`<!doctype html><html><body>${baseMarkup}</body></html>`, {
    url,
  });

const createGunMock = () => {
  const put = vi.fn();
  const on = vi.fn();
  const recipesNode = {
    map: () => ({ on }),
    get: vi.fn(() => ({ put })),
  };
  const bookIdNode = {
    get: vi.fn(() => recipesNode),
  };
  const bookRoot = {
    get: vi.fn(() => bookIdNode),
  };
  const rootNode = {
    get: vi.fn(() => bookRoot),
  };
  const Gun = vi.fn(() => rootNode);

  return { Gun, put };
};

describe('recipe book sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the book id from the URL when present', () => {
    const dom = createDom('https://example.com/recipe-book/?book=family123');
    const { Gun } = createGunMock();

    initRecipeBook({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toContain('book=family123');
    expect(dom.window.document.getElementById('recipe-share-link').value).toContain('book=family123');
  });

  it('adds a book id to the URL when missing', () => {
    const dom = createDom('https://example.com/recipe-book/');
    const { Gun } = createGunMock();

    initRecipeBook({
      Gun,
      document: dom.window.document,
      window: dom.window,
    });

    expect(dom.window.location.search).toMatch(/book=/);
  });

  it('stores submitted recipes in Gun', () => {
    const dom = createDom('https://example.com/recipe-book/?book=family123');
    const { Gun, put } = createGunMock();
    const documentRef = dom.window.document;

    documentRef.getElementById('recipe-name').value = 'Lemon Salmon';
    documentRef.getElementById('recipe-category').value = 'Dinner';
    documentRef.getElementById('recipe-servings').value = '4';
    documentRef.getElementById('recipe-time').value = '35 minutes';
    documentRef.getElementById('recipe-ingredients').value = 'Salmon\nLemon';
    documentRef.getElementById('recipe-steps').value = 'Season fish\nBake';
    documentRef.getElementById('recipe-source').value = 'https://example.com/recipe';

    initRecipeBook({
      Gun,
      document: documentRef,
      window: dom.window,
    });

    documentRef
      .getElementById('recipe-form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true }));

    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lemon Salmon',
        category: 'Dinner',
        ingredients: ['Salmon', 'Lemon'],
        steps: ['Season fish', 'Bake'],
        source: 'https://example.com/recipe',
      })
    );
  });
});
