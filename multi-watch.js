(function () {
  const grid = document.querySelector('[data-multiview-grid]');
  const input = document.getElementById('multiview-input');
  const addButton = document.querySelector('[data-add-video]');
  const clearButton = document.querySelector('[data-clear-videos]');
  const status = document.querySelector('[data-multiview-status]');
  const playerOptions = document.querySelectorAll('[data-player-option]');
  const playerHelp = document.querySelector('[data-player-help]');

  if (!grid || !input || !addButton || !clearButton || !status) {
    return;
  }

  const defaultVideos = (grid.dataset.defaultVideos || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const videos = [...new Set(defaultVideos)];

  const PRIVACY_HOST = 'https://www.youtube-nocookie.com';
  const STANDARD_HOST = 'https://www.youtube.com';
  const HOST_PREFERENCE_KEY = 'multiview-player-host';
  const FALLBACK_DELAY = 5000;
  let fallbackUsed = false;
  let preferredHost = PRIVACY_HOST;

  try {
    const storedPreference = window.localStorage?.getItem(HOST_PREFERENCE_KEY);
    if (storedPreference === 'standard') {
      preferredHost = STANDARD_HOST;
    }
  } catch (error) {
    // Ignore storage errors
  }

  function hostToPreference(host) {
    return host === STANDARD_HOST ? 'standard' : 'privacy';
  }

  function updatePlayerInputs(host) {
    if (!playerOptions.length) return;
    const currentPreference = hostToPreference(host);
    playerOptions.forEach((input) => {
      const optionPreference = input.value === 'standard' ? 'standard' : 'privacy';
      const isSelected = optionPreference === currentPreference;
      input.checked = isSelected;
      input.setAttribute('aria-checked', String(isSelected));
    });
  }

  function updatePlayerHelp(host) {
    if (!playerHelp) return;
    const preference = hostToPreference(host);
    playerHelp.dataset.mode = preference;
    playerHelp.textContent =
      preference === 'standard'
        ? 'Standard mode loads youtube.com so you can sign in, but ads or tracking may appear.'
        : 'Ad-free mode keeps things on youtube-nocookie.com, which hides sign-in prompts and account controls.';
  }

  updatePlayerInputs(preferredHost);
  updatePlayerHelp(preferredHost);

  function persistPreferredHost(host) {
    try {
      window.localStorage?.setItem(HOST_PREFERENCE_KEY, hostToPreference(host));
    } catch (error) {
      // Ignore storage errors
    }
  }

  function setPreferredHost(host) {
    if (preferredHost === host) return;
    preferredHost = host;
    persistPreferredHost(host);
    updatePlayerInputs(host);
    updatePlayerHelp(host);
    const tone = host === STANDARD_HOST ? 'warning' : 'info';
    const message =
      host === STANDARD_HOST
        ? 'Using the standard YouTube player so you can sign in or interact with the video.'
        : 'Back on the ad-free youtube-nocookie player. Sign-in prompts will stay hidden.';
    updateStatus(message, tone);
    hydrateFrames();
  }

  function buildEmbedUrl(host, id) {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    });

    if (host === STANDARD_HOST) {
      params.set('enablejsapi', '1');
      if (window.location.origin && window.location.origin.startsWith('http')) {
        params.set('origin', window.location.origin);
      }
    }

    return `${host}/embed/${id}?${params.toString()}`;
  }

  function applyEmbedSource(iframe, host) {
    iframe.dataset.currentHost = host;
    iframe.src = buildEmbedUrl(host, iframe.dataset.videoId);
  }

  function scheduleFallback(iframe, notice) {
    if (!notice) return;

    const timerId = window.setTimeout(() => {
      if (
        iframe.dataset.loaded === 'true' ||
        iframe.dataset.currentHost === STANDARD_HOST ||
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
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
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
    wrapper.appendChild(link);

    const fallbackNote = document.createElement('div');
    fallbackNote.className = 'multiview-fallback-note';
    fallbackNote.hidden = true;
    fallbackNote.dataset.fallbackShown = 'false';

    const noteText = document.createElement('p');
    noteText.textContent = 'Having trouble loading this video ad-free?';
    fallbackNote.appendChild(noteText);

    const fallbackButton = document.createElement('button');
    fallbackButton.type = 'button';
    fallbackButton.className = 'multiview-fallback-button';
    fallbackButton.textContent = 'Load standard YouTube player (enables sign-in)';
    fallbackButton.addEventListener('click', () => {
      applyEmbedSource(iframe, STANDARD_HOST);
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
    const usingPrivacyHost = preferredHost === PRIVACY_HOST;
    frames.forEach((iframe, index) => {
      iframe.removeAttribute('src');
      iframe.dataset.loaded = 'false';
      iframe.dataset.currentHost = preferredHost;

      const notice = iframe.closest('.multiview-frame-wrapper')?.querySelector('.multiview-fallback-note');
      if (notice) {
        notice.hidden = !usingPrivacyHost;
        notice.dataset.fallbackShown = usingPrivacyHost ? 'false' : 'true';
      }

      window.setTimeout(() => {
        applyEmbedSource(iframe, preferredHost);
        if (usingPrivacyHost) {
          scheduleFallback(iframe, notice);
        }
      }, index * 350);
    });
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

    videos.forEach((id) => {
      grid.appendChild(createFrame(id));
    });

    hydrateFrames();
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

      if (url.hostname.includes('youtube.com')) {
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

  addButton.addEventListener('click', addVideo);
  clearButton.addEventListener('click', clearVideos);
  playerOptions.forEach((input) => {
    input.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.checked) return;
      const nextHost = event.target.value === 'standard' ? STANDARD_HOST : PRIVACY_HOST;
      setPreferredHost(nextHost);
    });
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addVideo();
    }
  });

  renderGrid();
})();
