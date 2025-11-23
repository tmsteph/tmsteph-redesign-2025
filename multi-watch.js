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
  const braveNote = document.querySelector('[data-brave-note]');
  const bravePanel = document.querySelector('[data-brave-panel]');
  const braveShieldsButton = document.querySelector('[data-open-brave-shields]');
  const braveSigninButton = document.querySelector('[data-open-brave-signin]');
  const historyPanel = document.querySelector('[data-history-panel]');
  const historyList = document.querySelector('[data-history-list]');
  const historyEmptyMessage = document.querySelector('[data-history-empty]');
  const clearHistoryButton = document.querySelector('[data-clear-history]');
  const youtubeSearchForm = document.querySelector('[data-youtube-search-form]');
  const youtubeQueryInput = document.querySelector('[data-youtube-query]');
  const youtubeSearchButton = document.querySelector('[data-youtube-search-button]');
  const youtubeResultsList = document.querySelector('[data-youtube-search-results]');
  const youtubeSearchStatus = document.querySelector('[data-youtube-search-status]');

  if (!grid || !input || !addButton || !clearButton || !status) {
    return;
  }

  const defaultVideos = (grid.dataset.defaultVideos || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const videos = [...new Set(defaultVideos)];
  let videoHistory = sanitizeHistory(readStorage(HISTORY_STORAGE_KEY, []));
  let volumePreferences = readStorage(VOLUME_STORAGE_KEY, {});
  if (typeof volumePreferences !== 'object' || volumePreferences === null) {
    volumePreferences = {};
  }

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
  const BRAVE_SHIELDS_HELP =
    'https://support.brave.com/hc/en-us/articles/360022806212-How-do-I-use-Shields-while-browsing';
  const YOUTUBE_SIGNIN_URL =
    'https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&hl=en&continue=https%3A%2F%2Fwww.youtube.com%2F';
  const HISTORY_STORAGE_KEY = 'multiview-history';
  const HISTORY_LIMIT = 12;
  const VOLUME_STORAGE_KEY = 'multiview-volume-preferences';
  const DEFAULT_VOLUME = 70;
  const YOUTUBE_SEARCH_ENDPOINTS = ['https://pipedapi.kavin.rocks/search'];
  const SEARCH_RESULTS_LIMIT = 8;
  const VIDEO_METADATA_ENDPOINT = 'https://noembed.com/embed';

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

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'undefined' ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore storage errors
    }
  }

  function sanitizeHistory(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry) => entry && typeof entry.id === 'string')
      .map((entry) => ({
        id: entry.id,
        title: typeof entry.title === 'string' ? entry.title : null,
      }));
  }

  function persistHistory() {
    writeStorage(HISTORY_STORAGE_KEY, videoHistory);
  }

  function persistVolume() {
    writeStorage(VOLUME_STORAGE_KEY, volumePreferences);
  }

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

  function getVideoVolume(videoId) {
    const stored = Number(volumePreferences?.[videoId]);
    if (Number.isFinite(stored)) {
      return Math.min(100, Math.max(0, stored));
    }
    return DEFAULT_VOLUME;
  }

  function setVideoVolumePreference(videoId, value) {
    const next = Math.min(100, Math.max(0, Math.round(value)));
    volumePreferences = {
      ...volumePreferences,
      [videoId]: next,
    };
    persistVolume();
    return next;
  }

  function sendPlayerCommand(iframe, command, args = []) {
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: command,
          args,
        }),
        '*',
      );
    } catch (error) {
      // Ignore messaging errors
    }
  }

  function applyVolumePreference(iframe) {
    if (!iframe || iframe.dataset.currentMode === 'proxy') return;
    const volume = getVideoVolume(iframe.dataset.videoId);
    sendPlayerCommand(iframe, 'setVolume', [volume]);
    if (volume === 0) {
      sendPlayerCommand(iframe, 'mute');
    } else {
      sendPlayerCommand(iframe, 'unMute');
    }
  }

  function scheduleVolumeSync(iframe, attempts = 4) {
    if (!iframe || iframe.dataset.currentMode === 'proxy') return;
    let runs = 0;
    const timer = window.setInterval(() => {
      if (!iframe || iframe.dataset.currentMode === 'proxy') {
        window.clearInterval(timer);
        return;
      }
      applyVolumePreference(iframe);
      runs += 1;
      if (runs >= attempts) {
        window.clearInterval(timer);
      }
    }, 700);
  }

  function handleVolumeInput(videoId, slider, iframe) {
    if (!slider) return;
    const nextVolume = setVideoVolumePreference(videoId, Number(slider.value));
    slider.value = String(nextVolume);
    if (iframe?.dataset.currentMode !== 'proxy') {
      applyVolumePreference(iframe);
    }
  }

  function updateVolumeControlsAvailability() {
    const disable = preferredMode === 'proxy';
    const sliders = grid.querySelectorAll('[data-volume-slider]');
    sliders.forEach((slider) => {
      slider.disabled = disable;
      const wrapper = slider.closest('.multiview-volume-control');
      if (wrapper) {
        wrapper.classList.toggle('is-disabled', disable);
      }
    });
  }

  function getHistoryTitle(entry) {
    if (!entry) return '';
    return entry.title && entry.title.trim() ? entry.title.trim() : `YouTube video ${entry.id}`;
  }

  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!videoHistory.length) {
      if (historyEmptyMessage) {
        historyEmptyMessage.hidden = false;
      }
      if (clearHistoryButton) {
        clearHistoryButton.disabled = true;
      }
      if (historyPanel) {
        historyPanel.dataset.hasHistory = 'false';
      }
      return;
    }

    if (historyPanel) {
      historyPanel.dataset.hasHistory = 'true';
    }
    if (historyEmptyMessage) {
      historyEmptyMessage.hidden = true;
    }
    if (clearHistoryButton) {
      clearHistoryButton.disabled = false;
    }

    videoHistory.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'multiview-history-item';

      const meta = document.createElement('div');
      meta.className = 'multiview-history-meta';

      const title = document.createElement('strong');
      title.textContent = getHistoryTitle(entry);
      meta.appendChild(title);

      const idBadge = document.createElement('small');
      idBadge.textContent = entry.id;
      meta.appendChild(idBadge);

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'multiview-history-add';
      addButton.textContent = 'Add to grid';
      addButton.addEventListener('click', () => {
        addVideoToTheater(entry.id, {
          title: entry.title,
          message: 'Loaded from your history. Enjoy the throwback!',
        });
      });

      item.appendChild(meta);
      item.appendChild(addButton);
      historyList.appendChild(item);
    });
  }

  function recordHistory({ id, title }) {
    if (!id) return;
    const cleanedTitle = title && title.trim() ? title.trim() : null;
    const filtered = videoHistory.filter((entry) => entry.id !== id);
    filtered.unshift({ id, title: cleanedTitle });
    videoHistory = filtered.slice(0, HISTORY_LIMIT);
    persistHistory();
    renderHistory();
    if (!cleanedTitle) {
      requestHistoryTitle(id);
    }
  }

  function requestHistoryTitle(videoId) {
    fetchVideoTitle(videoId).then((videoTitle) => {
      if (!videoTitle) return;
      const entry = videoHistory.find((item) => item.id === videoId);
      if (entry && entry.title !== videoTitle) {
        entry.title = videoTitle;
        persistHistory();
        renderHistory();
      }
    });
  }

  async function fetchVideoTitle(videoId) {
    if (!videoId) return null;
    try {
      const url = `${VIDEO_METADATA_ENDPOINT}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return typeof data.title === 'string' ? data.title : null;
    } catch (error) {
      return null;
    }
  }

  function refreshHistoryTitles() {
    videoHistory.forEach((entry) => {
      if (!entry.title) {
        requestHistoryTitle(entry.id);
      }
    });
  }

  function clearHistory() {
    if (!videoHistory.length) return;
    videoHistory = [];
    persistHistory();
    renderHistory();
  }

  function setSearchStatus(message, tone = 'info') {
    if (!youtubeSearchStatus) return;
    youtubeSearchStatus.textContent = message;
    youtubeSearchStatus.dataset.tone = tone;
  }

  function normalizeSearchResults(payload) {
    const source = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .filter((item) => item && (item.type === 'stream' || !item.type || item.type === 'video'))
      .map((item) => {
        let fallbackId = null;
        if (typeof item.url === 'string') {
          try {
            const parsed = new URL(item.url, 'https://www.youtube.com');
            fallbackId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
          } catch (error) {
            // Ignore malformed URLs
          }
        }
        return {
          id: item.id || fallbackId || '',
          title: item.title || null,
          channel: item.uploaderName || item.author || '',
          thumbnail: item.thumbnail || item.thumbnailUrl || null,
          uploaded: item.uploadedDate || item.uploaded || '',
          views: item.views,
          duration: item.duration || item.lengthSeconds,
        };
      })
      .filter((item) => item.id);
  }

  function renderYoutubeResults(results) {
    if (!youtubeResultsList) return;
    youtubeResultsList.innerHTML = '';

    if (!results.length) {
      return;
    }

    results.forEach((result) => {
      const item = document.createElement('li');
      item.className = 'multiview-youtube-result';

      const thumb = document.createElement(result.thumbnail ? 'img' : 'div');
      thumb.className = 'multiview-youtube-thumbnail';
      if (result.thumbnail) {
        thumb.src = result.thumbnail;
        thumb.alt = '';
        thumb.loading = 'lazy';
      } else {
        thumb.setAttribute('aria-hidden', 'true');
      }
      item.appendChild(thumb);

      const meta = document.createElement('div');
      meta.className = 'multiview-youtube-result-meta';

      const title = document.createElement('p');
      title.className = 'multiview-youtube-result-title';
      title.textContent = result.title || 'YouTube video';
      meta.appendChild(title);

      const facts = [];
      if (result.channel) {
        facts.push(result.channel);
      }
      if (result.uploaded) {
        facts.push(result.uploaded);
      }
      if (typeof result.views === 'number') {
        facts.push(`${result.views.toLocaleString()} views`);
      } else if (typeof result.views === 'string' && result.views) {
        facts.push(result.views);
      }

      if (facts.length) {
        const channel = document.createElement('p');
        channel.className = 'multiview-youtube-result-channel';
        channel.textContent = facts.join(' • ');
        meta.appendChild(channel);
      }

      item.appendChild(meta);

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'multiview-youtube-add';
      addButton.textContent = 'Add to grid';
      addButton.addEventListener('click', () => {
        addVideoToTheater(result.id, {
          title: result.title,
          message: 'Loaded from search! Enjoy the stream.',
        });
      });

      item.appendChild(addButton);
      youtubeResultsList.appendChild(item);
    });
  }

  async function fetchYoutubeSearchResults(query) {
    const params = new URLSearchParams({ q: query, region: 'US' });
    const queryString = params.toString();

    for (const endpoint of YOUTUBE_SEARCH_ENDPOINTS) {
      const url = `${endpoint}?${queryString}`;
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(`Unexpected response from ${endpoint}`);
        }
        return await response.json();
      } catch (error) {
        console.warn('YouTube search endpoint failed', { endpoint, error });
      }
    }

    throw new Error('All search endpoints failed');
  }

  async function handleYoutubeSearch(event) {
    event.preventDefault();
    if (!youtubeQueryInput) return;
    const query = youtubeQueryInput.value.trim();
    if (!query) {
      setSearchStatus('Enter a search above to preview results.', 'warning');
      renderYoutubeResults([]);
      return;
    }

    setSearchStatus('Searching YouTube…');
    if (youtubeSearchButton) {
      youtubeSearchButton.disabled = true;
    }
    renderYoutubeResults([]);

    try {
      const payload = await fetchYoutubeSearchResults(query);
      const results = normalizeSearchResults(payload).slice(0, SEARCH_RESULTS_LIMIT);
      if (!results.length) {
        setSearchStatus('No videos found for that search yet.', 'warning');
        return;
      }
      renderYoutubeResults(results);
      setSearchStatus(`Showing ${results.length} result${results.length > 1 ? 's' : ''}.`);
    } catch (error) {
      console.error('YouTube search failed', error);
      setSearchStatus('Search failed. Try again in a moment.', 'error');
    } finally {
      if (youtubeSearchButton) {
        youtubeSearchButton.disabled = false;
      }
    }
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
      if (preferredMode !== 'proxy') {
        applyVolumePreference(iframe);
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

    const buttonRow = document.createElement('div');
    buttonRow.className = 'multiview-frame-buttons';
    buttonRow.appendChild(link);
    buttonRow.appendChild(deleteButton);

    const volumeControl = document.createElement('label');
    volumeControl.className = 'multiview-volume-control';

    const volumeLabel = document.createElement('span');
    volumeLabel.textContent = 'Volume';
    volumeControl.appendChild(volumeLabel);

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.step = '1';
    volumeSlider.value = String(getVideoVolume(id));
    volumeSlider.dataset.volumeSlider = 'true';
    volumeSlider.addEventListener('input', () => handleVolumeInput(id, volumeSlider, iframe));
    if (preferredMode === 'proxy') {
      volumeSlider.disabled = true;
      volumeControl.classList.add('is-disabled');
    }
    volumeControl.appendChild(volumeSlider);

    actions.appendChild(buttonRow);
    actions.appendChild(volumeControl);
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
        if (preferredMode !== 'proxy') {
          scheduleVolumeSync(iframe);
        }
      }, index * 350);
    });

    updateVolumeControlsAvailability();
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

  function addVideoToTheater(videoId, options = {}) {
    if (!videoId) return false;
    if (videos.includes(videoId)) {
      if (options.duplicateMessage !== false) {
        updateStatus(options.duplicateMessage || 'That video is already in your theater.', 'warning');
      }
      return false;
    }

    videos.push(videoId);
    renderGrid();
    updateStatus(options.message || 'Video added! Enjoy the show.', 'success');
    recordHistory({ id: videoId, title: options.title || null });
    return true;
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

    const added = addVideoToTheater(videoId);
    input.value = '';
    if (added) {
      input.focus();
    }
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

  function detectBrave() {
    try {
      if (window.navigator.brave && typeof window.navigator.brave.isBrave === 'function') {
        return window.navigator.brave.isBrave();
      }
    } catch (error) {
      // Ignore detection errors
    }
    return Promise.resolve(false);
  }

  const braveDetection = detectBrave();
  let braveDetected = false;
  braveDetection.then((isBrave) => {
    braveDetected = isBrave;
    if (isBrave) {
      if (braveNote) {
        braveNote.hidden = false;
      }
      if (bravePanel) {
        bravePanel.hidden = false;
      }
      updateStatus(
        'Brave Shields detected. Switch this site to "Allow all cookies" or use the compatibility lab before signing in.',
        'warning',
      );
    }
  });

  async function runDiagnostics() {
    if (!diagnosticsButton || !diagnosticsOutput) return;
    diagnosticsButton.disabled = true;
    const originalLabel = diagnosticsButton.textContent;
    diagnosticsButton.textContent = 'Running diagnostics…';
    diagnosticsOutput.innerHTML = '';

    appendDiagnostic(`Browser agent: ${navigator.userAgent}`);

    const isBrave = await braveDetection;
    if (isBrave) {
      appendDiagnostic(
        'Brave Shields detected. Embedded sign-in prompts may be blocked by default. Try Standard mode or open-in-YouTube links for sign-in steps.',
        'warning',
      );
    }

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

  renderHistory();
  refreshHistoryTitles();
  if (youtubeSearchStatus) {
    setSearchStatus('Results appear below once you run a search.');
  }

  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', () => {
      if (!videoHistory.length) {
        return;
      }
      clearHistory();
      updateStatus('Cleared your recent history. Queue up something new!', 'info');
    });
  }

  if (youtubeSearchForm) {
    youtubeSearchForm.addEventListener('submit', handleYoutubeSearch);
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

  if (braveShieldsButton) {
    braveShieldsButton.addEventListener('click', () => {
      window.open(BRAVE_SHIELDS_HELP, '_blank', 'noopener');
      updateStatus('Opened Brave Shields instructions in a new tab.', 'info');
    });
  }

  if (braveSigninButton) {
    braveSigninButton.addEventListener('click', () => {
      window.open(YOUTUBE_SIGNIN_URL, '_blank', 'noopener');
      updateStatus('YouTube sign-in launched in a dedicated tab. Return here after authenticating.', 'info');
    });
  }

  renderGrid();
})();
