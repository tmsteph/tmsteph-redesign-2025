import { addDaysISO, todayISO } from './calm-utils.js';

export const TASK_DOMAINS = [
  'meals',
  'groceries',
  'dishes',
  'laundry',
  'trash',
  'child',
  'bedtime',
  'appointments',
  'bills',
  'cleaning',
  'repair',
  'health',
  'work'
];

export const MOOD_STATES = [
  'regulated',
  'tired',
  'overloaded',
  'needs space',
  'needs help',
  'needs listening',
  'needs plan',
  'repair needed'
];

export const REQUEST_TYPES = [
  'listen',
  'help',
  'space',
  'plan',
  'reassurance'
];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

export const RESET_ITEMS = [
  { id: 'kitchen', label: 'Kitchen reset' },
  { id: 'trash', label: 'Trash checked' },
  { id: 'laundry', label: 'Laundry noticed' },
  { id: 'child-supplies', label: 'Child supplies ready' },
  { id: 'tomorrow-meal', label: "Tomorrow's meal checked" }
];

export function createInitialState(now = new Date()) {
  const selectedDate = todayISO(now);
  return {
    version: 1,
    selectedDate,
    settings: {
      householdName: 'Home',
      selfName: 'Me',
      demoMode: true
    },
    tasks: [
      {
        id: 'task_seed_dinners',
        title: 'Pick three simple dinners',
        domain: 'meals',
        owner: 'Me',
        status: 'open',
        dueDate: selectedDate,
        recurrence: 'weekly',
        visiblePromise: 'I will choose three dinners and generate the grocery list.',
        notes: '',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      },
      {
        id: 'task_seed_reset',
        title: 'Do a 15-minute kitchen reset',
        domain: 'cleaning',
        owner: 'Me',
        status: 'open',
        dueDate: selectedDate,
        recurrence: 'daily',
        visiblePromise: 'I will make the kitchen easier to walk into tonight.',
        notes: '',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      }
    ],
    mealPlan: [],
    checkIns: [],
    supportMaps: [],
    repairs: [
      {
        id: 'repair_seed_next_step',
        eventLabel: 'Choose one repair',
        whatIOwn: 'I can make one small concrete action visible today.',
        impact: '',
        repairAction: 'Name the next honest step and do it before the day gets crowded.',
        nextAction: 'Pick one thing from the Owned by Me board.',
        status: 'open',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      }
    ],
    shoppingItems: [],
    handledLogs: [],
    resetChecks: {}
  };
}

export function migrateState(rawState, now = new Date()) {
  const seed = createInitialState(now);
  if (!rawState || typeof rawState !== 'object') {
    return seed;
  }

  return {
    ...seed,
    ...rawState,
    settings: {
      ...seed.settings,
      ...(rawState.settings || {})
    },
    tasks: Array.isArray(rawState.tasks) ? rawState.tasks : seed.tasks,
    mealPlan: Array.isArray(rawState.mealPlan) ? rawState.mealPlan : [],
    checkIns: Array.isArray(rawState.checkIns) ? rawState.checkIns : [],
    supportMaps: Array.isArray(rawState.supportMaps) ? rawState.supportMaps : [],
    repairs: Array.isArray(rawState.repairs) ? rawState.repairs : seed.repairs,
    shoppingItems: Array.isArray(rawState.shoppingItems) ? rawState.shoppingItems : [],
    handledLogs: Array.isArray(rawState.handledLogs) ? rawState.handledLogs : [],
    resetChecks: rawState.resetChecks && typeof rawState.resetChecks === 'object' ? rawState.resetChecks : {}
  };
}

export function getWeekDates(anchorDate = todayISO()) {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const day = Number.isNaN(anchor.getTime()) ? 0 : anchor.getDay();
  const sunday = addDaysISO(anchorDate, -day);
  return Array.from({ length: 7 }, (_value, index) => addDaysISO(sunday, index));
}

export function getTodayTasks(tasks = [], selectedDate = todayISO()) {
  return tasks.filter((task) => {
    if (task.deletedAt || task.status === 'done') return false;
    if (!task.dueDate) return true;
    return task.dueDate <= selectedDate;
  });
}

export function getOpenRepair(repairs = []) {
  return repairs.find((repair) => !repair.deletedAt && repair.status !== 'complete') || null;
}

export function getLatestCheckIn(checkIns = []) {
  return [...checkIns]
    .filter((entry) => !entry.deletedAt)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
}

export function getMealsForDate(mealPlan = [], selectedDate = todayISO()) {
  return mealPlan
    .filter((entry) => !entry.deletedAt && entry.date === selectedDate)
    .sort((a, b) => MEAL_SLOTS.indexOf(a.mealSlot) - MEAL_SLOTS.indexOf(b.mealSlot));
}

export function generateShoppingItems(mealEntries = [], meals = []) {
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]));
  const ingredients = new Map();

  mealEntries.forEach((entry) => {
    [entry.mealId, entry.fallbackMealId].filter(Boolean).forEach((mealId) => {
      const meal = mealsById.get(mealId);
      if (!meal) return;
      meal.ingredients.forEach((ingredient) => {
        const key = `${ingredient.name.toLowerCase()}::${ingredient.category || 'Other'}`;
        if (!ingredients.has(key)) {
          ingredients.set(key, {
            name: ingredient.name,
            category: ingredient.category || 'Other',
            quantity: '',
            sourceMeals: [meal.name],
            purchased: false
          });
          return;
        }
        const existing = ingredients.get(key);
        if (!existing.sourceMeals.includes(meal.name)) {
          existing.sourceMeals.push(meal.name);
        }
      });
    });
  });

  return Array.from(ingredients.values()).sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    return categoryCompare || a.name.localeCompare(b.name);
  });
}
