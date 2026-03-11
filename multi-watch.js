import {
  buildTheaterSearch,
  createVideoEntries,
  DEFAULT_MODE,
  extractVideoIds,
  normalizeMode,
  normalizeVolume,
  parseTheaterState,
} from './multi-watch-core.js';

const HOSTS = {
  standard: {
    id: 'standard',
    host: 'https://www.youtube.com',
    title: 'Standard mode',
    help: 'Full youtube.com embeds with sign-in, comments, playlists, and working volume sliders.',
    supportsMixing: true,
  },
  privacy: {
    id: 'privacy',
    host: 'https://www.youtube-nocookie.com',
    title: 'Ad-free mode',
    help: 'Privacy-enhanced embeds with the same per-video volume sliders and fewer tracking surfaces.',
    supportsMixing: true,
  },
  proxy: {
    id: 'proxy',
    host: 'https://piped.video',
    title: 'Proxy mode',
    help: 'Open-source proxy playback when YouTube is blocked. Volume mixing is disabled in this mode.',
    supportsMixing: false,
  },
};

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

function createYouTubeApiLoader(root) {
  let pendingPromise = null;

  return function loadYouTubeApi() {
    if (root.YT?.Player) {
      return Promise.resolve(root.YT);
    }

    if (pendingPromise) {
      return pendingPromise;
    }

    pendingPromise = new Promise((resolve, reject) => {
      const existingScript = root.document.querySelector('script[data-youtube-iframe-api]');
      const previousReady = root.onYouTubeIframeAPIReady;
      root.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve(root.YT);
      };

      if (existingScript) {
        return;
      }

      const script = root.document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => reject(new Error('Failed to load the YouTube iframe API.'));
      root.document.head.appendChild(script);
    });

    return pendingPromise;
  };
}

function testImage(root, url, timeout = 5000) {
  return new Promise((resolve) => {
    const image = new root.Image();
    let settled = false;
    const startedAt = root.performance.now();
    const timerId = root.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ok: false, reason: 'timeout' });
    }, timeout);

    image.onload = () => {
      if (settled) {
        return;
      }
      settled = true;
      root.clearTimeout(timerId);
      resolve({ ok: true, duration: Math.round(root.performance.now() - startedAt) });
    };

    image.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      root.clearTimeout(timerId);
      resolve({ ok: false, reason: 'blocked' });
    };

    image.referrerPolicy = 'no-referrer';
    image.src = `${url}?_=${Date.now()}`;
  });
}

function testFirstPartyCookies(doc) {
  try {
    const name = `multiview_${Date.now()}`;
    doc.cookie = `${name}=1; SameSite=Lax`;
    const enabled = doc.cookie.includes(`${name}=1`);
    doc.cookie = `${name}=; expires=${new Date(0).toUTCString()}; SameSite=Lax`;
    return enabled;
  } catch (error) {
    return false;
  }
}

