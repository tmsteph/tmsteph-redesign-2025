const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
const BOOK_PARAM = 'book';
const LIST_PARAM = 'list';
const BOOK_STORAGE_KEY = 'recipeBookId';
const LIST_STORAGE_KEY = 'shoppingListId';

const createSharedId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

const normalizeSharedId = (value) => {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
};

const normalizeHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const readStorage = (windowRef, key) => {
  try {
    return windowRef?.localStorage?.getItem(key) || '';
  } catch {
    return '';
  }
};

const writeStorage = (windowRef, key, value) => {
  try {
    windowRef?.localStorage?.setItem(key, value);
  } catch {
    // Share URLs remain the portable fallback when browser storage is unavailable.
  }
};

const resolveSharedId = ({ windowRef, url, param, storageKey, prefix }) => {
  const fromUrl = normalizeSharedId(url.searchParams.get(param));
  if (fromUrl) {
    writeStorage(windowRef, storageKey, fromUrl);
    return fromUrl;
  }

  const id =
    normalizeSharedId(readStorage(windowRef, storageKey)) || createSharedId(prefix);
  writeStorage(windowRef, storageKey, id);
  url.searchParams.set(param, id);
  return id;
};

const safeJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeCategory = (value) => {
  const category = String(value || '').trim();
  const known = ['Produce', 'Pantry', 'Dairy', 'Meat', 'Frozen', 'Household', 'Other'];
  return known.find((entry) => entry.toLowerCase() === category.toLowerCase()) || 'Other';
};

export const parseIngredientLines = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length >= 3) {
        return {
          quantity: parts[0],
          name: parts[1],
          category: normalizeCategory(parts[2]),
        };
      }
      if (parts.length === 2) {
        return { quantity: parts[0], name: parts[1], category: 'Other' };
      }
      return { quantity: '', name: parts[0], category: 'Other' };
    })
    .filter((ingredient) => ingredient.name);

export const formatIngredientLines = (ingredients) =>
  safeJsonArray(ingredients)
    .map(({ quantity = '', name = '', category = 'Other' }) => {
      if (!quantity && normalizeCategory(category) === 'Other') {
        return name;
      }
      return `${quantity} | ${name} | ${normalizeCategory(category)}`;
    })
    .join('\n');

export const parseDirectionLines = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const putWithAcknowledgement = (node, value, timeoutMs = 8_000) =>
  new Promise((resolve) => {
    let finished = false;
    const finish = (ack = {}) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(ack);
    };
    const timeout = setTimeout(() => finish({ timeout: true }), timeoutMs);
    node.put(value, finish);
  });

export const addIngredientsToShoppingList = async ({
  gun,
  listId,
  recipe,
  now = () => Date.now(),
  random = () => Math.random(),
}) => {
  const ingredients = safeJsonArray(recipe.ingredients);
  const root = gun.get('shopping-list').get(listId);
  const entries = root.get('items');
  const itemIndex = root.get('item-index');

  const writes = ingredients.map(async (ingredient, index) => {
    const timestamp = now();
    const id = `${timestamp}-${index}-${random().toString(16).slice(2, 8)}`;
    await putWithAcknowledgement(entries.get(id), {
      name: ingredient.name,
      quantity: ingredient.quantity || '',
      category: normalizeCategory(ingredient.category),
      neededBy: '',
      store: '',
      notes: `From recipe: ${recipe.title}`,
      sourceRecipeId: recipe.id,
      sourceRecipeTitle: recipe.title,
      createdAt: timestamp,
      purchased: false,
    });
    await putWithAcknowledgement(itemIndex, { [id]: true });
    return id;
  });
  return Promise.all(writes);
};

