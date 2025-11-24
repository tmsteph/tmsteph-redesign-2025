(function () {
  const grid = document.querySelector('[data-multiview-grid]');
  const input = document.getElementById('multiview-input');
  const addButton = document.querySelector('[data-add-video]');
  const clearButton = document.querySelector('[data-clear-videos]');
  const searchInput = document.querySelector('[data-multiview-search]');
  const status = document.querySelector('[data-multiview-status]');
  const playerOptions = document.querySelectorAll('[data-player-option]');
  const playerHelp = document.querySelector('[data-player-help]');
  const diagnosticsButton = document.querySelector('[data-run-diagnostics]');
  const diagnosticsOutput = document.querySelector('[data-diagnostics-output]');

  if (!grid || !input || !addButton || !clearButton || !status) {
    return;
  }

  const defaultVideos = (grid.dataset.defaultVideos || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const videos = [...new Set(defaultVideos)];

  const HOSTS = {
    privacy: {
      id: 'privacy',
      host: 'https://www.youtube-nocookie.com',
      embedPath: '/embed/',
      fallbackAllowed: true,
      help:
        'Ad-free mode keeps everything on youtube-nocookie.com so sign-in prompts stay hidden and tracking is limited.',
      status:
        'Back on the ad-free youtube-nocookie player. Sign-in prompts will stay hidden while videos load privately.',
      tone: 'info',
    },
    standard: {
      id: 'standard',
      host: 'https://www.youtube.com',
      embedPath: '/embed/',
      fallbackAllowed: false,
      help: 'Standard mode loads youtube.com so you can sign in, comment, or use playlists tied to your account.',
      status: 'Using the standard YouTube player so you can sign in or interact with the video.',
      tone: 'warning',
    },
    proxy: {
      id: 'proxy',
      host: 'https://piped.video',
      embedPath: '/embed/',
      fallbackAllowed: false,
      help:
        'Proxy mode loads piped.video, an open-source frontend that blocks ads automatically but does not support Google sign-in.',
      status: 'Using the piped.video proxy player. Ads are stripped but account features stay disabled.',
      tone: 'info',
    },
  };

  const HOST_PREFERENCE_KEY = 'multiview-player-mode';
  const DEFAULT_MODE = 'standard';
  const FALLBACK_DELAY = 5000;

  const DIAGNOSTIC_TARGETS = [
    {
      id: 'privacy',
      label: 'Ad-free youtube-nocookie player',
      url: 'https://www.youtube-nocookie.com/favicon.ico',
      suggestion: 'switching to Standard or Proxy mode',
    },
    {
      id: 'standard',
      label: 'Standard youtube.com embed',
      url: 'https://www.youtube.com/favicon.ico',
      suggestion: 'opening the video directly on youtube.com or trying Proxy mode',
    },
    {
      id: 'proxy',
      label: 'Proxy piped.video player',
      url: 'https://piped.video/favicon.ico',
      suggestion: 'switching back to Ad-free or Standard mode',
    },
  ];

  let fallbackUsed = false;
  let preferredMode = DEFAULT_MODE;

  try {
    const storedPreference = window.localStorage?.getItem(HOST_PREFERENCE_KEY);
    if (storedPreference && HOSTS[storedPreference]) {
      preferredMode = storedPreference;
    }
  } catch (error) {
    // Ignore storage errors
  }

  function getHostConfig(mode) {
    return HOSTS[mode] || HOSTS[DEFAULT_MODE];
  }

  function updatePlayerInputs(mode) {
    if (!playerOptions.length) return;
    playerOptions.forEach((option) => {
      const value = option.value;
      const isSelected = value === mode;
      option.checked = isSelected;
      option.setAttribute('aria-checked', String(isSelected));
    });
  }

  function updatePlayerHelp(mode) {
    if (!playerHelp) return;
    const config = getHostConfig(mode);
    playerHelp.dataset.mode = config.id;
    playerHelp.textContent = config.help;
  }

  updatePlayerInputs(preferredMode);
  updatePlayerHelp(preferredMode);

  function persistPreferredMode(mode) {
    try {
      window.localStorage?.setItem(HOST_PREFERENCE_KEY, mode);
    } catch (error) {
      // Ignore storage errors
    }
  }

  function setPreferredMode(mode) {
    const nextMode = HOSTS[mode] ? mode : DEFAULT_MODE;
    if (preferredMode === nextMode) return;
    preferredMode = nextMode;
    persistPreferredMode(nextMode);
    updatePlayerInputs(nextMode);
    updatePlayerHelp(nextMode);
    const config = getHostConfig(nextMode);
    updateStatus(config.status, config.tone);
    hydrateFrames();
  }

  function buildEmbedUrl(mode, id) {
    const config = getHostConfig(mode);
    const params = new URLSearchParams({
      rel: '0',
      playsinline: '1',
    });

    if (mode !== 'proxy') {
      params.set('modestbranding', '1');
    }

    if (mode === 'standard') {
      params.set('enablejsapi', '1');
      if (window.location.origin && window.location.origin.startsWith('http')) {
        params.set('origin', window.location.origin);
      }
    }

    if (mode === 'proxy') {
      params.set('autoplay', '0');
      params.set('controls', '1');
    }

    return `${config.host}${config.embedPath}${id}?${params.toString()}`;
  }

  function applyEmbedSource(iframe, mode) {
    iframe.dataset.currentMode = mode;
    iframe.src = buildEmbedUrl(mode, iframe.dataset.videoId);
  }

  function scheduleFallback(iframe, notice, mode) {
    if (!notice || !HOSTS[mode]?.fallbackAllowed) return;

    const timerId = window.setTimeout(() => {
      if (
        iframe.dataset.loaded === 'true' ||
        iframe.dataset.currentMode !== mode ||
        notice.dataset.fallbackShown === 'true'
      ) {
        return;
      }

      notice.hidden = false;
      notice.dataset.fallbackShown = 'true';
      if (!fallbackUsed) {
        fallbackUsed = true;
        updateStatus(
          'One video refused the ad-free player. Use the backup button if you still want to load it.',
          'warning',
        );
      }
    }, FALLBACK_DELAY);

    iframe.dataset.fallbackTimer = String(timerId);
  }

  function createFrame(id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'multiview-frame-wrapper';

    const iframe = document.createElement('iframe');
    iframe.className = 'multiview-frame';
    iframe.allowFullscreen = true;
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; allow-storage-access-by-user-activation';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = `YouTube video ${id}`;
    iframe.dataset.videoId = id;

    iframe.addEventListener('load', () => {
      iframe.dataset.loaded = 'true';
      if (iframe.dataset.fallbackTimer) {
        window.clearTimeout(Number(iframe.dataset.fallbackTimer));
        delete iframe.dataset.fallbackTimer;
      }
    });

    iframe.addEventListener('error', () => {
      const notice = wrapper.querySelector('.multiview-fallback-note');
      if (notice) {
        notice.hidden = false;
        notice.dataset.fallbackShown = 'true';
      }
    });

    wrapper.appendChild(iframe);

    const link = document.createElement('a');
    link.href = `https://youtu.be/${id}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'multiview-open-link';
    link.textContent = 'Open on YouTube';

    const actions = document.createElement('div');
    actions.className = 'multiview-frame-actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'multiview-remove-button';
    deleteButton.textContent = 'Remove';
    deleteButton.addEventListener('click', () => removeVideo(id));

    actions.appendChild(link);
    actions.appendChild(deleteButton);
    wrapper.appendChild(actions);

    const fallbackNote = document.createElement('div');
    fallbackNote.className = 'multiview-fallback-note';
    fallbackNote.hidden = !getHostConfig(preferredMode).fallbackAllowed;
    fallbackNote.dataset.fallbackShown = 'false';

    const noteText = document.createElement('p');
    noteText.textContent = 'Having trouble loading this video ad-free?';
    fallbackNote.appendChild(noteText);

    const fallbackButton = document.createElement('button');
    fallbackButton.type = 'button';
    fallbackButton.className = 'multiview-fallback-button';
    fallbackButton.textContent = 'Load standard YouTube player (shows ads & sign-in)';
    fallbackButton.addEventListener('click', () => {
      applyEmbedSource(iframe, 'standard');
      fallbackNote.hidden = true;
      fallbackNote.dataset.fallbackShown = 'true';
      fallbackUsed = true;
      updateStatus(
        'Loaded one video with the standard player. Ads or sign-in prompts may appear there.',
        'warning',
      );
    });

    fallbackNote.appendChild(fallbackButton);
    wrapper.appendChild(fallbackNote);

    return wrapper;
  }

  function hydrateFrames() {
    const frames = grid.querySelectorAll('iframe[data-video-id]');
    fallbackUsed = false;
    const config = getHostConfig(preferredMode);
    const usingPrivacyMode = config.fallbackAllowed;

    frames.forEach((iframe, index) => {
      iframe.removeAttribute('src');
      iframe.dataset.loaded = 'false';
      iframe.dataset.currentMode = preferredMode;

      const notice = iframe.closest('.multiview-frame-wrapper')?.querySelector('.multiview-fallback-note');
      if (notice) {
        notice.hidden = !usingPrivacyMode;
        notice.dataset.fallbackShown = usingPrivacyMode ? 'false' : 'true';
      }

      window.setTimeout(() => {
        applyEmbedSource(iframe, preferredMode);
        if (usingPrivacyMode) {
          scheduleFallback(iframe, notice, preferredMode);
        }
      }, index * 350);
    });
  }

  function getFilteredVideos() {
    if (!searchInput) {
      return [...videos];
    }

    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      return [...videos];
    }

    return videos.filter((id) => id.toLowerCase().includes(query));
  }

  function renderGrid() {
    grid.innerHTML = '';

    if (!videos.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Add a link to start watching videos together.';
      empty.style.opacity = '0.8';
      empty.style.margin = '1rem auto';
      grid.appendChild(empty);
      return;
    }

    const filteredVideos = getFilteredVideos();

    if (!filteredVideos.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No videos match your search yet.';
      empty.style.opacity = '0.8';
      empty.style.margin = '1rem auto';
      grid.appendChild(empty);
      return;
    }

    filteredVideos.forEach((id) => {
      grid.appendChild(createFrame(id));
    });

    hydrateFrames();
  }

  function removeVideo(videoId) {
    const index = videos.indexOf(videoId);
    if (index === -1) return;
    videos.splice(index, 1);
    renderGrid();
    updateStatus('Removed that video from your theater.', videos.length ? 'info' : 'warning');
  }

  function updateStatus(message, tone = 'info') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function extractVideoId(value) {
    if (!value) return null;
    const trimmed = value.trim();
    const basicPattern = /^[a-zA-Z0-9_-]{11}$/;
    if (basicPattern.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtu.be')) {
        const [, id] = url.pathname.split('/');
        return basicPattern.test(id) ? id : null;
      }

      if (url.hostname.includes('youtube.com') || url.hostname.includes('piped.video')) {
        const id = url.searchParams.get('v');
        if (id && basicPattern.test(id)) {
          return id;
        }
        const parts = url.pathname.split('/').filter(Boolean);
        const embedIndex = parts.indexOf('embed');
        if (embedIndex > -1 && parts[embedIndex + 1] && basicPattern.test(parts[embedIndex + 1])) {
          return parts[embedIndex + 1];
        }
      }
    } catch (error) {
      // Ignore malformed URLs
    }

    return null;
  }

  function addVideo() {
    const value = input.value.trim();
    const videoId = extractVideoId(value);

    if (!videoId) {
      updateStatus('Please provide a valid YouTube link or video ID.', 'error');
      return;
    }

    if (videos.includes(videoId)) {
      updateStatus('That video is already in your theater.', 'warning');
      input.value = '';
      return;
    }

    videos.push(videoId);
    renderGrid();
    updateStatus('Video added! Enjoy the show.', 'success');
    input.value = '';
    input.focus();
  }

  function clearVideos() {
    videos.length = 0;
    renderGrid();
    updateStatus('Cleared all videos. Ready for a new mix?', 'info');
    input.focus();
  }

  function appendDiagnostic(message, tone = 'info') {
    if (!diagnosticsOutput) return;
    const item = document.createElement('li');
    item.textContent = message;
    item.dataset.tone = tone;
    diagnosticsOutput.appendChild(item);
  }

  function testImage(url, timeout = 5000) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const started = performance.now();
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, reason: 'timeout' });
      }, timeout);

      img.onload = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({ ok: true, duration: Math.round(performance.now() - started) });
      };

      img.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({ ok: false, reason: 'blocked' });
      };

      img.referrerPolicy = 'no-referrer';
      img.src = `${url}?_=${Date.now()}`;
    });
  }

  function testFirstPartyCookies() {
    try {
      const testName = `multiview_${Date.now()}`;
      document.cookie = `${testName}=1; SameSite=Lax`;
      const enabled = document.cookie.includes(`${testName}=1`);
      document.cookie = `${testName}=; expires=${new Date(0).toUTCString()}; SameSite=Lax`;
      return enabled;
    } catch (error) {
      return false;
    }
  }

  async function runDiagnostics() {
    if (!diagnosticsButton || !diagnosticsOutput) return;
    diagnosticsButton.disabled = true;
    const originalLabel = diagnosticsButton.textContent;
    diagnosticsButton.textContent = 'Running diagnostics…';
    diagnosticsOutput.innerHTML = '';

    appendDiagnostic(`Browser agent: ${navigator.userAgent}`);

    const cookiesEnabled = testFirstPartyCookies();
    appendDiagnostic(
      cookiesEnabled
        ? 'First-party cookies are enabled in this tab.'
        : 'First-party cookies appear blocked. Embedded sign-in flows will fail until they are allowed.',
      cookiesEnabled ? 'success' : 'error',
    );

    for (const target of DIAGNOSTIC_TARGETS) {
      const result = await testImage(target.url);
      if (result.ok) {
        appendDiagnostic(`${target.label} responded in ${result.duration}ms.`, 'success');
      } else {
        appendDiagnostic(`${target.label} failed (${result.reason}). Try ${target.suggestion}.`, 'error');
      }
    }

    appendDiagnostic('Diagnostics complete. Switch hosts or open the video directly if a test failed.', 'info');

    diagnosticsButton.disabled = false;
    diagnosticsButton.textContent = originalLabel;
  }

  addButton.addEventListener('click', addVideo);
  clearButton.addEventListener('click', clearVideos);
  playerOptions.forEach((option) => {
    option.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.checked) return;
      setPreferredMode(event.target.value);
    });
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addVideo();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderGrid();
    });
  }

  if (diagnosticsButton) {
    diagnosticsButton.addEventListener('click', runDiagnostics);
  }

  renderGrid();
})();