export function createMultiWatchController(options = {}) {
  const root = options.root || window;
  const doc = options.doc || root.document;
  const grid = options.grid || doc.querySelector('[data-multiview-grid]');
  const input = options.input || doc.getElementById('multiview-input');
  const addButton = options.addButton || doc.querySelector('[data-add-video]');
  const clearButton = options.clearButton || doc.querySelector('[data-clear-videos]');
  const demoButton = options.demoButton || doc.querySelector('[data-reset-videos]');
  const shareButton = options.shareButton || doc.querySelector('[data-copy-share-link]');
  const searchInput = options.searchInput || doc.querySelector('[data-multiview-search]');
  const status = options.status || doc.querySelector('[data-multiview-status]');
  const playerOptions = options.playerOptions || Array.from(doc.querySelectorAll('[data-player-option]'));
  const playerHelp = options.playerHelp || doc.querySelector('[data-player-help]');
  const diagnosticsButton = options.diagnosticsButton || doc.querySelector('[data-run-diagnostics]');
  const diagnosticsOutput = options.diagnosticsOutput || doc.querySelector('[data-diagnostics-output]');
  const loadedCount = options.loadedCount || doc.querySelector('[data-video-count]');
  const modeSummary = options.modeSummary || doc.querySelector('[data-mode-summary]');
  const stateSummary = options.stateSummary || doc.querySelector('[data-state-summary]');
  const theaterRoot = options.theaterRoot || doc.querySelector('[data-theater-root]');
  const loadYouTubeApi = options.loadYouTubeApi || createYouTubeApiLoader(root);

  const requiredNodes = [grid, input, addButton, clearButton, status];
  if (requiredNodes.some((node) => !node)) {
    return {
      init() {},
      getState() {
        return { mode: DEFAULT_MODE, videos: [] };
      },
    };
  }

  const defaultVideoIds = extractVideoIds(theaterRoot?.dataset.defaultVideos || grid.dataset.defaultVideos || '');
  let state = parseTheaterState(root.location?.search || '', { defaultVideoIds });
  let searchQuery = '';
  let renderVersion = 0;
  const hasExplicitQuery = Boolean(root.location?.search);
  const playerRegistry = new Map();
  const elementRegistry = new Map();

  function getHostConfig(mode = state.mode) {
    return HOSTS[normalizeMode(mode)] || HOSTS[DEFAULT_MODE];
  }

  function syncUrl() {
    if (!root.history?.replaceState || !root.location) {
      return;
    }

    const query = buildTheaterSearch(state);
    root.history.replaceState({}, '', `${root.location.pathname}${query}`);
  }

  function updateStatus(message, tone = 'info') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function updateModeUI() {
    const config = getHostConfig();
    playerOptions.forEach((option) => {
      option.checked = option.value === config.id;
      option.setAttribute('aria-checked', String(option.checked));
    });

    if (playerHelp) {
      playerHelp.dataset.mode = config.id;
      playerHelp.textContent = config.help;
    }

    if (modeSummary) {
      modeSummary.textContent = config.title;
    }

    if (stateSummary) {
      stateSummary.textContent = config.supportsMixing
        ? 'Per-video volume sliders are ready.'
        : 'Proxy mode is on. Volume sliders are disabled here.';
    }
  }

  function getFilteredVideos() {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [...state.videos];
    }

    return state.videos.filter((entry) => {
      return entry.videoId.toLowerCase().includes(query) || entry.title.toLowerCase().includes(query);
    });
  }

  function updateSummary() {
    const visibleVideos = getFilteredVideos();
    if (loadedCount) {
      loadedCount.textContent = String(state.videos.length);
    }

    if (!state.videos.length) {
      updateStatus('Paste one or more YouTube links to build your theater.', 'info');
      return;
    }

    if (!visibleVideos.length) {
      updateStatus('No videos match your current search.', 'warning');
      return;
    }

    updateStatus(
      `Showing ${visibleVideos.length} of ${state.videos.length} videos in ${getHostConfig().title.toLowerCase()}.`,
      'success',
    );
  }

  function buildPlayerVars() {
    const params = {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    };

    if (root.location?.origin && root.location.origin.startsWith('http')) {
      params.origin = root.location.origin;
    }

    return params;
  }

  function buildProxyUrl(videoId) {
    const params = new URLSearchParams({
      autoplay: '0',
      controls: '1',
    });

    return `${HOSTS.proxy.host}/embed/${videoId}?${params.toString()}`;
  }

  function destroyPlayers() {
    playerRegistry.forEach((record) => {
      if (record?.player?.destroy) {
        record.player.destroy();
      }
    });
    playerRegistry.clear();
  }

  function updateVolumeUI(entry, elements) {
    if (!elements) {
      return;
    }

    const supportsMixing = getHostConfig().supportsMixing;
    elements.slider.value = String(entry.volume);
    elements.value.textContent = `${entry.volume}%`;
    elements.slider.disabled = !supportsMixing;
    elements.mute.disabled = !supportsMixing;
    elements.mute.textContent = entry.muted ? 'Unmute' : 'Mute';
    elements.proxyNote.hidden = supportsMixing;
  }

  function updatePlayerAudio(entry) {
    const record = playerRegistry.get(entry.videoId);
    if (!record?.player) {
      return;
    }

    record.player.setVolume(normalizeVolume(entry.volume));
    if (entry.muted) {
      record.player.mute();
    } else {
      record.player.unMute();
    }
  }

  function setVideoVolume(videoId, nextVolume) {
    const entry = state.videos.find((video) => video.videoId === videoId);
    if (!entry) {
      return;
    }

    entry.volume = normalizeVolume(nextVolume);
    updateVolumeUI(entry, elementRegistry.get(videoId));
    updatePlayerAudio(entry);
    syncUrl();
  }

  function toggleMute(videoId) {
    const entry = state.videos.find((video) => video.videoId === videoId);
    if (!entry) {
      return;
    }

    entry.muted = !entry.muted;
    updateVolumeUI(entry, elementRegistry.get(videoId));
    updatePlayerAudio(entry);
    syncUrl();
  }

  function removeVideo(videoId) {
    state.videos = state.videos.filter((entry) => entry.videoId !== videoId);
    syncUrl();
    renderGrid();
  }

  async function copyShareLink() {
    const targetUrl = `${root.location.origin}${root.location.pathname}${buildTheaterSearch(state)}`;

    try {
      await root.navigator?.clipboard?.writeText(targetUrl);
      updateStatus('Share link copied. It preserves mode, loaded videos, and volume settings.', 'success');
    } catch (error) {
      root.prompt?.('Copy this theater link:', targetUrl);
      updateStatus('Copy the share link from the prompt to reuse this exact layout.', 'warning');
    }
  }

  function appendDiagnostic(message, tone = 'info') {
    if (!diagnosticsOutput) {
      return;
    }

    const item = doc.createElement('li');
    item.textContent = message;
    item.dataset.tone = tone;
    diagnosticsOutput.appendChild(item);
  }

  async function runDiagnostics() {
    if (!diagnosticsButton || !diagnosticsOutput) {
      return;
    }

    diagnosticsButton.disabled = true;
    const originalLabel = diagnosticsButton.textContent;
    diagnosticsButton.textContent = 'Running diagnostics...';
    diagnosticsOutput.innerHTML = '';

    appendDiagnostic(`Browser agent: ${root.navigator?.userAgent || 'unknown'}`);

    const cookiesEnabled = testFirstPartyCookies(doc);
    appendDiagnostic(
      cookiesEnabled
        ? 'First-party cookies are enabled in this tab.'
        : 'First-party cookies appear blocked. Embedded sign-in flows may fail until they are allowed.',
      cookiesEnabled ? 'success' : 'warning',
    );

    for (const target of DIAGNOSTIC_TARGETS) {
      const result = await testImage(root, target.url);
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

  function createProxyFrame(videoId) {
    const frame = doc.createElement('iframe');
    frame.className = 'multiview-frame';
    frame.src = buildProxyUrl(videoId);
    frame.title = `Proxy player for ${videoId}`;
    frame.allowFullscreen = true;
    frame.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; allow-storage-access-by-user-activation';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }

  function mountYouTubePlayer(entry, elements, version) {
    return loadYouTubeApi()
      .then((YT) => {
        if (version !== renderVersion || !elements?.mount?.isConnected) {
          return;
        }

        const config = getHostConfig();
        const player = new YT.Player(elements.mount, {
          host: config.host,
          videoId: entry.videoId,
          playerVars: buildPlayerVars(),
          events: {
            onReady(event) {
              const frame = event.target.getIframe?.();
              if (frame) {
                frame.classList.add('multiview-frame');
                frame.setAttribute(
                  'allow',
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; allow-storage-access-by-user-activation',
                );
                frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              }

              const videoData = event.target.getVideoData?.();
              if (videoData?.title) {
                entry.title = videoData.title;
                elements.title.textContent = videoData.title;
              }

              updatePlayerAudio(entry);
            },
            onError() {
              elements.error.hidden = false;
              elements.error.textContent = 'That video refused the embedded player. Try opening it directly.';
            },
          },
        });

        playerRegistry.set(entry.videoId, { player });
      })
      .catch(() => {
        if (version !== renderVersion) {
          return;
        }

        elements.error.hidden = false;
        elements.error.textContent = 'The YouTube player API failed to load. Refresh and try again.';
      });
  }

  function createFrame(entry, index) {
    const wrapper = doc.createElement('article');
    wrapper.className = 'multiview-frame-wrapper';

    const media = doc.createElement('div');
    media.className = 'multiview-media-shell';

    const mount = doc.createElement('div');
    mount.className = 'multiview-player-mount';
    media.appendChild(mount);
    wrapper.appendChild(media);

    const meta = doc.createElement('div');
    meta.className = 'multiview-meta';

    const eyebrow = doc.createElement('p');
    eyebrow.className = 'multiview-frame-tag';
    eyebrow.textContent = `Feed ${index + 1}`;

    const title = doc.createElement('h3');
    title.className = 'multiview-frame-title';
    title.textContent = entry.title || `YouTube video ${entry.videoId}`;

    const id = doc.createElement('p');
    id.className = 'multiview-frame-id';
    id.textContent = entry.videoId;

    const controls = doc.createElement('div');
    controls.className = 'multiview-frame-controls';

    const volumeGroup = doc.createElement('label');
    volumeGroup.className = 'multiview-volume';

    const volumeLabel = doc.createElement('span');
    volumeLabel.textContent = 'Volume';

    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(entry.volume);
    slider.addEventListener('input', (event) => {
      setVideoVolume(entry.videoId, event.currentTarget.value);
    });

    const value = doc.createElement('strong');
    value.textContent = `${entry.volume}%`;

    volumeGroup.append(volumeLabel, slider, value);

    const mute = doc.createElement('button');
    mute.type = 'button';
    mute.className = 'multiview-action-button';
    mute.addEventListener('click', () => toggleMute(entry.videoId));

    const open = doc.createElement('a');
    open.className = 'multiview-open-link';
    open.href = `https://youtu.be/${entry.videoId}`;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Open on YouTube';

    const remove = doc.createElement('button');
    remove.type = 'button';
    remove.className = 'multiview-remove-button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeVideo(entry.videoId));

    controls.append(volumeGroup, mute, open, remove);

    const proxyNote = doc.createElement('p');
    proxyNote.className = 'multiview-frame-note';
    proxyNote.textContent = 'Proxy mode disables the volume sliders because the proxy player does not expose the YouTube API.';

    const error = doc.createElement('p');
    error.className = 'multiview-frame-error';
    error.hidden = true;

    meta.append(eyebrow, title, id, controls, proxyNote, error);
    wrapper.appendChild(meta);

    elementRegistry.set(entry.videoId, {
      mount,
      title,
      slider,
      value,
      mute,
      proxyNote,
      error,
    });
    updateVolumeUI(entry, elementRegistry.get(entry.videoId));

    if (getHostConfig().supportsMixing) {
      mountYouTubePlayer(entry, elementRegistry.get(entry.videoId), renderVersion);
    } else {
      mount.replaceWith(createProxyFrame(entry.videoId));
    }

    return wrapper;
  }

  function renderGrid() {
    renderVersion += 1;
    destroyPlayers();
    elementRegistry.clear();
    grid.innerHTML = '';

    if (!state.videos.length) {
      const empty = doc.createElement('p');
      empty.className = 'multiview-empty';
      empty.textContent = 'Load a few YouTube links and the theater will build itself here.';
      grid.appendChild(empty);
      updateSummary();
      return;
    }

    const filteredVideos = getFilteredVideos();
    if (!filteredVideos.length) {
      const empty = doc.createElement('p');
      empty.className = 'multiview-empty';
      empty.textContent = 'No videos match that search yet.';
      grid.appendChild(empty);
      updateSummary();
      return;
    }

    filteredVideos.forEach((entry, index) => {
      grid.appendChild(createFrame(entry, index));
    });

    updateSummary();
  }

  function addVideos() {
    const nextIds = extractVideoIds(input.value);
    if (!nextIds.length) {
      updateStatus('Please provide a valid YouTube link or video ID.', 'error');
      return;
    }

    const existingIds = new Set(state.videos.map((entry) => entry.videoId));
    const additions = nextIds.filter((videoId) => !existingIds.has(videoId));

    if (!additions.length) {
      updateStatus('Those videos are already in your theater.', 'warning');
      input.select();
      return;
    }

    state.videos = createVideoEntries(
      [...state.videos.map((entry) => entry.videoId), ...additions],
      state.videos,
    );
    input.value = '';
    syncUrl();
    renderGrid();
    input.focus();
  }

  function clearVideos() {
    state.videos = [];
    syncUrl();
    renderGrid();
    input.focus();
  }

  function resetDemoVideos() {
    state.videos = createVideoEntries(defaultVideoIds.length ? defaultVideoIds : []);
    syncUrl();
    renderGrid();
  }

  function setMode(nextMode) {
    const normalizedMode = normalizeMode(nextMode);
    if (normalizedMode === state.mode) {
      return;
    }

    state.mode = normalizedMode;
    updateModeUI();
    syncUrl();
    renderGrid();
  }

  function init() {
    updateModeUI();
    if (hasExplicitQuery) {
      syncUrl();
    }
    renderGrid();

    addButton.addEventListener('click', addVideos);
    clearButton.addEventListener('click', clearVideos);
    demoButton?.addEventListener('click', resetDemoVideos);
    shareButton?.addEventListener('click', copyShareLink);
    diagnosticsButton?.addEventListener('click', runDiagnostics);

    input.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        addVideos();
      }
    });

    searchInput?.addEventListener('input', (event) => {
      searchQuery = event.currentTarget.value || '';
      renderGrid();
    });

    playerOptions.forEach((option) => {
      option.addEventListener('change', (event) => {
        if (!(event.currentTarget instanceof root.HTMLInputElement) || !event.currentTarget.checked) {
          return;
        }
        setMode(event.currentTarget.value);
      });
    });
  }

  return {
    init,
    getState() {
      return {
        mode: state.mode,
        videos: state.videos.map((entry) => ({ ...entry })),
      };
    },
    addVideos,
    clearVideos,
    resetDemoVideos,
    setMode,
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const controller = createMultiWatchController({ root: window, doc: document });
  controller.init();
}
