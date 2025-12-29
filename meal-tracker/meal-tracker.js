const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
const gun = Gun({ peers: [RELAY_URL], localStorage: true });

const form = document.getElementById('meal-form');
const typeInput = document.getElementById('meal-type');
const dateInput = document.getElementById('meal-date');
const menuInput = document.getElementById('meal-menu');
const list = document.getElementById('meal-list');
const emptyState = document.getElementById('meal-empty');

const entries = gun.get('meal-tracker').get('entries');
const cache = new Map();

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const renderMeals = () => {
  const items = Array.from(cache.values()).filter((entry) => entry && entry.date && entry.menu);
  items.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });

  list.innerHTML = '';

  if (items.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (const entry of items) {
    const li = document.createElement('li');
    li.className = 'meal-card';

    const header = document.createElement('div');
    header.className = 'meal-card__header';

    const title = document.createElement('h4');
    title.textContent = entry.menu;

    const meta = document.createElement('div');
    meta.className = 'meal-meta';

    const typeTag = document.createElement('span');
    typeTag.className = 'meal-tag';
    typeTag.textContent = entry.mealType || 'Meal';

    const dateTag = document.createElement('span');
    dateTag.className = 'meal-date';
    dateTag.textContent = formatDate(entry.date);

    meta.append(typeTag, dateTag);
    header.append(title, meta);

    li.appendChild(header);
    list.appendChild(li);
  }
};

entries.map().on((data, key) => {
  if (!data) {
    cache.delete(key);
    renderMeals();
    return;
  }

  cache.set(key, {
    id: key,
    mealType: data.mealType,
    date: data.date,
    menu: data.menu,
    createdAt: data.createdAt,
  });

  renderMeals();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const mealType = typeInput.value.trim();
  const date = dateInput.value;
  const menu = menuInput.value.trim();

  if (!mealType || !date || !menu) {
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  entries.get(id).put({
    mealType,
    date,
    menu,
    createdAt: Date.now(),
  });

  menuInput.value = '';
});

const today = new Date().toISOString().split('T')[0];
if (!dateInput.value) {
  dateInput.value = today;
}
