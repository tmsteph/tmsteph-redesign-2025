const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
const GUEST_PARAM = 'journal';
const GUEST_STORAGE_KEY = 'journalGuestId';

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

const buildGuestId = () =>
  `guest-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

const getGuestIdFromUrl = () => {
  const url = new URL(window.location.href);
  const existing = url.searchParams.get(GUEST_PARAM);
  if (existing) {
    try {
      window.localStorage.setItem(GUEST_STORAGE_KEY, existing);
    } catch (err) {
      // ignore storage errors
    }
    return existing;
  }

  let stored = null;
  try {
    stored = window.localStorage.getItem(GUEST_STORAGE_KEY);
  } catch (err) {
    // ignore storage errors
  }

  const nextId = stored || buildGuestId();
  url.searchParams.set(GUEST_PARAM, nextId);
  window.history.replaceState({}, '', url.toString());
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, nextId);
  } catch (err) {
    // ignore storage errors
  }
  return nextId;
};

const setGuestIdInUrl = (guestId) => {
  const url = new URL(window.location.href);
  url.searchParams.set(GUEST_PARAM, guestId);
  window.history.replaceState({}, '', url.toString());
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, guestId);
  } catch (err) {
    // ignore storage errors
  }
};

const normalizeTags = (value) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const createAuthHelper = (user) => {
  const authWithRemember = (alias, password, callback) => {
    if (typeof user?.auth !== 'function') {
      callback({ err: 'Login unavailable. Please refresh and try again.' });
      return;
    }
    const options = { remember: true };
    let settled = false;
    const wrapped = (ack) => {
      if (settled) return;
      settled = true;
      callback(ack);
    };

    try {
      user.auth(alias, password, wrapped, options);
    } catch (err) {
      // ignore
    }

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(() => {
        try {
          user.auth(alias, password, options, wrapped);
        } catch (err) {
          // ignore
        }
      }, 50);
    } else {
      try {
        user.auth(alias, password, options, wrapped);
      } catch (err) {
        // ignore
      }
    }
  };

  return { authWithRemember };
};

const initJournal = () => {
  const GunLib = window.Gun;
  if (!GunLib) {
    return;
  }

  const gun = GunLib({
    peers: [RELAY_URL],
    localStorage: true,
  });
  const user = typeof gun.user === 'function' ? gun.user() : null;
  const auth = createAuthHelper(user);

  const modeTitle = document.getElementById('journal-mode-title');
  const modeDescription = document.getElementById('journal-mode-description');
  const shareLink = document.getElementById('journal-share-link');
  const newGuestButton = document.getElementById('journal-new-guest');
  const copyLinkButton = document.getElementById('journal-copy-link');
  const logoutButton = document.getElementById('journal-logout');

  const authForm = document.getElementById('journal-auth-form');
  const aliasInput = document.getElementById('journal-alias');
  const passwordInput = document.getElementById('journal-password');
  const authMessage = document.getElementById('journal-auth-message');

  const form = document.getElementById('journal-form');
  const formTitle = document.getElementById('journal-form-title');
  const titleInput = document.getElementById('journal-title');
  const dateInput = document.getElementById('journal-date');
  const typeInput = document.getElementById('journal-type');
  const moodInput = document.getElementById('journal-mood');
  const tagsInput = document.getElementById('journal-tags');
  const bodyInput = document.getElementById('journal-body');
  const nextInput = document.getElementById('journal-next');
  const submitButton = document.getElementById('journal-submit');
  const cancelButton = document.getElementById('journal-cancel');

  const list = document.getElementById('journal-list');
  const emptyState = document.getElementById('journal-empty');
  const filterType = document.getElementById('journal-filter-type');
  const searchInput = document.getElementById('journal-search');

  const guestId = getGuestIdFromUrl();
  const cache = new Map();
  let editingId = null;
  let entriesNode = null;
  let activeMode = 'guest';

  const updateShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set(GUEST_PARAM, guestId);
    shareLink.textContent = `Share link: ${url.toString()}`;
    shareLink.dataset.url = url.toString();
  };

  const setAuthMessage = (message, type = 'muted') => {
    authMessage.textContent = message;
    authMessage.dataset.state = type;
  };

  const resetForm = () => {
    editingId = null;
    formTitle.textContent = 'New entry';
    submitButton.textContent = 'Save entry';
    cancelButton.hidden = true;
    form.reset();
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  };

  const setEditState = (entry) => {
    if (!entry) {
      resetForm();
      return;
    }
    editingId = entry.id;
    formTitle.textContent = 'Edit entry';
    submitButton.textContent = 'Save changes';
    cancelButton.hidden = false;
    titleInput.value = entry.title ?? '';
    dateInput.value = entry.date ?? new Date().toISOString().split('T')[0];
    typeInput.value = entry.entryType ?? 'Journal';
    moodInput.value = entry.mood ?? '';
    tagsInput.value = (entry.tags ?? []).join(', ');
    bodyInput.value = entry.body ?? '';
    nextInput.value = entry.nextStep ?? '';
    bodyInput.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderEntries = () => {
    const items = Array.from(cache.values()).filter((entry) => entry && entry.date && entry.body);
    const typeFilter = filterType?.value ?? 'all';
    const searchTerm = (searchInput?.value ?? '').trim().toLowerCase();

    const filtered = items.filter((entry) => {
      if (typeFilter !== 'all' && entry.entryType !== typeFilter) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const haystack = [
        entry.title,
        entry.body,
        entry.mood,
        entry.nextStep,
        ...(entry.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });

    filtered.sort((a, b) => {
      if (a.date !== b.date) {
        return (b.date ?? '').localeCompare(a.date ?? '');
      }
      return (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0);
    });

    list.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    for (const entry of filtered) {
      const li = document.createElement('li');
      li.className = 'meal-card journal-entry';
      if (entry.entryType === 'Idea') {
        li.classList.add('journal-entry--idea');
      } else if (entry.entryType === 'Project') {
        li.classList.add('journal-entry--project');
      }

      const header = document.createElement('div');
      header.className = 'meal-card__header';

      const title = document.createElement('h4');
      title.textContent = entry.title || entry.entryType || 'Entry';

      const meta = document.createElement('div');
      meta.className = 'meal-meta';

      const typeTag = document.createElement('span');
      typeTag.className = 'meal-tag';
      typeTag.textContent = entry.entryType || 'Journal';
      meta.appendChild(typeTag);

      const dateTag = document.createElement('span');
      dateTag.className = 'meal-date';
      dateTag.textContent = formatDate(entry.date);
      meta.appendChild(dateTag);

      if (entry.mood) {
        const moodTag = document.createElement('span');
        moodTag.className = 'meal-tag';
        moodTag.textContent = entry.mood;
        meta.appendChild(moodTag);
      }

      header.append(title, meta);
      li.appendChild(header);

      const body = document.createElement('p');
      body.className = 'journal-body';
      body.textContent = entry.body;
      li.appendChild(body);

      if (entry.tags && entry.tags.length > 0) {
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'journal-tags';
        entry.tags.forEach((tag) => {
          const tagEl = document.createElement('span');
          tagEl.className = 'journal-tag';
          tagEl.textContent = tag;
          tagsWrap.appendChild(tagEl);
        });
        li.appendChild(tagsWrap);
      }

      if (entry.nextStep) {
        const next = document.createElement('div');
        next.className = 'journal-next';
        const nextLabel = document.createElement('strong');
        nextLabel.textContent = 'Next step:';
        const nextText = document.createElement('span');
        nextText.textContent = ` ${entry.nextStep}`;
        next.append(nextLabel, nextText);
        li.appendChild(next);
      }

      const actions = document.createElement('div');
      actions.className = 'shopping-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'shopping-action-btn';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        setEditState(entry);
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'shopping-action-btn shopping-action-btn--ghost';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        const shouldDelete = window.confirm('Delete this entry?');
        if (!shouldDelete) {
          return;
        }
        entriesNode.get(entry.id).put(null);
        if (editingId === entry.id) {
          resetForm();
        }
      });

      actions.append(editButton, deleteButton);
      li.appendChild(actions);

      list.appendChild(li);
    }
  };

  const bindEntries = (node) => {
    if (!node) {
      return;
    }
    if (entriesNode?.off) {
      entriesNode.off();
    }
    entriesNode = node;
    cache.clear();
    renderEntries();

    node.map().on((data, key) => {
      if (!data) {
        cache.delete(key);
        renderEntries();
        return;
      }

      cache.set(key, {
        id: key,
        title: data.title,
        date: data.date,
        entryType: data.entryType,
        mood: data.mood,
        tags: typeof data.tags === 'string' ? normalizeTags(data.tags) : [],
        body: data.body,
        nextStep: data.nextStep,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });

      renderEntries();
    });
  };

  const setMode = (mode) => {
    activeMode = mode;
    if (mode === 'account') {
      const alias = user?.is?.alias || user?._?.alias;
      modeTitle.textContent = alias ? `${alias}'s journal` : 'Personal journal';
      modeDescription.textContent = 'Entries are synced to your account across devices.';
      newGuestButton.hidden = true;
      copyLinkButton.hidden = true;
      shareLink.hidden = true;
      logoutButton.hidden = false;
      authForm.classList.add('is-hidden');
    } else {
      modeTitle.textContent = 'Guest journal';
      modeDescription.textContent = 'Share this link to keep your guest journal in sync across devices.';
      newGuestButton.hidden = false;
      copyLinkButton.hidden = false;
      shareLink.hidden = false;
      logoutButton.hidden = true;
      authForm.classList.remove('is-hidden');
    }
  };

  const useGuestJournal = () => {
    setMode('guest');
    updateShareLink();
    bindEntries(gun.get('journal-guest').get(guestId).get('entries'));
  };

  const useAccountJournal = () => {
    if (!user || !user.is) {
      useGuestJournal();
      return;
    }
    setMode('account');
    bindEntries(user.get('journal').get('entries'));
  };

  const refreshAuthState = () => {
    if (user?.is) {
      useAccountJournal();
      return;
    }
    useGuestJournal();
  };

  const scheduleAuthCheck = () => {
    let attempts = 0;
    const tick = () => {
      if (user?.is) {
        refreshAuthState();
        return;
      }
      attempts += 1;
      if (attempts >= 10) {
        refreshAuthState();
        return;
      }
      window.setTimeout(tick, 300);
    };
    tick();
  };

  if (typeof gun.on === 'function') {
    gun.on('auth', () => {
      setAuthMessage('Logged in. Syncing your journal...', 'success');
      refreshAuthState();
    });
  }

  if (user && typeof user.recall === 'function') {
    try {
      user.recall({ sessionStorage: true, localStorage: true });
    } catch (err) {
      // ignore recall errors
    }
  }

  useGuestJournal();
  scheduleAuthCheck();

  newGuestButton.addEventListener('click', () => {
    const nextId = buildGuestId();
    setGuestIdInUrl(nextId);
    window.location.reload();
  });

  copyLinkButton.addEventListener('click', async () => {
    const url = shareLink.dataset.url || window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      copyLinkButton.textContent = 'Copied!';
      window.setTimeout(() => {
        copyLinkButton.textContent = 'Copy share link';
      }, 1500);
    } catch (err) {
      window.prompt('Copy this link to share your guest journal:', url);
    }
  });

  logoutButton.addEventListener('click', () => {
    if (user?.leave) {
      user.leave();
    }
    setAuthMessage('Logged out. Back to guest journal.', 'info');
    useGuestJournal();
  });

  authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset?.action || 'login';
    const alias = aliasInput.value.trim();
    const password = passwordInput.value.trim();

    if (!alias || !password) {
      setAuthMessage('Enter an alias and password.', 'error');
      return;
    }

    if (!user) {
      setAuthMessage('Login unavailable. Please refresh.', 'error');
      return;
    }

    if (action === 'login') {
      setAuthMessage('Logging in...', 'info');
      auth.authWithRemember(alias, password, (ack) => {
        if (ack.err) {
          setAuthMessage(ack.err, 'error');
          return;
        }
        setAuthMessage('Logged in. Syncing your journal...', 'success');
      });
      return;
    }

    setAuthMessage('Creating account...', 'info');
    user.create(alias, password, (createAck) => {
      if (createAck.err) {
        setAuthMessage(createAck.err, 'error');
        return;
      }
      auth.authWithRemember(alias, password, (authAck) => {
        if (authAck.err) {
          setAuthMessage(authAck.err, 'error');
          return;
        }
        setAuthMessage('Account created. Syncing your journal...', 'success');
      });
    });
  });

  const createButton = authForm.querySelector('[data-action="create"]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      const alias = aliasInput.value.trim();
      const password = passwordInput.value.trim();

      if (!alias || !password) {
        setAuthMessage('Enter an alias and password first.', 'error');
        return;
      }

      if (!user) {
        setAuthMessage('Login unavailable. Please refresh.', 'error');
        return;
      }

      setAuthMessage('Creating account...', 'info');
      user.create(alias, password, (createAck) => {
        if (createAck.err) {
          setAuthMessage(createAck.err, 'error');
          return;
        }
        auth.authWithRemember(alias, password, (authAck) => {
          if (authAck.err) {
            setAuthMessage(authAck.err, 'error');
            return;
          }
          setAuthMessage('Account created. Syncing your journal...', 'success');
        });
      });
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const date = dateInput.value;
    const entryType = typeInput.value.trim();
    const title = titleInput.value.trim();
    const mood = moodInput.value.trim();
    const tags = normalizeTags(tagsInput.value);
    const body = bodyInput.value.trim();
    const nextStep = nextInput.value.trim();

    if (!date || !entryType || !body) {
      return;
    }

    if (!entriesNode) {
      return;
    }

    if (editingId) {
      const existing = cache.get(editingId) ?? {};
      entriesNode.get(editingId).put({
        title,
        date,
        entryType,
        mood,
        tags: tags.join(', '),
        body,
        nextStep,
        createdAt: existing.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });
      resetForm();
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    entriesNode.get(id).put({
      title,
      date,
      entryType,
      mood,
      tags: tags.join(', '),
      body,
      nextStep,
      createdAt: Date.now(),
    });

    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
  });

  cancelButton.addEventListener('click', () => {
    resetForm();
  });

  filterType.addEventListener('change', renderEntries);
  searchInput.addEventListener('input', renderEntries);

  const today = new Date().toISOString().split('T')[0];
  if (!dateInput.value) {
    dateInput.value = today;
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initJournal);
} else {
  initJournal();
}
