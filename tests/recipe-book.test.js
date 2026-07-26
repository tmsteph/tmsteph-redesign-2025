import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  addIngredientsToShoppingList,
  initRecipeBook,
  parseDirectionLines,
  parseIngredientLines,
} from '../recipe-book/recipe-book.js';

const baseMarkup = `
  <form id="recipe-form">
    <h3 id="recipe-form-title"></h3>
    <input id="recipe-title">
    <input id="recipe-url">
    <textarea id="recipe-description"></textarea>
    <input id="recipe-servings">
    <input id="recipe-prep-time">
    <input id="recipe-cook-time">
    <textarea id="recipe-ingredients"></textarea>
    <textarea id="recipe-directions"></textarea>
    <button id="recipe-submit" type="submit">Save</button>
    <button id="recipe-cancel" type="button"></button>
  </form>
  <input id="recipe-share-link">
  <button id="recipe-copy-link" type="button"></button>
  <p id="recipe-sync-status"></p>
  <input id="recipe-search">
  <p id="recipe-empty"></p>
  <ul id="recipe-list"></ul>
  <a id="recipe-shopping-link"></a>
`;

const createDom = (url = 'https://example.com/recipe-book/') =>
  new JSDOM(`<!doctype html><html><body>${baseMarkup}</body></html>`, { url });

const createGunMock = () => {
  const paths = [];
  const puts = [];
  const subscriptions = [];

  const createNode = (path = []) => ({
    get: vi.fn((key) => {
      const nextPath = [...path, key];
      paths.push(nextPath);
      return createNode(nextPath);
    }),
    put: vi.fn((value, callback) => {
      puts.push({ path, value });
      callback?.({ ok: 1 });
      return createNode(path);
    }),
    map: vi.fn(() => ({
      on: vi.fn((callback) => subscriptions.push({ path, callback, mapped: true })),
    })),
    on: vi.fn((callback) => subscriptions.push({ path, callback, mapped: false })),
  });

  return {
    Gun: vi.fn(() => createNode()),
    paths,
    puts,
    subscriptions,
  };
};

const pathWasRequested = (paths, expectedPath) =>
  paths.some((path) => path.join('/') === expectedPath.join('/'));

