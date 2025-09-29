(function () {
  const peers = [
    'https://3dvr.fly.dev/gun',
    'https://portal.3dvr.tech/gun'
  ];

  const gun = Gun({ peers });
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

  const showAdminPanel = () => {
    authSection.hidden = true;
    adminPanel.hidden = false;
    aliasDisplay.textContent = user.is?.alias || 'Admin';
    attachUserListeners();
  };

  const showAuthPanel = (message = '') => {
    user.leave();
    adminPanel.hidden = true;
    authSection.hidden = false;
    if (message) {
      setAuthMessage(message, 'info');
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
          setAuthMessage(ack.err, 'error');
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
      setPanelMessage('Status saved!', 'success');
    });
  });

  noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = noteInput.value.trim();
    putToMultipleNodes(value, [sharedDashboard.get('note'), legacyDashboard.get('note')], () => {
      setPanelMessage('Note saved!', 'success');
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