export const initRecipeBook = ({
  Gun: GunLib = globalThis.Gun,
  document: documentRef = globalThis.document,
  window: windowRef = documentRef?.defaultView ?? globalThis.window,
} = {}) => {
  if (!GunLib || !documentRef) {
    return null;
  }

  const currentUrl = new URL(windowRef?.location?.href || 'https://example.com/recipe-book/');
  const bookId = resolveSharedId({
    windowRef,
    url: currentUrl,
    param: BOOK_PARAM,
    storageKey: BOOK_STORAGE_KEY,
    prefix: 'book',
  });
  const listId = resolveSharedId({
    windowRef,
    url: currentUrl,
    param: LIST_PARAM,
    storageKey: LIST_STORAGE_KEY,
    prefix: 'list',
  });

  if (windowRef?.history?.replaceState) {
    windowRef.history.replaceState({}, '', currentUrl.toString());
  }

  const gun = GunLib({ peers: [RELAY_URL], localStorage: true });
  const bookRoot = gun.get('recipe-book').get(bookId);
  const recipes = bookRoot.get('recipes');
  const recipeIndex = bookRoot.get('recipe-index');
  const cache = new Map();
  const subscribedRecipes = new Set();

  const form = documentRef.getElementById('recipe-form');
  const formTitle = documentRef.getElementById('recipe-form-title');
  const titleInput = documentRef.getElementById('recipe-title');
  const urlInput = documentRef.getElementById('recipe-url');
  const descriptionInput = documentRef.getElementById('recipe-description');
  const servingsInput = documentRef.getElementById('recipe-servings');
  const prepTimeInput = documentRef.getElementById('recipe-prep-time');
  const cookTimeInput = documentRef.getElementById('recipe-cook-time');
  const ingredientsInput = documentRef.getElementById('recipe-ingredients');
  const directionsInput = documentRef.getElementById('recipe-directions');
  const submitButton = documentRef.getElementById('recipe-submit');
  const cancelButton = documentRef.getElementById('recipe-cancel');
  const list = documentRef.getElementById('recipe-list');
  const emptyState = documentRef.getElementById('recipe-empty');
  const searchInput = documentRef.getElementById('recipe-search');
  const shareInput = documentRef.getElementById('recipe-share-link');
  const copyButton = documentRef.getElementById('recipe-copy-link');
  const syncStatus = documentRef.getElementById('recipe-sync-status');
  const shoppingLink = documentRef.getElementById('recipe-shopping-link');
  let editingId = null;

  const shareUrl = currentUrl.toString();
  if (shareInput) {
    shareInput.value = shareUrl;
  }
  if (shoppingLink) {
    shoppingLink.href = `../shopping-list/?list=${encodeURIComponent(listId)}`;
  }

  const setStatus = (message) => {
    if (syncStatus) {
      syncStatus.textContent = message;
    }
  };

  const resetForm = () => {
    editingId = null;
    form?.reset();
    if (formTitle) formTitle.textContent = 'New recipe';
    if (submitButton) submitButton.textContent = 'Save recipe';
    if (cancelButton) cancelButton.hidden = true;
  };

  const setEditState = (recipe) => {
    editingId = recipe?.id || null;
    if (!recipe) {
      resetForm();
      return;
    }

    formTitle.textContent = 'Edit recipe';
    submitButton.textContent = 'Save changes';
    cancelButton.hidden = false;
    titleInput.value = recipe.title || '';
    urlInput.value = recipe.sourceUrl || '';
    descriptionInput.value = recipe.description || '';
    servingsInput.value = recipe.servings || '';
    prepTimeInput.value = recipe.prepTime || '';
    cookTimeInput.value = recipe.cookTime || '';
    ingredientsInput.value = formatIngredientLines(recipe.ingredients);
    directionsInput.value = safeJsonArray(recipe.directions).join('\n');
    titleInput.focus();
    form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const renderRecipes = () => {
    const query = searchInput?.value?.trim().toLowerCase() || '';
    const items = Array.from(cache.values())
      .filter((recipe) => recipe?.title)
      .filter((recipe) => {
        if (!query) return true;
        const searchable = [
          recipe.title,
          recipe.description,
          recipe.sourceUrl,
          ...safeJsonArray(recipe.ingredients).map((ingredient) => ingredient.name),
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    list.innerHTML = '';
    emptyState.hidden = items.length > 0;

    for (const recipe of items) {
      const card = documentRef.createElement('li');
      card.className = 'meal-card recipe-card';
      card.dataset.recipeId = recipe.id;

      const header = documentRef.createElement('div');
      header.className = 'meal-card__header';
      const title = documentRef.createElement('h4');
      title.textContent = recipe.title;
      const meta = documentRef.createElement('div');
      meta.className = 'meal-meta';
      for (const label of [recipe.servings && `${recipe.servings} servings`, recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`].filter(Boolean)) {
        const tag = documentRef.createElement('span');
        tag.className = 'meal-tag';
        tag.textContent = label;
        meta.appendChild(tag);
      }
      header.append(title, meta);
      card.appendChild(header);

      if (recipe.description) {
        const description = documentRef.createElement('p');
        description.textContent = recipe.description;
        card.appendChild(description);
      }

      const ingredients = safeJsonArray(recipe.ingredients);
      if (ingredients.length) {
        const heading = documentRef.createElement('strong');
        heading.textContent = 'Ingredients';
        const ingredientList = documentRef.createElement('ul');
        ingredientList.className = 'recipe-details';
        for (const ingredient of ingredients) {
          const row = documentRef.createElement('li');
          row.textContent = [ingredient.quantity, ingredient.name].filter(Boolean).join(' ');
          ingredientList.appendChild(row);
        }
        card.append(heading, ingredientList);
      }

      const directions = safeJsonArray(recipe.directions);
      if (directions.length) {
        const heading = documentRef.createElement('strong');
        heading.textContent = 'Directions';
        const directionList = documentRef.createElement('ol');
        directionList.className = 'recipe-details';
        for (const direction of directions) {
          const row = documentRef.createElement('li');
          row.textContent = direction;
          directionList.appendChild(row);
        }
        card.append(heading, directionList);
      }

      const actions = documentRef.createElement('div');
      actions.className = 'shopping-actions recipe-actions';

      if (recipe.sourceUrl) {
        const sourceLink = documentRef.createElement('a');
        sourceLink.className = 'shopping-action-btn';
        sourceLink.href = recipe.sourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.textContent = 'Open source';
        actions.appendChild(sourceLink);
      }

      if (ingredients.length) {
        const shoppingButton = documentRef.createElement('button');
        shoppingButton.type = 'button';
        shoppingButton.className = 'shopping-action-btn';
        shoppingButton.textContent = 'Add ingredients';
        shoppingButton.addEventListener('click', async () => {
          shoppingButton.disabled = true;
          setStatus(`Adding ${ingredients.length} ingredients…`);
          try {
            await addIngredientsToShoppingList({ gun, listId, recipe });
            setStatus(`${ingredients.length} ingredients added to the shared shopping list.`);
          } catch {
            setStatus('Ingredients could not be synced. Please try again.');
          } finally {
            shoppingButton.disabled = false;
          }
        });
        actions.appendChild(shoppingButton);
      }

      const planLink = documentRef.createElement('a');
      planLink.className = 'shopping-action-btn';
      const planParams = new URLSearchParams({
        menu: recipe.title,
        recipe: recipe.id,
        book: bookId,
      });
      planLink.href = `../meal-tracker/?${planParams.toString()}`;
      planLink.textContent = 'Plan meal';
      actions.appendChild(planLink);

      const editButton = documentRef.createElement('button');
      editButton.type = 'button';
      editButton.className = 'shopping-action-btn';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => setEditState(recipe));

      const deleteButton = documentRef.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'shopping-action-btn shopping-action-btn--ghost';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        const shouldDelete = windowRef?.confirm?.(`Delete "${recipe.title}" from this recipe book?`) ?? true;
        if (!shouldDelete) return;
        cache.delete(recipe.id);
        recipeIndex.put({ [recipe.id]: false });
        recipes.get(recipe.id).put(null);
        if (editingId === recipe.id) resetForm();
        renderRecipes();
      });

      actions.append(editButton, deleteButton);
      card.appendChild(actions);
      list.appendChild(card);
    }

    setStatus(`Synced ${cache.size} recipe${cache.size === 1 ? '' : 's'}.`);
  };

  const applyRecipeData = (data, key) => {
    if (!data) {
      cache.delete(key);
      renderRecipes();
      return;
    }
    cache.set(key, {
      id: key,
      title: data.title,
      sourceUrl: normalizeHttpUrl(data.sourceUrl),
      description: data.description,
      servings: data.servings,
      prepTime: data.prepTime,
      cookTime: data.cookTime,
      ingredients: safeJsonArray(data.ingredientsJson),
      directions: safeJsonArray(data.directionsJson),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    renderRecipes();
  };

  const subscribeToRecipe = (key) => {
    if (!key || subscribedRecipes.has(key)) return;
    subscribedRecipes.add(key);
    recipes.get(key).on((data) => applyRecipeData(data, key));
  };

  recipeIndex.map().on((active, key) => {
    if (!active) {
      cache.delete(key);
      renderRecipes();
      return;
    }
    subscribeToRecipe(key);
  });
  recipes.map().on((data, key) => applyRecipeData(data, key));

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;

    const existing = editingId ? cache.get(editingId) : null;
    const id = editingId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const timestamp = Date.now();
    submitButton.disabled = true;
    setStatus(`Saving “${title}”…`);
    try {
      await putWithAcknowledgement(recipes.get(id), {
        title,
        sourceUrl: normalizeHttpUrl(urlInput.value),
        description: descriptionInput.value.trim(),
        servings: servingsInput.value.trim(),
        prepTime: prepTimeInput.value.trim(),
        cookTime: cookTimeInput.value.trim(),
        ingredientsJson: JSON.stringify(parseIngredientLines(ingredientsInput.value)),
        directionsJson: JSON.stringify(parseDirectionLines(directionsInput.value)),
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      await putWithAcknowledgement(recipeIndex, { [id]: true });
      resetForm();
      setStatus(`Saved “${title}”.`);
    } catch {
      setStatus('Recipe could not be synced. Please try again.');
    } finally {
      submitButton.disabled = false;
    }
  });

  cancelButton?.addEventListener('click', resetForm);
  searchInput?.addEventListener('input', renderRecipes);
  copyButton?.addEventListener('click', async () => {
    try {
      if (windowRef?.navigator?.clipboard?.writeText) {
        await windowRef.navigator.clipboard.writeText(shareUrl);
      } else {
        shareInput?.select?.();
        if (!documentRef.execCommand?.('copy')) throw new Error('Clipboard unavailable');
      }
      setStatus('Family recipe-book link copied.');
    } catch {
      setStatus('Copy failed. Select the link above.');
    }
  });

  renderRecipes();
  return { bookId, listId, shareUrl };
};

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => initRecipeBook());
}
