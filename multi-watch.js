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

  function createFrame(id) {
    const iframe = document.createElement('iframe');
    iframe.className = 'multiview-frame';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}`;
    iframe.title = `YouTube video ${id}`;
    return iframe;
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
