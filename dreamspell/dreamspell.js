(function () {
  const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
  const peers = Object.freeze([RELAY_URL]);

  const gun = Gun({ peers, localStorage: true });
  const user = gun.user();
  const RECALL_OPTIONS = { sessionStorage: true, localStorage: true };

  const safeGet = (node, key) => (typeof node?.get === 'function' ? node.get(key) : null);

  const authSection = document.getElementById('auth-section');
  const dreamspellPanel = document.getElementById('dreamspell-panel');
  const authForm = document.getElementById('auth-form');
  const authHeading = document.getElementById('auth-heading');
  const authSubmit = document.getElementById('auth-submit');
  const authToggleText = document.getElementById('auth-toggle-text');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const authMessage = document.getElementById('auth-message');
  const panelMessage = document.getElementById('panel-message');
  const logoutBtn = document.getElementById('logout-btn');

  const aliasInput = document.getElementById('alias');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');

  const dreamspellCalendar = document.getElementById('dreamspell-calendar');
  const dreamspellToday = document.getElementById('dreamspell-today');
  const dreamspellSync = document.getElementById('dreamspell-sync');
  const dreamspellModeButtons = document.querySelectorAll('[data-calendar-mode]');

  const SHARED_APP_KEY = 'portal.3dvr.tech';
  const DREAMSPELL_DEFAULT_MODE = 'moon';
  const DREAMSPELL_DEFAULT_MESSAGE = 'Sync status will appear here after your calendar is saved.';

  const getSharedApp = () => safeGet(safeGet(user, 'apps'), SHARED_APP_KEY);
  const getSharedDreamspell = () => safeGet(getSharedApp(), 'dreamspell');
  const getLegacyDreamspell = () => safeGet(user, 'dreamspell');

  let mode = 'login';
  let listenersAttached = false;
  let hasConnectedPeer = false;
  let connectionNoticeTimeout = null;
  let recallAttempted = false;

  const dreamspellState = {
    mode: DREAMSPELL_DEFAULT_MODE,
    activeDays: {}
  };

  const setAuthMessage = (message, type = 'info') => {
    authMessage.textContent = message;
    authMessage.dataset.state = type;
  };

  const setPanelMessage = (message, type = 'info') => {
    if (!panelMessage) {
      return;
    }
    panelMessage.textContent = message;
    panelMessage.dataset.state = message ? type : '';
    if (message) {
      setTimeout(() => {
        if (panelMessage.textContent === message) {
          panelMessage.textContent = '';
          panelMessage.dataset.state = '';
        }
      }, 3500);
    }
  };

  const setDreamspellSyncMessage = (message, type = 'info') => {
    if (!dreamspellSync) {
      return;
    }
    dreamspellSync.textContent = message;
    dreamspellSync.dataset.state = message ? type : '';
  };

  const recallUser = () => {
    if (recallAttempted) {
      return;
    }
    recallAttempted = true;
    if (typeof user.recall === 'function') {
      try {
        user.recall(RECALL_OPTIONS);
      } catch (err) {
        // Ignore recall errors. We'll rely on manual login if automatic recall fails.
      }
    }
  };

  const sanitizeDreamspellMode = (value) => (value === 'sun' ? 'sun' : 'moon');

  const normalizeDreamspellDays = (value) => {
    if (!value || typeof value !== 'object') {
      return {};
    }
    const normalized = {};
    Object.entries(value).forEach(([key, entryValue]) => {
      if (key === '_' || !entryValue) {
        return;
      }
      normalized[key] = true;
    });
    return normalized;
  };

  const formatDateKey = (date) => {
    if (!(date instanceof Date)) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDate = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const getMoonYearStart = () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), 6, 26);
    if (today < startDate) {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    return startDate;
  };

  const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

  const updateDreamspellToggle = (selectedMode) => {
    dreamspellModeButtons.forEach((button) => {
      const isActive = button.dataset.calendarMode === selectedMode;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const renderDreamspellCalendar = () => {
    if (!dreamspellCalendar) {
      return;
    }

    const activeDays = dreamspellState.activeDays || {};
    const today = new Date();
    dreamspellCalendar.innerHTML = '';

    if (dreamspellState.mode === 'sun') {
      const year = today.getFullYear();
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      if (dreamspellToday) {
        const todayLabel = today.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        dreamspellToday.textContent = `☀️ Today is ${todayLabel} in the Solar calendar.`;
      }

      months.forEach((name, monthIndex) => {
        const month = document.createElement('div');
        month.className = 'dreamspell-month';

        const header = document.createElement('h4');
        header.textContent = `${name} ${year}`;
        month.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'dreamspell-grid';

        const daysInMonth = getDaysInMonth(year, monthIndex);
        for (let dayIndex = 1; dayIndex <= daysInMonth; dayIndex += 1) {
          const date = new Date(year, monthIndex, dayIndex);
          const dateKey = formatDateKey(date);
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'dreamspell-day';
          button.textContent = dayIndex;
          button.dataset.date = dateKey;
          button.dataset.active = activeDays[dateKey] ? 'true' : 'false';
          button.dataset.today = isSameDate(date, today) ? 'true' : 'false';
          grid.appendChild(button);
        }

        month.appendChild(grid);
        dreamspellCalendar.appendChild(month);
      });

      return;
    }

    const months = [
      'Magnetic', 'Lunar', 'Electric', 'Self-Existing', 'Overtone', 'Rhythmic',
      'Resonant', 'Galactic', 'Solar', 'Planetary', 'Spectral', 'Crystal', 'Cosmic'
    ];

    const startDate = getMoonYearStart();
    const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const moonIndex = Math.floor(diffDays / 28);
    const dayInMoon = (diffDays % 28) + 1;

    if (dreamspellToday) {
      dreamspellToday.textContent = `🗓️ Today is ${months[moonIndex]} Moon, Day ${dayInMoon} in the 13 Moon Calendar.`;
    }

    months.forEach((name, monthIndex) => {
      const month = document.createElement('div');
      month.className = 'dreamspell-month';

      const header = document.createElement('h4');
      header.textContent = `${name} Moon`;
      month.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'dreamspell-grid';

      for (let dayIndex = 1; dayIndex <= 28; dayIndex += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + monthIndex * 28 + (dayIndex - 1));
        const dateKey = formatDateKey(date);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dreamspell-day';
        button.textContent = dayIndex;
        button.dataset.date = dateKey;
        button.dataset.active = activeDays[dateKey] ? 'true' : 'false';
        button.dataset.today = isSameDate(date, today) ? 'true' : 'false';
        grid.appendChild(button);
      }

      month.appendChild(grid);
      dreamspellCalendar.appendChild(month);
    });
  };

  const setDreamspellMode = (nextMode, shouldPersist = false) => {
    const normalizedMode = sanitizeDreamspellMode(nextMode);
    if (dreamspellState.mode === normalizedMode && !shouldPersist) {
      return;
    }
    dreamspellState.mode = normalizedMode;
    updateDreamspellToggle(normalizedMode);
    renderDreamspellCalendar();
    if (shouldPersist) {
      saveDreamspellMode(normalizedMode);
    }
  };

  const putToMultipleNodes = (value, nodes, onSuccess) => {
    const filteredNodes = nodes.filter((node) => typeof node?.put === 'function');
    if (!filteredNodes.length) {
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
      return;
    }

    let pending = filteredNodes.length;
    let errorMessage = null;

    filteredNodes.forEach((node) => {
      node.put(value, (ack) => {
        if (ack.err && !errorMessage) {
          errorMessage = ack.err;
        }

        pending -= 1;
        if (pending === 0) {
          if (errorMessage) {
            setPanelMessage(errorMessage, 'error');
          } else if (typeof onSuccess === 'function') {
            onSuccess();
          }
        }
      });
    });
  };

  const saveDreamspellMode = (selectedMode) => {
    const nodes = [
      safeGet(getSharedDreamspell(), 'mode'),
      safeGet(getLegacyDreamspell(), 'mode')
    ];
    putToMultipleNodes(selectedMode, nodes, () => {
      const message = hasConnectedPeer
        ? 'Calendar mode synced across your devices.'
        : 'Calendar mode saved locally. It will sync when a connection is available.';
      setDreamspellSyncMessage(message, hasConnectedPeer ? 'success' : 'warning');
    });
  };

  const saveDreamspellDays = (days) => {
    const nodes = [
      safeGet(getSharedDreamspell(), 'activeDays'),
      safeGet(getLegacyDreamspell(), 'activeDays')
    ];
    putToMultipleNodes(days, nodes, () => {
      const message = hasConnectedPeer
        ? 'Dreamspell selections synced across your devices.'
        : 'Selections saved locally. They will sync when a connection is available.';
      setDreamspellSyncMessage(message, hasConnectedPeer ? 'success' : 'warning');
    });
  };

  const setDreamspellDays = (value) => {
    dreamspellState.activeDays = normalizeDreamspellDays(value);
    renderDreamspellCalendar();
  };

  const resetAuthForm = () => {
    authForm.reset();
    setPasswordVisibility(false);
  };

  let isPasswordVisible = false;

  const setPasswordVisibility = (visible) => {
    isPasswordVisible = visible;
    passwordInput.type = visible ? 'text' : 'password';
    passwordToggle.textContent = visible ? 'Hide' : 'Show';
    passwordToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
    passwordToggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  };

  const setMode = (nextMode) => {
    mode = nextMode;
    if (mode === 'register') {
      authHeading.textContent = 'Create Account';
      authSubmit.textContent = 'Sign Up';
      authToggleText.textContent = 'Already have an account?';
      toggleAuthBtn.textContent = 'Log in';
    } else {
      authHeading.textContent = 'Log In';
      authSubmit.textContent = 'Log In';
      authToggleText.textContent = 'Need an account?';
      toggleAuthBtn.textContent = 'Create one';
    }
    resetAuthForm();
    setAuthMessage('');
  };

  const clearConnectionNoticeTimeout = () => {
    if (connectionNoticeTimeout) {
      clearTimeout(connectionNoticeTimeout);
      connectionNoticeTimeout = null;
    }
  };

  const scheduleConnectionWarning = () => {
    clearConnectionNoticeTimeout();
    connectionNoticeTimeout = setTimeout(() => {
      if (!hasConnectedPeer) {
        setAuthMessage(
          'Unable to reach the sync service. You can use cached credentials, and changes will sync once a connection is restored.',
          'warning'
        );
      }
    }, 4000);
  };

  const showDreamspellPanel = () => {
    authSection.hidden = true;
    dreamspellPanel.hidden = false;
    setDreamspellSyncMessage(DREAMSPELL_DEFAULT_MESSAGE, 'info');
    attachUserListeners();
    clearConnectionNoticeTimeout();
  };

  const showAuthPanel = (message = '') => {
    user.leave();
    dreamspellPanel.hidden = true;
    authSection.hidden = false;
    dreamspellState.activeDays = {};
    dreamspellState.mode = DREAMSPELL_DEFAULT_MODE;
    setDreamspellSyncMessage('', 'info');
    if (message) {
      setAuthMessage(message, 'info');
    }
    if (!hasConnectedPeer) {
      scheduleConnectionWarning();
    }
  };

  const attachUserListeners = () => {
    if (listenersAttached) return;
    listenersAttached = true;

    const bindField = ({ primary, fallback, onValue }) => {
      let hasPrimaryValue = false;

      if (typeof primary?.on === 'function') {
        primary.on((value) => {
          hasPrimaryValue = value !== undefined && value !== null;
          onValue(value);
        });
      }

      if (typeof fallback?.on === 'function') {
        fallback.on((value) => {
          if (!hasPrimaryValue && value !== undefined && value !== null && value !== '') {
            onValue(value);
          }
        });
      }
    };

    bindField({
      primary: safeGet(getSharedDreamspell(), 'activeDays'),
      fallback: safeGet(getLegacyDreamspell(), 'activeDays'),
      onValue: setDreamspellDays
    });

    bindField({
      primary: safeGet(getSharedDreamspell(), 'mode'),
      fallback: safeGet(getLegacyDreamspell(), 'mode'),
      onValue: (value) => setDreamspellMode(value || DREAMSPELL_DEFAULT_MODE)
    });

    if (!dreamspellState.mode) {
      setDreamspellMode(DREAMSPELL_DEFAULT_MODE);
    }

    renderDreamspellCalendar();
  };

  setPasswordVisibility(false);

  passwordToggle.addEventListener('click', () => {
    setPasswordVisibility(!isPasswordVisible);
    if (isPasswordVisible) {
      passwordInput.focus({ preventScroll: true });
      const { value } = passwordInput;
      passwordInput.setSelectionRange(value.length, value.length);
    }
  });

  toggleAuthBtn.addEventListener('click', () => {
    setMode(mode === 'login' ? 'register' : 'login');
  });

  authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const alias = aliasInput.value.trim();
    const password = passwordInput.value;

    if (!alias || !password) {
      setAuthMessage('Alias and password are required.', 'error');
      return;
    }

    if (mode === 'register') {
      user.create(alias, password, (ack) => {
        if (ack.err) {
          setAuthMessage(ack.err, 'error');
          return;
        }
        setAuthMessage('Account created! Logging you in...', 'success');
        user.auth(alias, password, (authAck) => {
          if (authAck.err) {
            setAuthMessage(authAck.err, 'error');
            return;
          }
          showDreamspellPanel();
        });
      });
    } else {
      user.auth(alias, password, (ack) => {
        if (ack.err) {
          const errorMessage =
            typeof ack.err === 'string' && ack.err.includes('Wrong user or password')
              ? 'Incorrect alias or password. Please try again, or create an account first.'
              : ack.err || 'Login failed. Please try again.';
          setAuthMessage(errorMessage, 'error');
          return;
        }
        setAuthMessage('Login successful! Redirecting...', 'success');
        showDreamspellPanel();
      });
    }
  });

  logoutBtn.addEventListener('click', () => {
    showAuthPanel('You have been logged out.');
  });

  if (dreamspellModeButtons && dreamspellModeButtons.length) {
    dreamspellModeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.calendarMode;
        setDreamspellMode(nextMode, true);
      });
    });
  }

  if (dreamspellCalendar) {
    dreamspellCalendar.addEventListener('click', (event) => {
      const target = event.target.closest('.dreamspell-day');
      if (!target || !target.dataset.date) {
        return;
      }
      const dateKey = target.dataset.date;
      if (!dateKey) {
        return;
      }
      const nextDays = { ...dreamspellState.activeDays };
      if (nextDays[dateKey]) {
        delete nextDays[dateKey];
      } else {
        nextDays[dateKey] = true;
      }
      dreamspellState.activeDays = nextDays;
      renderDreamspellCalendar();
      saveDreamspellDays(nextDays);
    });
  }

  gun.on('hi', (peer) => {
    hasConnectedPeer = true;
    clearConnectionNoticeTimeout();
    const peerName = peer?.url || 'a sync peer';
    if (dreamspellPanel.hidden) {
      setAuthMessage(`Connected to ${peerName}. You can log in now.`, 'success');
      setTimeout(() => {
        if (!user.is) {
          setAuthMessage('');
        }
      }, 2500);
    } else {
      setPanelMessage(`Connected to ${peerName}.`, 'success');
    }
  });

  gun.on('bye', () => {
    const activePeers = Object.values(gun._.opt?.peers || {}).filter((p) => p?.wire);
    if (!activePeers.length) {
      hasConnectedPeer = false;
      if (dreamspellPanel.hidden) {
        setAuthMessage('Attempting to reconnect to the sync service...', 'warning');
      } else {
        setPanelMessage('Lost connection to sync service. Changes will save locally and sync when reconnected.', 'warning');
      }
      scheduleConnectionWarning();
    }
  });

  scheduleConnectionWarning();

  gun.on('auth', () => {
    showDreamspellPanel();
    setAuthMessage('');
  });
  recallUser();

  window.addEventListener('load', () => {
    if (user.is) {
      showDreamspellPanel();
    }
  });
})();