describe('recipe book', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T12:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts realistic ingredient and direction data', () => {
    expect(
      parseIngredientLines(
        '1 1/2 lb | boneless chicken thighs | Meat\n2 | lemons | Produce\nExtra-virgin olive oil'
      )
    ).toEqual([
      { quantity: '1 1/2 lb', name: 'boneless chicken thighs', category: 'Meat' },
      { quantity: '2', name: 'lemons', category: 'Produce' },
      { quantity: '', name: 'Extra-virgin olive oil', category: 'Other' },
    ]);
    expect(parseDirectionLines('Heat oven to 425°F.\n\nRoast for 25–30 minutes.')).toEqual([
      'Heat oven to 425°F.',
      'Roast for 25–30 minutes.',
    ]);
  });

  it('uses shareable recipe and shopping ids across isolated browsers', () => {
    const sharedUrl =
      'https://example.com/recipe-book/?book=stephens-family&list=weekly-groceries';
    const firstBrowser = createDom(sharedUrl);
    const secondBrowser = createDom(sharedUrl);
    const firstGun = createGunMock();
    const secondGun = createGunMock();

    const first = initRecipeBook({
      Gun: firstGun.Gun,
      document: firstBrowser.window.document,
      window: firstBrowser.window,
    });
    const second = initRecipeBook({
      Gun: secondGun.Gun,
      document: secondBrowser.window.document,
      window: secondBrowser.window,
    });

    expect(first).toMatchObject({
      bookId: 'stephens-family',
      listId: 'weekly-groceries',
    });
    expect(second).toMatchObject({
      bookId: 'stephens-family',
      listId: 'weekly-groceries',
    });
    expect(
      pathWasRequested(firstGun.paths, ['recipe-book', 'stephens-family', 'recipes'])
    ).toBe(true);
    expect(
      pathWasRequested(secondGun.paths, ['recipe-book', 'stephens-family', 'recipes'])
    ).toBe(true);
    expect(firstBrowser.window.document.getElementById('recipe-shopping-link').href).toContain(
      'list=weekly-groceries'
    );
  });

  it('stores a link-only recipe without inventing ingredients or directions', async () => {
    const dom = createDom(
      'https://example.com/recipe-book/?book=stephens-family&list=weekly-groceries'
    );
    const gun = createGunMock();
    const documentRef = dom.window.document;

    initRecipeBook({ Gun: gun.Gun, document: documentRef, window: dom.window });
    documentRef.getElementById('recipe-title').value = 'Serious Eats roast potatoes';
    documentRef.getElementById('recipe-url').value =
      'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe';
    documentRef
      .getElementById('recipe-form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.runAllTimersAsync();

    const savedRecipe = gun.puts.find(
      ({ path, value }) =>
        path.slice(0, -1).join('/') === 'recipe-book/stephens-family/recipes' &&
        value?.title === 'Serious Eats roast potatoes'
    );
    expect(savedRecipe?.value).toMatchObject({
      sourceUrl: 'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe',
      ingredientsJson: '[]',
      directionsJson: '[]',
    });
  });

  it('stores full recipe details in a Gun-safe representation', async () => {
    const dom = createDom(
      'https://example.com/recipe-book/?book=stephens-family&list=weekly-groceries'
    );
    const gun = createGunMock();
    const documentRef = dom.window.document;

    initRecipeBook({ Gun: gun.Gun, document: documentRef, window: dom.window });
    documentRef.getElementById('recipe-title').value = 'Weeknight lemon chicken';
    documentRef.getElementById('recipe-description').value = 'Reliable family dinner';
    documentRef.getElementById('recipe-servings').value = '4';
    documentRef.getElementById('recipe-ingredients').value =
      '1 1/2 lb | chicken thighs | Meat\n2 | lemons | Produce';
    documentRef.getElementById('recipe-directions').value =
      'Heat oven to 425°F.\nRoast until chicken reaches 165°F.';
    documentRef
      .getElementById('recipe-form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await vi.runAllTimersAsync();

    const savedRecipe = gun.puts.find(
      ({ value }) => value?.title === 'Weeknight lemon chicken'
    )?.value;
    expect(JSON.parse(savedRecipe.ingredientsJson)).toHaveLength(2);
    expect(JSON.parse(savedRecipe.directionsJson)).toEqual([
      'Heat oven to 425°F.',
      'Roast until chicken reaches 165°F.',
    ]);
    expect(savedRecipe).toMatchObject({
      description: 'Reliable family dinner',
      servings: '4',
    });
  });

  it('writes recipe ingredients into the exact shared shopping-list paths', async () => {
    const gun = createGunMock();
    const recipe = {
      id: 'lemon-chicken',
      title: 'Weeknight lemon chicken',
      ingredients: [
        { quantity: '1 1/2 lb', name: 'chicken thighs', category: 'Meat' },
        { quantity: '2', name: 'lemons', category: 'Produce' },
      ],
    };

    const ids = await addIngredientsToShoppingList({
      gun: gun.Gun(),
      listId: 'weekly-groceries',
      recipe,
      now: () => 1722000000000,
      random: () => 0.42,
    });

    expect(ids).toHaveLength(2);
    expect(
      gun.puts.filter(
        ({ path }) =>
          path.slice(0, -1).join('/') === 'shopping-list/weekly-groceries/items'
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: expect.objectContaining({
            name: 'chicken thighs',
            quantity: '1 1/2 lb',
            category: 'Meat',
            sourceRecipeTitle: 'Weeknight lemon chicken',
          }),
        }),
        expect.objectContaining({
          value: expect.objectContaining({
            name: 'lemons',
            quantity: '2',
            category: 'Produce',
          }),
        }),
      ])
    );
    expect(
      pathWasRequested(gun.paths, [
        'shopping-list',
        'weekly-groceries',
        'item-index',
      ])
    ).toBe(true);
  });
});
