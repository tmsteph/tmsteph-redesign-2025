const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
const gun = Gun({ peers: [RELAY_URL], localStorage: true });

const form = document.getElementById('shopping-form');
const nameInput = document.getElementById('item-name');
const quantityInput = document.getElementById('item-quantity');
const categoryInput = document.getElementById('item-category');
const dateInput = document.getElementById('item-date');
const storeInput = document.getElementById('item-store');
const notesInput = document.getElementById('item-notes');
const list = document.getElementById('shopping-list');
const emptyState = document.getElementById('shopping-empty');

const entries = gun.get('shopping-list').get('items');
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

const renderItems = () => {
  const items = Array.from(cache.values()).filter((entry) => entry && entry.name);
  items.sort((a, b) => {
    if (a.neededBy && b.neededBy) {
      return a.neededBy.localeCompare(b.neededBy);
    }
    if (a.neededBy) {
      return -1;
    }
    if (b.neededBy) {
      return 1;
    }
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });

  list.innerHTML = '';

  if (items.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'meal-card';

    const header = document.createElement('div');
    header.className = 'meal-card__header';

    const title = document.createElement('h4');
    title.textContent = item.quantity ? `${item.name} · ${item.quantity}` : item.name;

    const meta = document.createElement('div');
    meta.className = 'meal-meta';

    const categoryTag = document.createElement('span');
    categoryTag.className = 'meal-tag';
    categoryTag.textContent = item.category || 'General';

    meta.appendChild(categoryTag);

    if (item.neededBy) {
      const dateTag = document.createElement('span');
      dateTag.className = 'meal-date';
      dateTag.textContent = `Needed ${formatDate(item.neededBy)}`;
      meta.appendChild(dateTag);
    }

    header.append(title, meta);
    li.appendChild(header);

    const details = document.createElement('ul');
    details.className = 'cycle-card__details';

    if (item.store) {
      const storeLine = document.createElement('li');
      storeLine.textContent = `Store: ${item.store}`;
      details.appendChild(storeLine);
    }

    if (item.notes) {
      const notesLine = document.createElement('li');
      notesLine.textContent = `Notes: ${item.notes}`;
      details.appendChild(notesLine);
    }

    if (details.children.length > 0) {
      li.appendChild(details);
    }

    list.appendChild(li);
  }
};

entries.map().on((data, key) => {
  if (!data) {
    cache.delete(key);
    renderItems();
    return;
  }

  cache.set(key, {
    id: key,
    name: data.name,
    quantity: data.quantity,
    category: data.category,
    neededBy: data.neededBy,
    store: data.store,
    notes: data.notes,
    createdAt: data.createdAt,
  });

  renderItems();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const quantity = quantityInput.value.trim();
  const category = categoryInput.value.trim();
  const neededBy = dateInput.value;
  const store = storeInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name || !category) {
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  entries.get(id).put({
    name,
    quantity,
    category,
    neededBy,
    store,
    notes,
    createdAt: Date.now(),
  });

  nameInput.value = '';
  quantityInput.value = '';
  storeInput.value = '';
  notesInput.value = '';
});

const today = new Date().toISOString().split('T')[0];
if (!dateInput.value) {
  dateInput.value = today;
}
