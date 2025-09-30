(function () {
  const peers = ['https://gun-relay-3dvr.fly.dev/gun'];

  const gun = Gun({ peers, localStorage: true });
  const user = gun.user();
  user.recall({ sessionStorage: true });

  const authSection = document.getElementById('auth-section');
  const adminPanel = document.getElementById('admin-panel');
  const authForm = document.getElementById('auth-form');
  const authHeading = document.getElementById('auth-heading');
  const authSubmit = document.getElementById('auth-submit');
  const authToggleText = document.getElementById('auth-toggle-text');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const confirmPasswordInput = document.getElementById('confirm-password');
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

  const aliasInput = document.getElementById('alias');
  const passwordInput = document.getElementById('password');

  const SHARED_APP_KEY = 'portal.3dvr.tech';

  const sharedApp = user.get('apps').get(SHARED_APP_KEY);
  const sharedProfile = sharedApp.get('profile');
  const sharedDashboard = sharedApp.get('dashboard');

  const legacyProfile = user.get('profile');
  const legacyDashboard = user.get('dashboard');

  let mode = 'login';
  let listenersAttached = false;
  let hasConnectedPeer = false;
  let connectionNoticeTimeout = null;

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

  const resetAuthForm = () => {
    authForm.reset();
    confirmPasswordGroup.hidden = mode !== 'register';
    confirmPasswordInput.required = mode === 'register';
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

  const showAdminPanel = () => {
    authSection.hidden = true;
    adminPanel.hidden = false;
    aliasDisplay.textContent = user.is?.alias || 'Admin';
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

      primary.on((value) => {
        hasPrimaryValue = true;
        onValue(value);
      });

      if (fallback) {
        fallback.on((value) => {
          if (!hasPrimaryValue && value !== undefined && value !== null && value !== '') {
            onValue(value);
          }
        });
      }
    };

    bindField({
      primary: sharedProfile.get('status'),
      fallback: legacyProfile.get('status'),
      onValue: (value) => {
        const status = value || '';
        statusInput.value = status;
        statusPreview.textContent = status || 'No status set yet.';
      }
    });

    bindField({
      primary: sharedDashboard.get('note'),
      fallback: legacyDashboard.get('note'),
      onValue: (value) => {
        const note = value || '';
        noteInput.value = note;
        notePreview.textContent = note || 'Your notes will show up here.';
      }
    });
  };

  const putToMultipleNodes = (value, nodes, onSuccess) => {
    const filteredNodes = nodes.filter(Boolean);
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
      const confirmPassword = confirmPasswordInput.value;
      if (password !== confirmPassword) {
        setAuthMessage('Passwords do not match. Please try again.', 'error');
        return;
      }

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
    putToMultipleNodes(value, [sharedProfile.get('status'), legacyProfile.get('status')], () => {
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
    putToMultipleNodes(value, [sharedDashboard.get('note'), legacyDashboard.get('note')], () => {
      if (hasConnectedPeer) {
        setPanelMessage('Note saved!', 'success');
      } else {
        setPanelMessage('Note saved locally. It will sync when a connection is available.', 'warning');
      }
    });
  });

  gun.on('auth', () => {
    showAdminPanel();
    setAuthMessage('');
  });

  window.addEventListener('load', () => {
    if (user.is) {
      showAdminPanel();
    }
  });
})();
