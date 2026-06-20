export const ADMIN_ALIAS = 'tmsteph';
export const ACCESS_ROOT = 'tmsteph-tantra-access-v1';
export const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';

export const scenes = Object.freeze([
  {
    title: 'Threshold portrait',
    image: 'assets/threshold-portrait.jpg',
    alt: 'Woman resting at the edge of a blue pool',
  },
  {
    title: 'Sunlit crouch',
    image: 'assets/sunlit-crouch.jpg',
    alt: 'Woman crouching in warm courtyard light',
  },
  {
    title: 'Waterline presence',
    image: 'assets/waterline-presence.jpg',
    alt: 'Woman standing in a sunlit pool',
  },
  {
    title: 'Seated breath',
    image: 'assets/seated-breath.jpg',
    alt: 'Woman sitting cross-legged in a courtyard',
  },
  {
    title: 'Courtyard profile',
    image: 'assets/courtyard-profile.jpg',
    alt: 'Woman standing in profile in a courtyard',
  },
  {
    title: 'Golden line',
    image: 'assets/golden-line.jpg',
    alt: 'Woman posing in warm sunlit shadows',
  },
  {
    title: 'Open stance',
    image: 'assets/open-stance.jpg',
    alt: 'Woman holding a wide movement stance',
  },
  {
    title: 'Tree prayer',
    image: 'assets/tree-prayer.jpg',
    alt: 'Woman holding a tree pose with hands in prayer',
  },
]);

export const practiceReferences = Object.freeze([
  {
    title: 'Lingam massage reference',
    source: 'xHamster',
    url: 'https://xhamster.com/videos/lingam-massage-will-relax-him-9419776',
    note: 'External adult practice reference. Open only from the approved private room.',
  },
  {
    title: 'Discovering Tantra reference',
    source: 'xHamster',
    url: 'https://xhamster.com/videos/discovering-tantra-xhZY9Ev',
    note: 'External adult practice reference. Open only from the approved private room.',
  },
]);

export function normalizeAlias(alias) {
  return String(alias || '').trim();
}

