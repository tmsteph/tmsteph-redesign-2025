(function () {
  const grid = document.querySelector('[data-multiview-grid]');
  const input = document.getElementById('multiview-input');
  const addButton = document.querySelector('[data-add-video]');
  const clearButton = document.querySelector('[data-clear-videos]');
  const status = document.querySelector('[data-multiview-status]');

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
  const FALLBACK_DELAY = 4000;
  let fallbackUsed = false;

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

  function scheduleFallback(iframe) {
    const timerId = window.setTimeout(() => {
      if (iframe.dataset.loaded === 'true' || iframe.dataset.currentHost === STANDARD_HOST) {
        return;
      }
      applyEmbedSource(iframe, STANDARD_HOST);
      iframe.dataset.fallbackApplied = 'true';
      if (!fallbackUsed) {
        fallbackUsed = true;
        updateStatus(
          'One of the embeds needed the standard YouTube player. Ads or sign-in prompts may appear.',
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
    iframe.loading = 'lazy';
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
      if (iframe.dataset.currentHost === STANDARD_HOST) {
        return;
      }
      applyEmbedSource(iframe, STANDARD_HOST);
    });

    wrapper.appendChild(iframe);

    const link = document.createElement('a');
    link.href = `https://youtu.be/${id}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'multiview-open-link';
    link.textContent = 'Open on YouTube';
    wrapper.appendChild(link);

    return wrapper;
  }

  function hydrateFrames() {
    const frames = grid.querySelectorAll('iframe[data-video-id]');
    fallbackUsed = false;
    frames.forEach((iframe, index) => {
      iframe.removeAttribute('src');
      iframe.dataset.loaded = 'false';
      iframe.dataset.currentHost = PRIVACY_HOST;

      window.setTimeout(() => {
        applyEmbedSource(iframe, PRIVACY_HOST);
        scheduleFallback(iframe);
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
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addVideo();
    }
  });

  renderGrid();
})();
