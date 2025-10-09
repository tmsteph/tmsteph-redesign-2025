(function () {
  const loginLink = document.getElementById('login-link');
  if (!loginLink || typeof Gun === 'undefined') {
    return;
  }

  const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
  const gun = Gun({ peers: [RELAY_URL], localStorage: true });
  const user = gun.user();
  const RECALL_OPTIONS = { localStorage: true };

  user.recall(RECALL_OPTIONS);

  const formatAlias = (alias) => {
    if (!alias || typeof alias !== 'string') {
      return 'Account';
    }
    return alias.trim() || 'Account';
  };

  const ADMIN_URL = 'admin/index.html';
  const updateLoginLink = () => {
    if (user.is) {
      const alias = formatAlias(user.is.alias);
      loginLink.textContent = alias;
      loginLink.setAttribute('aria-label', `Open admin panel for ${alias}`);
      loginLink.setAttribute('href', `${ADMIN_URL}#admin-panel`);
      loginLink.classList.add('logged-in');
    } else {
      loginLink.textContent = 'Log In';
      loginLink.setAttribute('aria-label', 'Log in to the admin control center');
      loginLink.setAttribute('href', `${ADMIN_URL}#auth-section`);
      loginLink.classList.remove('logged-in');
    }
  };

  gun.on('auth', updateLoginLink);

  const refreshState = () => {
    if (!user.is) {
      user.recall(RECALL_OPTIONS);
    }
    updateLoginLink();
  };

  window.addEventListener('focus', refreshState);
  window.addEventListener('storage', refreshState);

  updateLoginLink();
})();
