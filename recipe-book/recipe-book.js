const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
const gun = Gun({ peers: [RELAY_URL], localStorage: true });

const form = document.getElementById('recipe-form');
const formTitle = document.getElementById('recipe-form-title');
const nameInput = document.getElementById('recipe-name');
const categoryInput = document.getElementById('recipe-category');
const servingsInput = document.getElementById('recipe-servings');
const timeInput = document.getElementById('recipe-time');
const ingredientsInput = document.getElementById('recipe-ingredients');
const stepsInput = document.getElementById('recipe-steps');
const sourceInput = document.getElementById('recipe-source');
const submitButton = document.getElementById('recipe-submit');
const cancelButton = document.getElementById('recipe-cancel');
const list = document.getElementById('recipe-list');
const emptyState = document.getElementById('recipe-empty');

const recipes = gun.get('recipe-book').get('recipes');
const cache = new Map();
let editingId = null;

const splitLines = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const renderRecipes = () => {
  const items = Array.from(cache.values()).filter((entry) => entry && entry.name);
  items.sort((a, b) => {
    const timeA = a.updatedAt ?? a.createdAt ?? 0;
    const timeB = b.updatedAt ?? b.createdAt ?? 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return a.name.localeCompare(b.name);
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
    title.textContent = entry.name;

    const meta = document.createElement('div');
    meta.className = 'meal-meta';

    const categoryTag = document.createElement('span');
    categoryTag.className = 'meal-tag';
    categoryTag.textContent = entry.category || 'Recipe';

    meta.appendChild(categoryTag);

    if (entry.servings) {
      const servingsTag = document.createElement('span');
      servingsTag.className = 'meal-date';
      servingsTag.textContent = `${entry.servings} servings`;
      meta.appendChild(servingsTag);
    }

    if (entry.totalTime) {
      const timeTag = document.createElement('span');
      timeTag.className = 'meal-date';
      timeTag.textContent = entry.totalTime;
      meta.appendChild(timeTag);
    }

    header.append(title, meta);

    const details = document.createElement('div');
    details.className = 'recipe-details';

    if (entry.ingredients?.length) {
      const ingredients = document.createElement('div');
      ingredients.className = 'recipe-section';

      const heading = document.createElement('h5');
      heading.textContent = 'Ingredients';

      const listEl = document.createElement('ul');
      listEl.className = 'recipe-list';
      entry.ingredients.forEach((item) => {
        const liItem = document.createElement('li');
        liItem.textContent = item;
        listEl.appendChild(liItem);
      });

      ingredients.append(heading, listEl);
      details.appendChild(ingredients);
    }

    if (entry.steps?.length) {
      const steps = document.createElement('div');
      steps.className = 'recipe-section';

      const heading = document.createElement('h5');
      heading.textContent = 'Instructions';

      const listEl = document.createElement('ol');
      listEl.className = 'recipe-list';
      entry.steps.forEach((item) => {
        const liItem = document.createElement('li');
        liItem.textContent = item;
        listEl.appendChild(liItem);
      });

      steps.append(heading, listEl);
      details.appendChild(steps);
    }

    if (entry.source) {
      const source = document.createElement('div');
      source.className = 'recipe-source';

      const sourceLabel = document.createElement('span');
      sourceLabel.textContent = 'Source:';

      const sourceLink = document.createElement('a');
      sourceLink.href = entry.source;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.textContent = entry.source;

      source.append(sourceLabel, sourceLink);
      details.appendChild(source);
    }

    const actions = document.createElement('div');
    actions.className = 'meal-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'meal-action-btn meal-action-btn--edit';
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit ${entry.name}`);
    editButton.addEventListener('click', () => {
      setFormState(entry);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'meal-action-btn meal-action-btn--danger';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${entry.name}`);
    deleteButton.addEventListener('click', () => {
      const shouldDelete = window.confirm(`Delete "${entry.name}" from the recipe book?`);
      if (!shouldDelete) {
        return;
      }
      cache.delete(entry.id);
      recipes.get(entry.id).put(null);
      renderRecipes();
    });

    actions.append(editButton, deleteButton);

    li.append(header, details, actions);
    list.appendChild(li);
  }
};

const resetForm = () => {
  editingId = null;
  formTitle.textContent = 'New recipe';
  submitButton.textContent = 'Save recipe';
  cancelButton.hidden = true;
  form.reset();
  categoryInput.value = 'Dinner';
};

const setFormState = (entry) => {
  if (!entry) {
    resetForm();
    return;
  }

  editingId = entry.id;
  formTitle.textContent = 'Edit recipe';
  submitButton.textContent = 'Update recipe';
  cancelButton.hidden = false;
  nameInput.value = entry.name || '';
  categoryInput.value = entry.category || 'Dinner';
  servingsInput.value = entry.servings || '';
  timeInput.value = entry.totalTime || '';
  ingredientsInput.value = (entry.ingredients || []).join('\n');
  stepsInput.value = (entry.steps || []).join('\n');
  sourceInput.value = entry.source || '';
  nameInput.focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

recipes.map().on((data, key) => {
  if (!data) {
    cache.delete(key);
    renderRecipes();
    return;
  }

  cache.set(key, {
    id: key,
    name: data.name,
    category: data.category,
    servings: data.servings,
    totalTime: data.totalTime,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
    source: data.source,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });

  renderRecipes();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const servings = servingsInput.value.trim();
  const totalTime = timeInput.value.trim();
  const ingredients = splitLines(ingredientsInput.value);
  const steps = splitLines(stepsInput.value);
  const source = sourceInput.value.trim();

  if (!name || !category || ingredients.length === 0 || steps.length === 0) {
    return;
  }

  const payload = {
    name,
    category,
    servings,
    totalTime,
    ingredients,
    steps,
    source,
    updatedAt: Date.now(),
  };

  if (editingId) {
    const existing = cache.get(editingId);
    recipes.get(editingId).put({
      ...payload,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    resetForm();
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  recipes.get(id).put({
    ...payload,
    createdAt: Date.now(),
  });

  form.reset();
  categoryInput.value = 'Dinner';
});

cancelButton.addEventListener('click', () => {
  resetForm();
});

if (!categoryInput.value) {
  categoryInput.value = 'Dinner';
}
