import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  generateShoppingItems,
  getTodayTasks,
  getWeekDates
} from '../assets/js/calm-models.js';

describe('calm structure models', () => {
  it('creates initial state with a selected date and seed ownership tasks', () => {
    const state = createInitialState(new Date('2026-06-01T12:00:00Z'));

    expect(state.selectedDate).toBe('2026-06-01');
    expect(state.tasks.map((task) => task.title)).toContain('Pick three simple dinners');
    expect(state.repairs[0].status).toBe('open');
  });

  it('finds open tasks due today without returning completed tasks', () => {
    const tasks = [
      { title: 'Due', status: 'open', dueDate: '2026-06-01' },
      { title: 'Past', status: 'open', dueDate: '2026-05-31' },
      { title: 'Done', status: 'done', dueDate: '2026-06-01' },
      { title: 'Future', status: 'open', dueDate: '2026-06-02' }
    ];

    expect(getTodayTasks(tasks, '2026-06-01').map((task) => task.title)).toEqual(['Due', 'Past']);
  });

  it('generates deduplicated grocery items from meals and fallbacks', () => {
    const meals = [
      {
        id: 'toast',
        name: 'Toast',
        ingredients: [
          { name: 'Bread', category: 'Bakery' },
          { name: 'Eggs', category: 'Dairy' }
        ]
      },
      {
        id: 'eggs',
        name: 'Egg Plate',
        ingredients: [
          { name: 'Eggs', category: 'Dairy' },
          { name: 'Greens', category: 'Produce' }
        ]
      }
    ];

    const items = generateShoppingItems([
      { mealId: 'toast', fallbackMealId: 'eggs' }
    ], meals);

    expect(items.map((item) => item.name)).toEqual(['Bread', 'Eggs', 'Greens']);
    expect(items.find((item) => item.name === 'Eggs')?.sourceMeals).toEqual(['Toast', 'Egg Plate']);
  });

  it('returns a Sunday-start week for the selected date', () => {
    expect(getWeekDates('2026-06-03')).toEqual([
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06'
    ]);
  });
});