export function createAccessKey(alias) {
  return normalizeAlias(alias)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isAdminAlias(alias) {
  return createAccessKey(alias) === ADMIN_ALIAS;
}

export function canViewTantra({ alias, request }) {
  return isAdminAlias(alias) || request?.status === 'approved';
}

export function canReviewTantra(alias) {
  return isAdminAlias(alias);
}

function formatDate(timestamp) {
  if (!timestamp) {
    return 'No timestamp';
  }
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (err) {
    return 'Timestamp unavailable';
  }
}

function setStatus(message, state = 'info') {
  const status = document.getElementById('tantra-status');
  if (!status) {
    return;
  }
  status.textContent = message;
  status.dataset.state = state;
}

function setSignedInUi(alias, signedIn) {
  const authForm = document.getElementById('tantra-auth-form');
  const account = document.getElementById('tantra-account');
  const aliasDisplay = document.getElementById('tantra-current-alias');

  if (authForm) {
    authForm.hidden = signedIn;
  }
  if (account) {
    account.hidden = !signedIn;
  }
  if (aliasDisplay) {
    aliasDisplay.textContent = alias || 'Account';
  }
}

function renderGallery() {
  const gallery = document.getElementById('tantra-gallery');
  if (!gallery || gallery.dataset.rendered === 'true') {
    return;
  }

  scenes.forEach((scene) => {
    const figure = document.createElement('figure');
    figure.className = 'tantra-card';

    const image = document.createElement('img');
    image.src = scene.image;
    image.alt = scene.alt;
    image.loading = 'lazy';

    const caption = document.createElement('figcaption');
    caption.textContent = scene.title;

    figure.append(image, caption);
    gallery.append(figure);
  });

  gallery.dataset.rendered = 'true';
}

function renderPracticeReferences() {
  const list = document.getElementById('tantra-reference-list');
  if (!list || list.dataset.rendered === 'true') {
    return;
  }

  practiceReferences.forEach((reference) => {
    const card = document.createElement('article');
    card.className = 'tantra-reference-card';

    const heading = document.createElement('h4');
    heading.textContent = reference.title;

    const note = document.createElement('p');
    note.textContent = reference.note;

    const link = document.createElement('a');
    link.className = 'btn-secondary';
    link.href = reference.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Open on ${reference.source}`;

    card.append(heading, note, link);
    list.append(card);
  });

  list.dataset.rendered = 'true';
}

function showPrivateRoom(show) {
  const privateRoom = document.getElementById('tantra-private');
  if (!privateRoom) {
    return;
  }
  privateRoom.hidden = !show;
  if (show) {
    renderGallery();
    renderPracticeReferences();
  }
}

function renderAdminList({ list, requestsNode, requests }) {
  if (!list) {
    return;
  }

  const entries = [...requests.values()]
    .filter((request) => request && request.alias)
    .sort((a, b) => String(b.updatedAt || b.requestedAt || '').localeCompare(String(a.updatedAt || a.requestedAt || '')));

  list.innerHTML = '';

  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'tantra-request';
    empty.textContent = 'No access requests yet.';
    list.append(empty);
    return;
  }

  entries.forEach((request) => {
    const item = document.createElement('li');
    item.className = 'tantra-request';

    const meta = document.createElement('div');
    meta.className = 'tantra-request__meta';

    const name = document.createElement('strong');
    name.textContent = request.alias;

    const badge = document.createElement('span');
    badge.className = 'tantra-badge';
    badge.textContent = request.status || 'pending';

    meta.append(name, badge);

    const detail = document.createElement('p');
    detail.textContent = `Requested ${formatDate(request.requestedAt)}. Last updated ${formatDate(request.updatedAt)}.`;

    const actions = document.createElement('div');
    actions.className = 'tantra-actions';

    const approve = document.createElement('button');
    approve.className = 'btn-primary';
    approve.type = 'button';
    approve.textContent = 'Approve';
    approve.disabled = request.status === 'approved';
    approve.addEventListener('click', () => {
      requestsNode.get(request.key).put({
        ...request,
        status: 'approved',
        reviewedBy: ADMIN_ALIAS,
        updatedAt: new Date().toISOString(),
      });
    });

    const deny = document.createElement('button');
    deny.className = 'btn-secondary';
    deny.type = 'button';
    deny.textContent = 'Deny';
    deny.disabled = request.status === 'denied';
    deny.addEventListener('click', () => {
      requestsNode.get(request.key).put({
        ...request,
        status: 'denied',
        reviewedBy: ADMIN_ALIAS,
        updatedAt: new Date().toISOString(),
      });
    });

    actions.append(approve, deny);
    item.append(meta, detail, actions);
    list.append(item);
  });
}

export function initTantraGate({ root = window, doc = document } = {}) {
  const GunLib = root.Gun;
  if (!GunLib) {
    setStatus('Approval system unavailable. Refresh and try again.', 'denied');
    return null;
  }

  const gun = GunLib({ peers: [RELAY_URL], localStorage: true });
  const user = typeof gun.user === 'function' ? gun.user() : null;
  const requestsNode = gun.get(ACCESS_ROOT).get('requests');

  const authForm = doc.getElementById('tantra-auth-form');
  const aliasInput = doc.getElementById('tantra-alias');
  const passwordInput = doc.getElementById('tantra-password');
  const requestButton = doc.getElementById('tantra-request-access');
  const logoutButton = doc.getElementById('tantra-logout');
  const adminPanel = doc.getElementById('tantra-admin-panel');
  const requestList = doc.getElementById('tantra-request-list');
  const requestCache = new Map();

  let currentAlias = '';
  let currentKey = '';
  let currentRequestNode = null;

  const refreshAccessUi = (request = null) => {
    const admin = canReviewTantra(currentAlias);
    const approved = canViewTantra({ alias: currentAlias, request });

    showPrivateRoom(approved);
    if (adminPanel) {
      adminPanel.hidden = !admin;
    }
    if (requestButton) {
      requestButton.hidden = admin || approved;
      requestButton.textContent = request?.status === 'denied' ? 'Request again' : 'Request access';
    }

    if (admin) {
      setStatus('Admin mode active. You can approve or deny requests.', 'approved');
      return;
    }
    if (approved) {
      setStatus('Approved. Private room unlocked.', 'approved');
      return;
    }
    if (request?.status === 'pending') {
      setStatus('Request pending. Waiting for tmsteph approval.', 'pending');
      return;
    }
    if (request?.status === 'denied') {
      setStatus('Request denied. You may request again if this was a mistake.', 'denied');
      return;
    }
    setStatus('Signed in. Request access when ready.', 'info');
  };

  const bindCurrentRequest = () => {
    if (!currentKey) {
      return;
    }
    currentRequestNode = requestsNode.get(currentKey);
    currentRequestNode.on((request) => {
      refreshAccessUi(request || null);
    });
  };

  const handleSignedIn = () => {
    currentAlias = normalizeAlias(user?.is?.alias || aliasInput?.value || '');
    currentKey = createAccessKey(currentAlias);
    setSignedInUi(currentAlias, true);
    bindCurrentRequest();
    refreshAccessUi(null);
  };

  const submitAuth = (action) => {
    const alias = normalizeAlias(aliasInput?.value);
    const password = passwordInput?.value || '';
    if (!alias || !password) {
      setStatus('Enter an alias and password.', 'denied');
      return;
    }

    const done = (ack) => {
      if (ack?.err) {
        setStatus(ack.err, 'denied');
        return;
      }
      handleSignedIn();
    };

    if (action === 'create') {
      user.create(alias, password, (ack) => {
        if (ack?.err) {
          setStatus(ack.err, 'denied');
          return;
        }
        user.auth(alias, password, done, { remember: true });
      });
      return;
    }

    user.auth(alias, password, done, { remember: true });
  };

  authForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth(event.submitter?.dataset?.action || 'login');
  });

  requestButton?.addEventListener('click', () => {
    if (!currentAlias || !currentKey) {
      setStatus('Log in before requesting access.', 'denied');
      return;
    }
    requestsNode.get(currentKey).put({
      key: currentKey,
      alias: currentAlias,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setStatus('Request sent. Waiting for tmsteph approval.', 'pending');
  });

  logoutButton?.addEventListener('click', () => {
    if (typeof user?.leave === 'function') {
      user.leave();
    }
    currentAlias = '';
    currentKey = '';
    currentRequestNode = null;
    setSignedInUi('', false);
    showPrivateRoom(false);
    if (adminPanel) {
      adminPanel.hidden = true;
    }
    setStatus('Logged out.', 'info');
  });

  requestsNode.map().on((request, key) => {
    if (!request || !key) {
      requestCache.delete(key);
    } else {
      requestCache.set(key, { ...request, key });
    }
    if (canReviewTantra(currentAlias)) {
      renderAdminList({ list: requestList, requestsNode, requests: requestCache });
    }
  });

  gun.on('auth', handleSignedIn);

  try {
    user?.recall?.({ sessionStorage: true, localStorage: true });
  } catch (err) {
    // Manual login remains available.
  }

  setSignedInUi('', false);
  showPrivateRoom(false);
  setStatus('Log in or create an account to request access.', 'info');

  return {
    gun,
    user,
    requestsNode,
  };
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('tantra-auth-form')) {
        initTantraGate();
      }
    });
  } else if (document.getElementById('tantra-auth-form')) {
    initTantraGate();
  }
}
