(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    module.exports.default = api;
  } else {
    api.autoInit(root);
    if (root && typeof root === 'object') {
      root.loginStatus = api;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_ADMIN_URL = 'admin/index.html';
  const DEFAULT_RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
  const DEFAULT_SHARED_APP_KEY = 'portal.3dvr.tech';
  const DEFAULT_RECALL_OPTIONS = Object.freeze({ localStorage: true });

  const sanitizeAlias = (alias) => {
    if (typeof alias !== 'string') {
      return 'Account';
    }
    const trimmed = alias.trim();
    return trimmed.length ? trimmed : 'Account';
  };

  const toBoolean = (value) => value === true || value === 'true';

  const createNoopController = () => ({
    init() {},
    destroy() {},
    refreshState() {},
    updateLoginLink() {},
    get state() {
      return { isLoggedIn: false, alias: null, commandCentralVisible: false };
    }
  });

  const createLoginStatusController = (options = {}) => {
    const root = options.root ?? (typeof window !== 'undefined' ? window : undefined);
    const doc = options.doc ?? root?.document;
    const loginLink =
      options.loginLink ??
      (doc && typeof doc.getElementById === 'function' ? doc.getElementById(options.loginLinkId || 'login-link') : null);

    if (!doc || !loginLink) {
      return createNoopController();
    }

    const Gun = options.Gun ?? root?.Gun;
    const relayUrl = options.relayUrl || DEFAULT_RELAY_URL;
    const adminUrl = options.adminUrl || DEFAULT_ADMIN_URL;
    const recallOptions = options.recallOptions || DEFAULT_RECALL_OPTIONS;

    const gun =
      options.gun ??
      (typeof Gun === 'function'
        ? Gun({
            peers: options.peers || [relayUrl],
            localStorage: true
          })
        : null);

    if (!gun) {
      return createNoopController();
    }

    const user = options.user ?? (typeof gun.user === 'function' ? gun.user() : null);
    if (!user) {
      return createNoopController();
    }

    const commandCentralElement =
      options.commandCentralElement ??
      (options.commandCentralSelector && doc?.querySelector
        ? doc.querySelector(options.commandCentralSelector)
        : doc?.querySelector?.('#command-central'));

    const sharedAppKey = options.sharedAppKey || DEFAULT_SHARED_APP_KEY;

    let hasInitialized = false;
    let cachedAlias = null;
    let commandCentralAttached = false;
    let commandCentralPrimaryNode = null;
    let commandCentralFallbackNode = null;

    const updateCommandCentralVisibility = (value) => {
      if (!commandCentralElement) {
        return;
      }
      const shouldShow = Boolean(user.is) && toBoolean(value);
      commandCentralElement.hidden = !shouldShow;
      commandCentralElement.dataset.commandCentral = shouldShow ? 'enabled' : 'disabled';
    };

    const detachCommandCentral = () => {
      if (commandCentralPrimaryNode?.off) {
        commandCentralPrimaryNode.off();
      }
      if (commandCentralFallbackNode?.off) {
        commandCentralFallbackNode.off();
      }
      commandCentralPrimaryNode = null;
      commandCentralFallbackNode = null;
      commandCentralAttached = false;
      updateCommandCentralVisibility(false);
    };

    const bindCommandCentral = () => {
      if (commandCentralAttached || !commandCentralElement || typeof user.get !== 'function') {
        return;
      }

      commandCentralAttached = true;

      const appsNode = user.get('apps');
      const sharedApp = typeof appsNode?.get === 'function' ? appsNode.get(sharedAppKey) : null;
      const sharedDashboard = typeof sharedApp?.get === 'function' ? sharedApp.get('dashboard') : null;
      const legacyDashboard = typeof user.get === 'function' ? user.get('dashboard') : null;

      commandCentralPrimaryNode =
        typeof sharedDashboard?.get === 'function' ? sharedDashboard.get('commandCentralEnabled') : null;
      commandCentralFallbackNode =
        typeof legacyDashboard?.get === 'function' ? legacyDashboard.get('commandCentralEnabled') : null;

      let hasPrimaryValue = false;

      const handleValue = (value) => {
        updateCommandCentralVisibility(value);
      };

      if (commandCentralPrimaryNode?.on) {
        commandCentralPrimaryNode.on((value) => {
          hasPrimaryValue = value !== undefined && value !== null;
          handleValue(value);
        });
      }

      if (commandCentralFallbackNode?.on) {
        commandCentralFallbackNode.on((value) => {
          if (!hasPrimaryValue) {
            handleValue(value);
          }
        });
      }
    };

    const formatAlias = options.formatAlias || sanitizeAlias;

    const updateLoginLink = () => {
      if (user.is) {
        const aliasCandidate = cachedAlias ?? user.is.alias ?? user._?.alias;
        const alias = formatAlias(aliasCandidate);
        loginLink.textContent = alias;
        loginLink.setAttribute('aria-label', `Open admin panel for ${alias}`);
        loginLink.setAttribute('href', `${adminUrl}#admin-panel`);
        loginLink.classList.add('logged-in');
      } else {
        loginLink.textContent = 'Log In';
        loginLink.setAttribute('aria-label', 'Log in to the admin control center');
        loginLink.setAttribute('href', `${adminUrl}#auth-section`);
        loginLink.classList.remove('logged-in');
        detachCommandCentral();
      }
    };

    const applyLoginState = () => {
      updateLoginLink();
      if (user.is) {
        bindCommandCentral();
      } else {
        updateCommandCentralVisibility(false);
      }
    };

    const recallSession = (callback) => {
      if (typeof user.recall === 'function') {
        user.recall(recallOptions, () => {
          callback?.();
        });
      } else if (callback) {
        callback();
      }
    };

    const refreshState = () => {
      if (!user.is) {
        recallSession(applyLoginState);
        return;
      }
      applyLoginState();
    };

    const initAliasBinding = () => {
      if (typeof user.get !== 'function') {
        return;
      }
      try {
        const aliasNode = user.get('alias');
        if (aliasNode?.on) {
          aliasNode.on((value) => {
            if (typeof value === 'string' && value.trim()) {
              cachedAlias = value;
              if (user.is) {
                updateLoginLink();
              }
            }
          });
        }
      } catch (err) {
        // Swallow errors from optional alias binding.
      }
    };

    const handleAuth = () => {
      applyLoginState();
    };

    const init = () => {
      if (hasInitialized) {
        return;
      }
      hasInitialized = true;

      recallSession(applyLoginState);

      initAliasBinding();

      if (typeof gun.on === 'function') {
        gun.on('auth', handleAuth);
      }

      const globalTarget = options.globalTarget ?? root;
      if (globalTarget?.addEventListener) {
        globalTarget.addEventListener('focus', refreshState);
        globalTarget.addEventListener('storage', refreshState);
      }

      applyLoginState();
    };

    const destroy = () => {
      if (!hasInitialized) {
        return;
      }
      hasInitialized = false;

      const globalTarget = options.globalTarget ?? root;
      if (globalTarget?.removeEventListener) {
        globalTarget.removeEventListener('focus', refreshState);
        globalTarget.removeEventListener('storage', refreshState);
      }

      detachCommandCentral();
    };

    return {
      init,
      destroy,
      refreshState,
      updateLoginLink,
      formatAlias,
      get state() {
        return {
          isLoggedIn: Boolean(user.is),
          alias: user.is?.alias ?? cachedAlias ?? null,
          commandCentralVisible: Boolean(commandCentralElement && !commandCentralElement.hidden)
        };
      }
    };
  };

  const autoInit = (root) => {
    if (!root) {
      return null;
    }

    const doc = root.document;
    if (!doc) {
      return null;
    }

    let controller = null;
    let hasStarted = false;

    const startController = () => {
      if (hasStarted) {
        return controller;
      }
      hasStarted = true;
      controller = createLoginStatusController({ root, doc });
      controller.init();
      if (root && typeof root === 'object') {
        root.loginStatusController = controller;
      }
      return controller;
    };

    if (typeof root.Gun === 'function') {
      return startController();
    }

    const MAX_ATTEMPTS = 80;
    let attempts = 0;

    const scheduleRetry = () => {
      if (typeof root.setTimeout !== 'function') {
        return;
      }
      const tryInit = () => {
        if (typeof root.Gun === 'function') {
          startController();
          return;
        }
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          root.setTimeout(tryInit, 50);
        }
      };
      root.setTimeout(tryInit, 0);
    };

    if (root.addEventListener) {
      root.addEventListener(
        'load',
        () => {
          if (typeof root.Gun === 'function') {
            startController();
          } else if (!hasStarted) {
            scheduleRetry();
          }
        },
        { once: true }
      );
    }

    scheduleRetry();

    return controller;
  };

  return {
    createLoginStatusController,
    autoInit
  };
});
