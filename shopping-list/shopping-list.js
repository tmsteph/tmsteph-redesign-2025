const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';

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

export const initShoppingList = ({
  Gun: GunLib = globalThis.Gun,
  document: documentRef = globalThis.document,
} = {}) => {
  if (!GunLib || !documentRef) {
    return null;
  }

  const gun = GunLib({
    peers: [RELAY_URL],
    localStorage: true,
  });

  const form = documentRef.getElementById('shopping-form');
  const nameInput = documentRef.getElementById('item-name');
  const quantityInput = documentRef.getElementById('item-quantity');
  const categoryInput = documentRef.getElementById('item-category');
  const dateInput = documentRef.getElementById('item-date');
  const storeInput = documentRef.getElementById('item-store');
  const notesInput = documentRef.getElementById('item-notes');
  const formTitle = documentRef.getElementById('shopping-form-title');
  const submitButton = documentRef.getElementById('shopping-submit');
  const cancelButton = documentRef.getElementById('shopping-cancel');
  const list = documentRef.getElementById('shopping-list');
  const emptyState = documentRef.getElementById('shopping-empty');

  const entries = gun.get('shopping-list').get('items');
  const cache = new Map();
  let editingId = null;

  const resetForm = () => {
    form.reset();
    nameInput.value = '';
    quantityInput.value = '';
    storeInput.value = '';
    notesInput.value = '';
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  };

  const setEditState = (item) => {
    editingId = item?.id ?? null;
    if (editingId) {
      formTitle.textContent = 'Edit item';
      submitButton.textContent = 'Save changes';
      cancelButton.hidden = false;
    } else {
      formTitle.textContent = 'New item';
      submitButton.textContent = 'Add to list';
      cancelButton.hidden = true;
      resetForm();
    }
  };

  const renderItems = () => {
    const items = Array.from(cache.values()).filter((entry) => entry && entry.name);
    items.sort((a, b) => {
      if (a.purchased !== b.purchased) {
        return a.purchased ? 1 : -1;
      }
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
      const li = documentRef.createElement('li');
      li.className = 'meal-card';
      if (item.purchased) {
        li.classList.add('shopping-item--purchased');
      }

      const header = documentRef.createElement('div');
      header.className = 'meal-card__header';

      const title = documentRef.createElement('h4');
      title.textContent = item.quantity ? `${item.name} · ${item.quantity}` : item.name;

      const meta = documentRef.createElement('div');
      meta.className = 'meal-meta';

      const categoryTag = documentRef.createElement('span');
      categoryTag.className = 'meal-tag';
      categoryTag.textContent = item.category || 'General';

      meta.appendChild(categoryTag);

      if (item.neededBy) {
        const dateTag = documentRef.createElement('span');
        dateTag.className = 'meal-date';
        dateTag.textContent = `Needed ${formatDate(item.neededBy)}`;
        meta.appendChild(dateTag);
      }

      if (item.purchased) {
        const purchasedTag = documentRef.createElement('span');
        purchasedTag.className = 'meal-tag';
        purchasedTag.textContent = 'Purchased';
        meta.appendChild(purchasedTag);
      }

      header.append(title, meta);
      li.appendChild(header);

      const details = documentRef.createElement('ul');
      details.className = 'cycle-card__details';

      if (item.store) {
        const storeLine = documentRef.createElement('li');
        storeLine.textContent = `Store: ${item.store}`;
        details.appendChild(storeLine);
      }

      if (item.notes) {
        const notesLine = documentRef.createElement('li');
        notesLine.textContent = `Notes: ${item.notes}`;
        details.appendChild(notesLine);
      }

      if (details.children.length > 0) {
        li.appendChild(details);
      }

      const actions = documentRef.createElement('div');
      actions.className = 'shopping-actions';

      const toggleButton = documentRef.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'shopping-action-btn';
      toggleButton.textContent = item.purchased ? 'Mark unpurchased' : 'Mark purchased';
      toggleButton.addEventListener('click', () => {
        entries.get(item.id).put({
          purchased: !item.purchased,
          purchasedAt: !item.purchased ? Date.now() : null,
        });
      });

      const editButton = documentRef.createElement('button');
      editButton.type = 'button';
      editButton.className = 'shopping-action-btn';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        nameInput.value = item.name ?? '';
        quantityInput.value = item.quantity ?? '';
        categoryInput.value = item.category ?? 'Other';
        dateInput.value = item.neededBy ?? '';
        storeInput.value = item.store ?? '';
        notesInput.value = item.notes ?? '';
        setEditState(item);
        nameInput.focus();
      });

      const deleteButton = documentRef.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'shopping-action-btn shopping-action-btn--ghost';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        entries.get(item.id).put(null);
        if (editingId === item.id) {
          setEditState(null);
        }
      });

      actions.append(toggleButton, editButton, deleteButton);
      li.appendChild(actions);

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
      purchased: Boolean(data.purchased),
      purchasedAt: data.purchasedAt,
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

    if (editingId) {
      const existing = cache.get(editingId) ?? {};
      entries.get(editingId).put({
        name,
        quantity,
        category,
        neededBy,
        store,
        notes,
        createdAt: existing.createdAt ?? Date.now(),
        purchased: existing.purchased ?? false,
        purchasedAt: existing.purchasedAt ?? null,
      });
      setEditState(null);
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
    resetForm();
  });

  cancelButton.addEventListener('click', () => {
    setEditState(null);
  });

  const today = new Date().toISOString().split('T')[0];
  if (!dateInput.value) {
    dateInput.value = today;
  }

  return {};
};

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initShoppingList();
  });
}
