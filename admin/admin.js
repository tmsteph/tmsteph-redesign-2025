(function () {
  const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
  const peers = Object.freeze([RELAY_URL]);

  const gun = Gun({ peers, localStorage: true });
  const user = gun.user();
  const RECALL_OPTIONS = { localStorage: true };

  const safeGet = (node, key) => (typeof node?.get === 'function' ? node.get(key) : null);
  const sanitizeAlias = (alias) => {
    if (typeof alias !== 'string') {
      return '';
    }
    const trimmed = alias.trim();
    return trimmed.length ? trimmed : '';
  };

  const recallUserSession = () => {
    if (typeof user.recall === 'function') {
      user.recall(RECALL_OPTIONS, () => {
        if (user.is) {
          showAdminPanel();
        }
      });
    }
  };

  const authSection = document.getElementById('auth-section');
  const adminPanel = document.getElementById('admin-panel');
  const authForm = document.getElementById('auth-form');
  const authHeading = document.getElementById('auth-heading');
  const authSubmit = document.getElementById('auth-submit');
  const authToggleText = document.getElementById('auth-toggle-text');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const authMessage = document.getElementById('auth-message');
  const panelMessage = document.getElementById('panel-message');
  const aliasDisplay = document.getElementById('alias-display');
  const logoutBtn = document.getElementById('logout-btn');

  const statusForm = document.getElementById('status-form');
  const statusInput = document.getElementById('status-input');
  const statusPreview = document.getElementById('status-preview');

  const noteForm = document.getElementById('note-form');
  const noteInput = document.getElementById('note-input');
  const notePreview = document.getElementById('note-preview');

  const commandCentralForm = document.getElementById('command-central-form');
  const commandCentralToggle = document.getElementById('command-central-toggle');
  const commandCentralPreview = document.getElementById('command-central-preview');

  const aliasInput = document.getElementById('alias');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');

  const SHARED_APP_KEY = 'portal.3dvr.tech';

  const getSharedApp = () => safeGet(safeGet(user, 'apps'), SHARED_APP_KEY);
  const getSharedProfile = () => safeGet(getSharedApp(), 'profile');
  const getSharedDashboard = () => safeGet(getSharedApp(), 'dashboard');

  const getLegacyProfile = () => safeGet(user, 'profile');
  const getLegacyDashboard = () => safeGet(user, 'dashboard');

  let mode = 'login';
  let listenersAttached = false;
  let hasConnectedPeer = false;
  let connectionNoticeTimeout = null;

  const toBoolean = (value) => value === true || value === 'true';

  const setAuthMessage = (message, type = 'info') => {
    authMessage.textContent = message;
    authMessage.dataset.state = type;
  };

  const setPanelMessage = (message, type = 'info') => {
    panelMessage.textContent = message;
    panelMessage.dataset.state = type;
    if (message) {
      setTimeout(() => {
        if (panelMessage.textContent === message) {
          panelMessage.textContent = '';
          panelMessage.dataset.state = '';
        }
      }, 3500);
    }
  };

  let isPasswordVisible = false;

  const setPasswordVisibility = (visible) => {
    isPasswordVisible = visible;
    passwordInput.type = visible ? 'text' : 'password';
    passwordToggle.textContent = visible ? 'Hide' : 'Show';
    passwordToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
    passwordToggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  };

  const resetAuthForm = () => {
    authForm.reset();
    setPasswordVisibility(false);
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

  gun.on('hi', (peer) => {
    hasConnectedPeer = true;
    clearConnectionNoticeTimeout();
    const peerName = peer?.url || 'a sync peer';
    if (adminPanel.hidden) {
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
      if (adminPanel.hidden) {
        setAuthMessage('Attempting to reconnect to the sync service...', 'warning');
      } else {
        setPanelMessage('Lost connection to sync service. Changes will save locally and sync when reconnected.', 'warning');
      }
      scheduleConnectionWarning();
    }
  });

  scheduleConnectionWarning();

  const persistAlias = (aliasCandidate) => {
    const aliasValue = sanitizeAlias(aliasCandidate);
    if (!aliasValue) {
      return;
    }
    const aliasNode = safeGet(user, 'alias');
    if (typeof aliasNode?.put === 'function') {
      aliasNode.put(aliasValue);
    }
  };

  const showAdminPanel = () => {
    authSection.hidden = true;
    adminPanel.hidden = false;
    const aliasCandidate = sanitizeAlias(user.is?.alias) || sanitizeAlias(aliasInput.value);
    aliasDisplay.textContent = aliasCandidate || 'Admin';
    if (aliasCandidate) {
      persistAlias(aliasCandidate);
    }
    attachUserListeners();
    clearConnectionNoticeTimeout();
  };

  const showAuthPanel = (message = '') => {
    user.leave();
    adminPanel.hidden = true;
    authSection.hidden = false;
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
      primary: safeGet(getSharedProfile(), 'status'),
      fallback: safeGet(getLegacyProfile(), 'status'),
      onValue: (value) => {
        const status = value || '';
        statusInput.value = status;
        statusPreview.textContent = status || 'No status set yet.';
      }
    });

    bindField({
      primary: safeGet(getSharedDashboard(), 'note'),
      fallback: safeGet(getLegacyDashboard(), 'note'),
      onValue: (value) => {
        const note = value || '';
        noteInput.value = note;
        notePreview.textContent = note || 'Your notes will show up here.';
      }
    });

    if (commandCentralToggle && commandCentralPreview) {
      const updateCommandCentralPreview = (value) => {
        const enabled = toBoolean(value);
        commandCentralToggle.checked = enabled;
        commandCentralPreview.textContent = enabled
          ? 'Command Central is visible on your homepage.'
          : 'Command Central is hidden.';
      };

      bindField({
        primary: safeGet(getSharedDashboard(), 'commandCentralEnabled'),
        fallback: safeGet(getLegacyDashboard(), 'commandCentralEnabled'),
        onValue: updateCommandCentralPreview
      });
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
          persistAlias(alias);
          showAdminPanel();
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
      persistAlias(alias);
      showAdminPanel();
    });
  }
  });

  logoutBtn.addEventListener('click', () => {
    showAuthPanel('You have been logged out.');
  });

  statusForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = statusInput.value.trim();
    putToMultipleNodes(value, [safeGet(getSharedProfile(), 'status'), safeGet(getLegacyProfile(), 'status')], () => {
      if (hasConnectedPeer) {
        setPanelMessage('Status saved!', 'success');
      } else {
        setPanelMessage('Status saved locally. It will sync when a connection is available.', 'warning');
      }
    });
  });

  noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = noteInput.value.trim();
    putToMultipleNodes(value, [safeGet(getSharedDashboard(), 'note'), safeGet(getLegacyDashboard(), 'note')], () => {
      if (hasConnectedPeer) {
        setPanelMessage('Note saved!', 'success');
      } else {
        setPanelMessage('Note saved locally. It will sync when a connection is available.', 'warning');
      }
    });
  });

  if (commandCentralForm && commandCentralToggle) {
    commandCentralForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const enabled = commandCentralToggle.checked;
      putToMultipleNodes(
        enabled,
        [
          safeGet(getSharedDashboard(), 'commandCentralEnabled'),
          safeGet(getLegacyDashboard(), 'commandCentralEnabled')
        ],
        () => {
          if (hasConnectedPeer) {
            setPanelMessage('Command Central preference saved!', 'success');
          } else {
            setPanelMessage('Preference saved locally. It will sync when a connection is available.', 'warning');
          }
        }
      );
    });
  }

  gun.on('auth', () => {
    persistAlias(user.is?.alias);
    showAdminPanel();
    setAuthMessage('');
  });

  recallUserSession();

  window.addEventListener('load', () => {
    if (user.is) {
      showAdminPanel();
    }
  });
})();
