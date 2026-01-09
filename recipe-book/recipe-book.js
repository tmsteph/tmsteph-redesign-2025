const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';

export const initRecipeBook = ({
  Gun: GunLib = globalThis.Gun,
  document: documentRef = globalThis.document,
  window: windowRef = globalThis.window,
} = {}) => {
  if (!GunLib || !documentRef || !windowRef) {
    return null;
  }

  const getStorage = () => {
    try {
      return windowRef.localStorage;
    } catch (error) {
      return null;
    }
  };

  const params = new URLSearchParams(windowRef.location.search);
  let bookId = params.get('book');
  const storage = getStorage();

  if (!bookId && storage) {
    bookId = storage.getItem('recipeBookId');
  }

  if (!bookId) {
    bookId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  if (storage) {
    storage.setItem('recipeBookId', bookId);
  }

  params.set('book', bookId);
  const shareUrl = new URL(windowRef.location.href);
  shareUrl.search = params.toString();
  windowRef.history.replaceState({}, '', shareUrl);

  const gun = GunLib({ peers: [RELAY_URL], localStorage: true });
  const recipes = gun.get('recipe-book').get(bookId).get('recipes');

  const form = documentRef.getElementById('recipe-form');
  const formTitle = documentRef.getElementById('recipe-form-title');
  const nameInput = documentRef.getElementById('recipe-name');
  const categoryInput = documentRef.getElementById('recipe-category');
  const servingsInput = documentRef.getElementById('recipe-servings');
  const timeInput = documentRef.getElementById('recipe-time');
  const ingredientsInput = documentRef.getElementById('recipe-ingredients');
  const stepsInput = documentRef.getElementById('recipe-steps');
  const sourceInput = documentRef.getElementById('recipe-source');
  const submitButton = documentRef.getElementById('recipe-submit');
  const cancelButton = documentRef.getElementById('recipe-cancel');
  const list = documentRef.getElementById('recipe-list');
  const emptyState = documentRef.getElementById('recipe-empty');
  const shareInput = documentRef.getElementById('recipe-share-link');
  const shareCopyButton = documentRef.getElementById('recipe-share-copy');
  const shareStatus = documentRef.getElementById('recipe-share-status');

  if (shareInput) {
    shareInput.value = shareUrl.toString();
  }

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
      const li = documentRef.createElement('li');
      li.className = 'meal-card';

      const header = documentRef.createElement('div');
      header.className = 'meal-card__header';

      const title = documentRef.createElement('h4');
      title.textContent = entry.name;

      const meta = documentRef.createElement('div');
      meta.className = 'meal-meta';

      const categoryTag = documentRef.createElement('span');
      categoryTag.className = 'meal-tag';
      categoryTag.textContent = entry.category || 'Recipe';

      meta.appendChild(categoryTag);

      if (entry.servings) {
        const servingsTag = documentRef.createElement('span');
        servingsTag.className = 'meal-date';
        servingsTag.textContent = `${entry.servings} servings`;
        meta.appendChild(servingsTag);
      }

      if (entry.totalTime) {
        const timeTag = documentRef.createElement('span');
        timeTag.className = 'meal-date';
        timeTag.textContent = entry.totalTime;
        meta.appendChild(timeTag);
      }

      header.append(title, meta);

      const details = documentRef.createElement('div');
      details.className = 'recipe-details';

      if (entry.ingredients?.length) {
        const ingredients = documentRef.createElement('div');
        ingredients.className = 'recipe-section';

        const heading = documentRef.createElement('h5');
        heading.textContent = 'Ingredients';

        const listEl = documentRef.createElement('ul');
        listEl.className = 'recipe-list';
        entry.ingredients.forEach((item) => {
          const liItem = documentRef.createElement('li');
          liItem.textContent = item;
          listEl.appendChild(liItem);
        });

        ingredients.append(heading, listEl);
        details.appendChild(ingredients);
      }

      if (entry.steps?.length) {
        const steps = documentRef.createElement('div');
        steps.className = 'recipe-section';

        const heading = documentRef.createElement('h5');
        heading.textContent = 'Instructions';

        const listEl = documentRef.createElement('ol');
        listEl.className = 'recipe-list';
        entry.steps.forEach((item) => {
          const liItem = documentRef.createElement('li');
          liItem.textContent = item;
          listEl.appendChild(liItem);
        });

        steps.append(heading, listEl);
        details.appendChild(steps);
      }

      if (entry.source) {
        const source = documentRef.createElement('div');
        source.className = 'recipe-source';

        const sourceLabel = documentRef.createElement('span');
        sourceLabel.textContent = 'Source:';

        const sourceLink = documentRef.createElement('a');
        sourceLink.href = entry.source;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = entry.source;

        source.append(sourceLabel, sourceLink);
        details.appendChild(source);
      }

      const actions = documentRef.createElement('div');
      actions.className = 'meal-actions';

      const editButton = documentRef.createElement('button');
      editButton.type = 'button';
      editButton.className = 'meal-action-btn meal-action-btn--edit';
      editButton.textContent = 'Edit';
      editButton.setAttribute('aria-label', `Edit ${entry.name}`);
      editButton.addEventListener('click', () => {
        setFormState(entry);
      });

      const deleteButton = documentRef.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'meal-action-btn meal-action-btn--danger';
      deleteButton.textContent = 'Delete';
      deleteButton.setAttribute('aria-label', `Delete ${entry.name}`);
      deleteButton.addEventListener('click', () => {
        const shouldDelete = windowRef.confirm(`Delete "${entry.name}" from the recipe book?`);
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

  shareCopyButton?.addEventListener('click', async () => {
    if (!shareInput) {
      return;
    }

    try {
      await windowRef.navigator?.clipboard?.writeText(shareInput.value);
      shareStatus.textContent = 'Link copied!';
      return;
    } catch (error) {
      shareInput.focus();
      shareInput.select();
      const copied = documentRef.execCommand('copy');
      shareStatus.textContent = copied ? 'Link copied!' : 'Copy failed. Select and copy manually.';
    }
  });

  if (!categoryInput.value) {
    categoryInput.value = 'Dinner';
  }

  return {};
};

if (typeof window !== 'undefined') {
  const startRecipeBook = (attempt = 0) => {
    const started = initRecipeBook();
    if (started) {
      return;
    }
    if (attempt < 20) {
      window.setTimeout(() => startRecipeBook(attempt + 1), 250);
    }
  };

  window.addEventListener('load', () => {
    startRecipeBook();
  });
}
