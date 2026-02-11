import { describe, it, expect, beforeEach } from 'vitest';
import { initAppSearch } from '../app-search.js';

const setupDom = () => {
  document.body.innerHTML = `
    <label for="app-search-input">Search apps</label>
    <input id="app-search-input" data-app-search-input />
    <p hidden data-app-search-empty>No apps matched your search.</p>
    <a data-app-search-card>Shopping List</a>
    <a data-app-search-card>Meal Tracker</a>
    <a data-app-search-card>Open Source Projects</a>
  `;

  return {
    input: document.querySelector('[data-app-search-input]'),
    emptyState: document.querySelector('[data-app-search-empty]'),
    cards: Array.from(document.querySelectorAll('[data-app-search-card]'))
  };
};

describe('app search', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows all app cards when the query is empty', () => {
    const { input, cards } = setupDom();
    const { applyFilter } = initAppSearch();

    input.value = '';
    const visibleCount = applyFilter();

    expect(visibleCount).toBe(cards.length);
    cards.forEach((card) => {
      expect(card.hidden).toBe(false);
    });
  });

  it('filters app cards by query text', () => {
    const { input, cards } = setupDom();
    initAppSearch();

    input.value = 'meal';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(cards[0].hidden).toBe(true);
    expect(cards[1].hidden).toBe(false);
    expect(cards[2].hidden).toBe(true);
  });

  it('shows the empty message when no app cards match', () => {
    const { input, emptyState } = setupDom();
    initAppSearch();

    input.value = 'astro physics';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(emptyState.hidden).toBe(false);
  });
});
