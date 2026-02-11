(function () {
    const root = typeof window !== 'undefined' ? window : undefined;
    const Gun = root?.Gun;
    const RELAY_URL = 'https://gun-relay-3dvr.fly.dev/gun';
    const peers = Object.freeze([RELAY_URL]);
    const gun = Gun({ peers, localStorage: true });
    const user = gun.user();
    const RECALL_OPTIONS = { sessionStorage: true, localStorage: true };
    const AUTH_OPTIONS = { remember: true, sessionStorage: false, localStorage: true };
    const CROSS_TAB_PAIR_KEY = 'gun:cross-tab:pair';
    const safeGet = (node, key) => (typeof node?.get === 'function' ? node.get(key) : null);
    const looksLikePub = (value) => typeof value === 'string' && value.length > 40 && value.includes('.') && !value.includes(' ');
    const sanitizeAlias = (alias) => {
        if (typeof alias !== 'string') {
            return '';
        }
        const trimmed = alias.trim();
        if (!trimmed.length || looksLikePub(trimmed)) {
            return '';
        }
        return trimmed;
    };
    const getElement = (id) => document.getElementById(id);
    const authSection = getElement('auth-section');
    const adminPanel = getElement('admin-panel');
    const authForm = getElement('auth-form');
    const authHeading = getElement('auth-heading');
    const authSubmit = getElement('auth-submit');
    const authToggleText = getElement('auth-toggle-text');
    const toggleAuthBtn = getElement('toggle-auth');
    const authMessage = getElement('auth-message');
    const panelMessage = getElement('panel-message');
    const aliasDisplay = getElement('alias-display');
    const logoutBtn = getElement('logout-btn');
    const statusForm = getElement('status-form');
    const statusInput = getElement('status-input');
    const statusPreview = getElement('status-preview');
    const noteForm = getElement('note-form');
    const noteInput = getElement('note-input');
    const notePreview = getElement('note-preview');
    const commandCentralForm = getElement('command-central-form');
    const commandCentralToggle = getElement('command-central-toggle');
    const commandCentralPreview = getElement('command-central-preview');
    const photoForm = getElement('photo-upload-form');
    const photoFileInput = getElement('photo-file');
    const photoCaptionInput = getElement('photo-caption');
    const photoList = getElement('photo-list');
    const photoMessage = getElement('photo-message');
    const aliasInput = getElement('alias');
    const passwordInput = getElement('password');
    const passwordToggle = getElement('password-toggle');
    const SHARED_APP_KEY = 'portal.3dvr.tech';
    const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
    const getSharedApp = () => safeGet(safeGet(user, 'apps'), SHARED_APP_KEY);
    const getSharedProfile = () => safeGet(getSharedApp(), 'profile');
    const getSharedDashboard = () => safeGet(getSharedApp(), 'dashboard');
    const getSharedPhotos = () => safeGet(getSharedApp(), 'photos');
    const getLegacyProfile = () => safeGet(user, 'profile');
    const getLegacyDashboard = () => safeGet(user, 'dashboard');
    const getLegacyPhotos = () => safeGet(user, 'photos');
    let mode = 'login';
    let listenersAttached = false;
    let hasConnectedPeer = false;
    let connectionNoticeTimeout = null;
    let photoMessageTimeout = null;
    let hasRecalled = false;
    let cachedAlias = '';
    const photoCache = new Map();
    let photoListenersAttached = false;
    const toBoolean = (value) => value === true || value === 'true';
    const getSessionStorage = () => {
        try {
            return window.sessionStorage;
        }
        catch (err) {
            return null;
        }
    };
    const getLocalStorage = () => {
        try {
            return window.localStorage;
        }
        catch (err) {
            return null;
        }
    };
    const persistCrossTabPair = () => {
        const sS = getSessionStorage();
        const lS = getLocalStorage();
        if (!sS || !lS) {
            return;
        }
        const pair = sS.getItem('pair');
        if (!pair) {
            return;
        }
        lS.setItem(CROSS_TAB_PAIR_KEY, pair);
    };
    const hydrateSessionPairFromLocal = () => {
        const sS = getSessionStorage();
        const lS = getLocalStorage();
        if (!sS || !lS) {
            return;
        }
        if (sS.getItem('pair')) {
            return;
        }
        const pair = lS.getItem(CROSS_TAB_PAIR_KEY);
        if (!pair) {
            return;
        }
        sS.setItem('recall', 'true');
        sS.setItem('pair', pair);
    };
    const clearCrossTabPair = () => {
        const lS = getLocalStorage();
        if (lS) {
            lS.removeItem(CROSS_TAB_PAIR_KEY);
        }
    };
    const getAliasNodes = () => [
        safeGet(user, 'alias'),
        safeGet(getSharedProfile(), 'alias'),
        safeGet(getLegacyProfile(), 'alias')
    ].filter(Boolean);
    const recallUser = () => {
        if (hasRecalled || typeof user.recall !== 'function') {
            return;
        }
        hasRecalled = true;
        try {
            hydrateSessionPairFromLocal();
            user.recall(RECALL_OPTIONS);
        }
        catch (err) {
            // Ignore recall errors. We'll rely on manual login if automatic recall fails.
        }
    };
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
    const setPhotoMessage = (message, type = 'info') => {
        if (!photoMessage) {
            return;
        }
        photoMessage.textContent = message;
        photoMessage.dataset.state = message ? type : '';
        if (photoMessageTimeout) {
            clearTimeout(photoMessageTimeout);
            photoMessageTimeout = null;
        }
        if (message) {
            photoMessageTimeout = setTimeout(() => {
                if (photoMessage.textContent === message) {
                    photoMessage.textContent = '';
                    photoMessage.dataset.state = '';
                }
            }, 4000);
        }
    };
    const resetPhotoVaultState = () => {
        photoCache.clear();
        if (photoList) {
            photoList.innerHTML = '<p class="empty-state-text">No photos uploaded yet.</p>';
        }
        if (photoForm) {
            photoForm.reset();
        }
        setPhotoMessage('', 'info');
    };
    const createPhotoId = () => {
        if (typeof Gun?.text?.random === 'function') {
            return Gun.text.random(18);
        }
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };
    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
        reader.readAsDataURL(file);
    });
    const formatBytes = (bytes) => {
        if (!Number.isFinite(bytes)) {
            return '';
        }
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    const formatTimestamp = (timestamp) => {
        if (!timestamp) {
            return '';
        }
        try {
            return new Date(timestamp).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        }
        catch (err) {
            return '';
        }
    };
    const sanitizeCaption = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().slice(0, 120);
    };
    const getPhotoNode = (photosNode, id) => {
        if (!id) {
            return null;
        }
        return typeof photosNode?.get === 'function' ? photosNode.get(id) : null;
    };
    const renderPhotoList = () => {
        if (!photoList) {
            return;
        }
        if (!photoCache.size) {
            photoList.innerHTML = '<p class="empty-state-text">No photos uploaded yet.</p>';
            return;
        }
        const fragment = document.createDocumentFragment();
        const sortedPhotos = Array.from(photoCache.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        sortedPhotos.forEach((photo) => {
            const card = document.createElement('article');
            card.className = 'photo-card';
            const img = document.createElement('img');
            img.src = photo.data;
            img.alt = photo.caption ? `Photo: ${photo.caption}` : `Photo uploaded ${formatTimestamp(photo.createdAt)}`;
            card.appendChild(img);
            const details = document.createElement('div');
            details.className = 'photo-details';
            const title = document.createElement('h4');
            title.textContent = photo.caption || photo.name || 'Photo';
            details.appendChild(title);
            const meta = document.createElement('p');
            meta.className = 'photo-meta';
            const sizeLabel = photo.size ? ` • ${formatBytes(photo.size)}` : '';
            meta.textContent = `${formatTimestamp(photo.createdAt) || 'Unknown date'}${sizeLabel}`;
            details.appendChild(meta);
            if (photo.caption) {
                const captionParagraph = document.createElement('p');
                captionParagraph.className = 'photo-caption';
                captionParagraph.textContent = photo.caption;
                details.appendChild(captionParagraph);
            }
            const actions = document.createElement('div');
            actions.className = 'photo-actions';
            const downloadLink = document.createElement('a');
            downloadLink.href = photo.data;
            downloadLink.download = photo.name || 'photo.jpg';
            downloadLink.textContent = 'Download';
            downloadLink.className = 'photo-action-button';
            downloadLink.setAttribute('role', 'button');
            actions.appendChild(downloadLink);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'photo-action-button';
            deleteButton.dataset.photoDelete = 'true';
            deleteButton.dataset.photoId = photo.id;
            deleteButton.textContent = 'Delete';
            actions.appendChild(deleteButton);
            details.appendChild(actions);
            card.appendChild(details);
            fragment.appendChild(card);
        });
        photoList.innerHTML = '';
        photoList.appendChild(fragment);
    };
    const attachPhotoLibraryListeners = () => {
        if (photoListenersAttached || !photoList || typeof Gun?.SEA?.decrypt !== 'function') {
            return;
        }
        photoListenersAttached = true;
        const attach = (node, source) => {
            if (!node || typeof node.map !== 'function') {
                return;
            }
            node.map().on(async (record, key) => {
                if (!key) {
                    return;
                }
                if (!record) {
                    if (photoCache.delete(key)) {
                        renderPhotoList();
                    }
                    return;
                }
                if (!record.encrypted) {
                    return;
                }
                try {
                    const decrypted = await Gun.SEA.decrypt(record.encrypted, user._?.sea);
                    const decryptedRecord = decrypted && typeof decrypted === 'object' ? decrypted : null;
                    if (!decryptedRecord || !('data' in decryptedRecord)) {
                        return;
                    }
                    const existing = photoCache.get(key);
                    if (existing && existing.source === 'shared' && source === 'legacy') {
                        return;
                    }
                    photoCache.set(key, { ...decryptedRecord, id: key, source });
                    renderPhotoList();
                }
                catch (err) {
                    setPhotoMessage('Unable to decrypt one of your photos. Try logging out and back in.', 'warning');
                }
            });
        };
        attach(getSharedPhotos(), 'shared');
        attach(getLegacyPhotos(), 'legacy');
    };
    const deletePhotoById = (photoId) => {
        if (!photoId) {
            return;
        }
        setPhotoMessage('Removing photo...', 'info');
        const targets = [getPhotoNode(getSharedPhotos(), photoId), getPhotoNode(getLegacyPhotos(), photoId)].filter(Boolean);
        if (!targets.length) {
            photoCache.delete(photoId);
            renderPhotoList();
            setPhotoMessage('Photo removed locally.', 'success');
            return;
        }
        putToMultipleNodes(null, targets, () => {
            photoCache.delete(photoId);
            renderPhotoList();
            const message = hasConnectedPeer
                ? 'Photo deleted from your vault.'
                : 'Photo removed locally. It will disappear elsewhere when reconnected.';
            setPhotoMessage(message, hasConnectedPeer ? 'success' : 'warning');
        });
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
        }
        else {
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
                setAuthMessage('Unable to reach the sync service. You can use cached credentials, and changes will sync once a connection is restored.', 'warning');
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
        }
        else {
            setPanelMessage(`Connected to ${peerName}.`, 'success');
        }
    });
    gun.on('bye', () => {
        const activePeers = Object.values(gun._.opt?.peers || {}).filter((p) => p?.wire);
        if (!activePeers.length) {
            hasConnectedPeer = false;
            if (adminPanel.hidden) {
                setAuthMessage('Attempting to reconnect to the sync service...', 'warning');
            }
            else {
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
        getAliasNodes().forEach((node) => {
            if (typeof node?.put === 'function') {
                node.put(aliasValue);
            }
        });
    };
    const updateAliasDisplay = (aliasValue) => {
        if (!aliasDisplay) {
            return;
        }
        const aliasCandidate = sanitizeAlias(aliasValue) ||
            sanitizeAlias(cachedAlias) ||
            (looksLikePub(user.is?.alias) ? '' : sanitizeAlias(user.is?.alias)) ||
            (looksLikePub(user._?.alias) ? '' : sanitizeAlias(user._?.alias)) ||
            sanitizeAlias(aliasInput?.value);
        const finalAlias = aliasCandidate || 'Admin';
        aliasDisplay.textContent = finalAlias;
        if (aliasCandidate) {
            persistAlias(aliasCandidate);
        }
    };
    const initAliasBinding = () => {
        const aliasNodes = getAliasNodes().filter((node) => typeof node?.on === 'function');
        if (!aliasNodes.length) {
            return;
        }
        aliasNodes.forEach((aliasNode) => {
            aliasNode.on((value) => {
                const sanitized = sanitizeAlias(value);
                if (sanitized) {
                    cachedAlias = sanitized;
                    if (user.is) {
                        updateAliasDisplay(sanitized);
                    }
                }
            });
        });
    };
    const fetchAliasOnce = () => {
        getAliasNodes().forEach((aliasNode) => {
            if (typeof aliasNode?.once !== 'function') {
                return;
            }
            aliasNode.once((value) => {
                const sanitized = sanitizeAlias(value);
                if (sanitized) {
                    cachedAlias = sanitized;
                    if (user.is) {
                        updateAliasDisplay(sanitized);
                    }
                }
            });
        });
    };
    const showAdminPanel = () => {
        authSection.hidden = true;
        adminPanel.hidden = false;
        updateAliasDisplay();
        fetchAliasOnce();
        if (typeof window !== 'undefined') {
            if (window.history?.replaceState) {
                window.history.replaceState(null, '', '#admin-panel');
            }
            else {
                window.location.hash = '#admin-panel';
            }
        }
        attachUserListeners();
        clearConnectionNoticeTimeout();
    };
    const showAuthPanel = (message = '') => {
        user.leave();
        clearCrossTabPair();
        adminPanel.hidden = true;
        authSection.hidden = false;
        resetPhotoVaultState();
        if (message) {
            setAuthMessage(message, 'info');
        }
        if (typeof window !== 'undefined') {
            if (window.history?.replaceState) {
                window.history.replaceState(null, '', '#auth-section');
            }
            else {
                window.location.hash = '#auth-section';
            }
        }
        if (!hasConnectedPeer) {
            scheduleConnectionWarning();
        }
    };
    const attachUserListeners = () => {
        if (listenersAttached)
            return;
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
        attachPhotoLibraryListeners();
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
                    }
                    else if (typeof onSuccess === 'function') {
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
                }, AUTH_OPTIONS);
            });
        }
        else {
            user.auth(alias, password, (ack) => {
                if (ack.err) {
                    const errorMessage = typeof ack.err === 'string' && ack.err.includes('Wrong user or password')
                        ? 'Incorrect alias or password. Please try again, or create an account first.'
                        : ack.err || 'Login failed. Please try again.';
                    setAuthMessage(errorMessage, 'error');
                    return;
                }
                setAuthMessage('Login successful! Redirecting...', 'success');
                persistAlias(alias);
                showAdminPanel();
            }, AUTH_OPTIONS);
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
            }
            else {
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
            }
            else {
                setPanelMessage('Note saved locally. It will sync when a connection is available.', 'warning');
            }
        });
    });
    if (commandCentralForm && commandCentralToggle) {
        commandCentralForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const enabled = commandCentralToggle.checked;
            putToMultipleNodes(enabled, [
                safeGet(getSharedDashboard(), 'commandCentralEnabled'),
                safeGet(getLegacyDashboard(), 'commandCentralEnabled')
            ], () => {
                if (hasConnectedPeer) {
                    setPanelMessage('Command Central preference saved!', 'success');
                }
                else {
                    setPanelMessage('Preference saved locally. It will sync when a connection is available.', 'warning');
                }
            });
        });
    }
    if (photoForm && photoFileInput) {
        photoForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!user.is) {
                setPhotoMessage('Please log in to upload photos.', 'error');
                return;
            }
            const file = photoFileInput.files && photoFileInput.files[0];
            if (!file) {
                setPhotoMessage('Choose a photo to upload.', 'error');
                return;
            }
            if (!file.type || !file.type.startsWith('image/')) {
                setPhotoMessage('Only image files are supported.', 'error');
                return;
            }
            if (file.size > MAX_PHOTO_SIZE_BYTES) {
                setPhotoMessage('Please choose an image smaller than 10 MB.', 'error');
                return;
            }
            if (!Gun || !Gun.SEA || typeof Gun.SEA.encrypt !== 'function' || !user._?.sea) {
                setPhotoMessage('Encryption service unavailable. Refresh and try again.', 'error');
                return;
            }
            setPhotoMessage('Encrypting photo...', 'info');
            try {
                const dataUrl = await readFileAsDataUrl(file);
                const caption = sanitizeCaption(photoCaptionInput ? photoCaptionInput.value : '');
                const payload = {
                    id: createPhotoId(),
                    name: file.name || 'photo.jpg',
                    type: file.type,
                    size: file.size,
                    caption,
                    createdAt: Date.now(),
                    data: dataUrl
                };
                const encrypted = await Gun.SEA.encrypt(payload, user._.sea);
                if (!encrypted) {
                    throw new Error('Encryption failed');
                }
                const targets = [
                    getPhotoNode(getSharedPhotos(), payload.id),
                    getPhotoNode(getLegacyPhotos(), payload.id)
                ].filter(Boolean);
                if (!targets.length) {
                    setPhotoMessage('Unable to reach your photo vault. Try again after reconnecting.', 'error');
                    return;
                }
                putToMultipleNodes({ id: payload.id, encrypted }, targets, () => {
                    const message = hasConnectedPeer
                        ? 'Photo uploaded and synced!'
                        : 'Photo saved locally. It will sync when a connection is available.';
                    setPhotoMessage(message, hasConnectedPeer ? 'success' : 'warning');
                    photoForm.reset();
                });
            }
            catch (err) {
                setPhotoMessage('Unable to encrypt or upload that photo. Please try again.', 'error');
            }
        });
    }
    if (photoList) {
        photoList.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const deleteBtn = target?.closest('[data-photo-delete="true"]');
            if (!deleteBtn) {
                return;
            }
            const { photoId } = deleteBtn.dataset;
            deletePhotoById(photoId);
        });
    }
    gun.on('auth', () => {
        persistCrossTabPair();
        persistAlias(user.is?.alias);
        showAdminPanel();
        setAuthMessage('');
    });
    initAliasBinding();
    recallUser();
    window.addEventListener('load', () => {
        if (user.is) {
            showAdminPanel();
        }
    });
})();
