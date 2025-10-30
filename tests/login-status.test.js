import { describe, expect, it, beforeEach, vi } from 'vitest';
import loginStatus from '../login-status.js';

const { createLoginStatusController } = loginStatus;

const createNodeStub = () => {
  const listeners = new Set();
  return {
    on: vi.fn((callback) => {
      listeners.add(callback);
    }),
    off: vi.fn(() => {
      listeners.clear();
    }),
    emit(value) {
      listeners.forEach((callback) => callback(value));
    }
  };
};

const createUserStub = () => {
  const aliasNode = createNodeStub();
  const commandCentralPrimary = createNodeStub();
  const commandCentralFallback = createNodeStub();

  const sharedDashboardNode = {
    get: vi.fn((key) => {
      if (key === 'commandCentralEnabled') {
        return commandCentralPrimary;
      }
      return null;
    })
  };

  const sharedAppNode = {
    get: vi.fn((key) => {
      if (key === 'dashboard') {
        return sharedDashboardNode;
      }
      return null;
    })
  };

  const appsNode = {
    get: vi.fn((key) => {
      if (key === 'portal.3dvr.tech') {
        return sharedAppNode;
      }
      return null;
    })
  };

  const legacyDashboardNode = {
    get: vi.fn((key) => {
      if (key === 'commandCentralEnabled') {
        return commandCentralFallback;
      }
      return null;
    })
  };

  const user = {
    is: null,
    recall: vi.fn(),
    leave: vi.fn(),
    get: vi.fn((key) => {
      if (key === 'alias') {
        return aliasNode;
      }
      if (key === 'apps') {
        return appsNode;
      }
      if (key === 'dashboard') {
        return legacyDashboardNode;
      }
      return null;
    })
  };

  return { user, aliasNode, commandCentralPrimary, commandCentralFallback };
};

const createGunStub = (user) => {
  const handlers = {};
  return {
    user: () => user,
    on: vi.fn((event, callback) => {
      handlers[event] = callback;
    }),
    emit(event) {
      if (handlers[event]) {
        handlers[event]();
      }
    }
  };
};

const setupDom = () => {
  document.body.innerHTML = `
    <a id="login-link" class="login-link">Log In</a>
    <section id="command-central" hidden data-command-central="disabled"></section>
  `;
  return {
    loginLink: document.getElementById('login-link'),
    commandCentral: document.getElementById('command-central')
  };
};

describe('login status controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('updates the login link to show the alias after authentication', () => {
    const { loginLink, commandCentral } = setupDom();
    const { user } = createUserStub();
    const gun = createGunStub(user);

    const controller = createLoginStatusController({
      root: window,
      doc: document,
      gun,
      user,
      loginLink,
      commandCentralElement: commandCentral
    });

    controller.init();
    expect(loginLink.textContent).toBe('Log In');

    user.is = { alias: 'Thomas' };
    gun.emit('auth');

    expect(loginLink.textContent).toBe('Thomas');
    expect(loginLink.classList.contains('logged-in')).toBe(true);
    expect(loginLink.getAttribute('href')).toContain('#admin-panel');
  });

  it('falls back to a generic label when the alias is missing', () => {
    const { loginLink, commandCentral } = setupDom();
    const { user } = createUserStub();
    const gun = createGunStub(user);

    const controller = createLoginStatusController({
      root: window,
      doc: document,
      gun,
      user,
      loginLink,
      commandCentralElement: commandCentral
    });

    controller.init();
    user.is = { alias: '   ' };
    gun.emit('auth');

    expect(loginLink.textContent).toBe('Account');
  });

  it('ignores aliases that resemble Gun public keys', () => {
    const { loginLink, commandCentral } = setupDom();
    const { user, aliasNode } = createUserStub();
    const gun = createGunStub(user);

    const controller = createLoginStatusController({
      root: window,
      doc: document,
      gun,
      user,
      loginLink,
      commandCentralElement: commandCentral
    });

    controller.init();

    const noisyKey = 'U8TlH9jJEDW7j-mg40n9BJOoSGHm8M6_cxPuXeK.M4n8YnHIKufYG_icvJj0JFna4yQe2264rQxsoS3tv0w!';

    user.is = { alias: noisyKey, pub: 'abcdefghijklmnopqrstuvwxyz1234567890' };
    gun.emit('auth');

    expect(loginLink.textContent).toBe('Account');

    aliasNode.emit(noisyKey);

    expect(loginLink.textContent).toBe('Account');
  });

  it('ignores SEA encrypted alias payloads', () => {
    const { loginLink, commandCentral } = setupDom();
    const { user, aliasNode } = createUserStub();
    const gun = createGunStub(user);

    const controller = createLoginStatusController({
      root: window,
      doc: document,
      gun,
      user,
      loginLink,
      commandCentralElement: commandCentral
    });

    controller.init();

    const seaPayload = 'SEA{"ct":"Y9+Vds1vJb==","iv":"8zhp","s":"5w"}';

    user.is = { alias: seaPayload };
    gun.emit('auth');

    expect(loginLink.textContent).toBe('Account');

    aliasNode.emit(seaPayload);

    expect(loginLink.textContent).toBe('Account');
  });

  it('shows the Command Central section when the preference is enabled', () => {
    const { loginLink, commandCentral } = setupDom();
    const { user, commandCentralPrimary } = createUserStub();
    const gun = createGunStub(user);

    const controller = createLoginStatusController({
      root: window,
      doc: document,
      gun,
      user,
      loginLink,
      commandCentralElement: commandCentral
    });

    controller.init();
    user.is = { alias: 'Thomas' };
    gun.emit('auth');

    expect(commandCentral.hidden).toBe(true);

    const primaryCallback = commandCentralPrimary.on.mock.calls[0][0];
    primaryCallback(true);

    expect(commandCentral.hidden).toBe(false);
    expect(commandCentral.dataset.commandCentral).toBe('enabled');
  });
});
