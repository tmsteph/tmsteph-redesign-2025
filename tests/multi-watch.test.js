import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTheaterSearch,
  createVideoEntries,
  DEFAULT_VIDEO_IDS,
  extractVideoId,
  extractVideoIds,
  normalizeSearchResults,
  parseTheaterState,
} from '../multi-watch-core.js';
import { createMultiWatchController } from '../multi-watch.js';

describe('multi-watch core helpers', () => {
  it('extracts YouTube IDs from common URL formats', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/watch?v=Zi_XLOBDo_Y')).toBe('Zi_XLOBDo_Y');
    expect(extractVideoId('https://www.youtube.com/embed/Zi_XLOBDo_Y')).toBe('Zi_XLOBDo_Y');
    expect(extractVideoId('https://www.youtube.com/shorts/Zi_XLOBDo_Y')).toBe('Zi_XLOBDo_Y');
    expect(extractVideoId('not-a-video!')).toBeNull();
  });

  it('deduplicates parsed IDs and respects the max watch list', () => {
    const values = [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=Zi_XLOBDo_Y',
    ].join('\n');

    expect(extractVideoIds(values)).toEqual(['dQw4w9WgXcQ', 'Zi_XLOBDo_Y']);
  });

  it('parses shareable theater state and falls back to defaults', () => {
    expect(parseTheaterState('')).toEqual({
      mode: 'standard',
      videos: createVideoEntries(DEFAULT_VIDEO_IDS),
    });

    expect(parseTheaterState('?mode=privacy&video=dQw4w9WgXcQ:35:1')).toEqual({
      mode: 'privacy',
      videos: [
        {
          videoId: 'dQw4w9WgXcQ',
          volume: 35,
          muted: true,
          title: '',
        },
      ],
    });
  });

  it('serializes theater state back into a shareable query string', () => {
    expect(buildTheaterSearch({
      mode: 'privacy',
      videos: [
        { videoId: 'dQw4w9WgXcQ', volume: 45, muted: true },
        { videoId: 'Zi_XLOBDo_Y', volume: 80, muted: false },
      ],
    })).toBe('?mode=privacy&video=dQw4w9WgXcQ%3A45%3A1&video=Zi_XLOBDo_Y%3A80%3A0');
  });

  it('normalizes piped search results into addable video cards', () => {
    expect(normalizeSearchResults({
      items: [
        {
          url: '/watch?v=ScMzIvxBSi4',
          title: 'Lo-fi set',
          uploaderName: 'DJ Test',
          thumbnail: 'https://example.com/thumb.jpg',
          duration: 605,
        },
      ],
    })).toEqual([
      {
        videoId: 'ScMzIvxBSi4',
        title: 'Lo-fi set',
        uploaderName: 'DJ Test',
        thumbnail: 'https://example.com/thumb.jpg',
        durationLabel: '10:05',
      },
    ]);
  });
});

describe('multi-watch controller', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = `
      <div data-theater-root data-default-videos="dQw4w9WgXcQ,Zi_XLOBDo_Y">
        <textarea id="multiview-input"></textarea>
        <button data-add-video type="button">Add</button>
        <button data-clear-videos type="button">Clear</button>
        <button data-reset-videos type="button">Reset</button>
        <button data-copy-share-link type="button">Share</button>
        <input data-multiview-search type="search" />
        <input data-video-search-query type="search" />
        <button data-video-search-button type="button">Search</button>
        <p data-video-search-status></p>
        <div data-video-search-results></div>
        <p data-multiview-status></p>
        <p data-player-help></p>
        <p data-state-summary></p>
        <strong data-video-count></strong>
        <strong data-mode-summary></strong>
        <details data-advanced-player-settings></details>
        <button data-run-diagnostics type="button">Diagnostics</button>
        <ul data-diagnostics-output></ul>
        <label><input data-player-option type="radio" name="mode" value="standard" checked /></label>
        <label><input data-player-option type="radio" name="mode" value="privacy" /></label>
        <label><input data-player-option type="radio" name="mode" value="proxy" /></label>
        <div data-multiview-grid></div>
      </div>
    `;

    window.history.replaceState({}, '', '/watch/index.html');
  });

  function createYouTubeStub() {
    return {
      Player: class {
        constructor(element, options) {
          this.element = element;
          this.options = options;
          this.volume = 70;
          this.muted = false;
          this.iframe = document.createElement('iframe');
          this.iframe.className = 'stub-frame';
          element.appendChild(this.iframe);
          options.events?.onReady?.({
            target: this,
          });
        }

        getIframe() {
          return this.iframe;
        }

        getVideoData() {
          return { title: 'Stub video title' };
        }

        setVolume(value) {
          this.volume = value;
        }

        mute() {
          this.muted = true;
        }

        unMute() {
          this.muted = false;
        }

        destroy() {
          this.iframe.remove();
        }
      }
    };
  }

  it('adds multiple videos, updates the share URL, and renders cards', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });

    const controller = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
    });

    controller.init();

    const input = document.getElementById('multiview-input');
    input.value = 'https://youtu.be/ScMzIvxBSi4\nhttps://www.youtube.com/watch?v=Zi_XLOBDo_Y';
    controller.addVideos();
    await Promise.resolve();

    const state = controller.getState();
    expect(state.videos.map((entry) => entry.videoId)).toEqual([
      'dQw4w9WgXcQ',
      'Zi_XLOBDo_Y',
      'ScMzIvxBSi4',
    ]);
    expect(window.location.search).toContain('video=');
    expect(document.querySelectorAll('.multiview-frame-wrapper')).toHaveLength(3);
    expect(document.querySelector('[data-video-count]').textContent).toBe('3');
  });

  it('switches into proxy mode and disables per-video mixing controls', async () => {
    const controller = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
    });

    controller.init();
    controller.setMode('proxy');
    await Promise.resolve();

    const slider = document.querySelector('.multiview-volume input[type="range"]');
    const summary = document.querySelector('[data-state-summary]');

    expect(slider.disabled).toBe(true);
    expect(summary.textContent).toContain('Proxy mode is on');
  });

  it('searches for a video to add and marks advanced settings open for proxy mode', async () => {
    const controller = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
      searchFetch: vi.fn().mockResolvedValue({
        ok: true,
        async json() {
          return {
            items: [
              {
                url: '/watch?v=ScMzIvxBSi4',
                title: 'Search hit',
                uploaderName: 'Tester',
                thumbnail: 'https://example.com/thumb.jpg',
                duration: 90,
              },
            ],
          };
        },
      }),
    });

    controller.init();
    document.querySelector('[data-video-search-query]').value = 'lofi';
    await controller.runVideoSearch();

    expect(document.querySelectorAll('.video-search-card')).toHaveLength(1);

    document.querySelector('[data-search-result-id="ScMzIvxBSi4"]').click();
    await Promise.resolve();

    expect(controller.getState().videos.map((entry) => entry.videoId)).toContain('ScMzIvxBSi4');

    controller.setMode('proxy');
    expect(document.querySelector('[data-advanced-player-settings]').open).toBe(true);
  });

  it('restores a saved watcher room when the page loads without a share query', async () => {
    window.localStorage.setItem('tmsteph-video-watcher-state', JSON.stringify({
      mode: 'privacy',
      videos: [
        {
          videoId: 'ScMzIvxBSi4',
          volume: 35,
          muted: true,
          title: 'Saved video',
        },
      ],
    }));

    const controller = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
    });

    controller.init();
    await Promise.resolve();

    expect(controller.getState()).toMatchObject({
      mode: 'privacy',
      videos: [
        {
          videoId: 'ScMzIvxBSi4',
          volume: 35,
          muted: true,
        },
      ],
    });
    expect(document.querySelector('[data-video-count]').textContent).toBe('1');
  });

  it('persists an empty room so defaults do not come back on the next load', async () => {
    const controller = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
    });

    controller.init();
    controller.clearVideos();

    expect(window.localStorage.getItem('tmsteph-video-watcher-state')).toContain('"videos":[]');

    document.body.innerHTML = `
      <div data-theater-root data-default-videos="dQw4w9WgXcQ,Zi_XLOBDo_Y">
        <textarea id="multiview-input"></textarea>
        <button data-add-video type="button">Add</button>
        <button data-clear-videos type="button">Clear</button>
        <button data-reset-videos type="button">Reset</button>
        <button data-copy-share-link type="button">Share</button>
        <input data-multiview-search type="search" />
        <input data-video-search-query type="search" />
        <button data-video-search-button type="button">Search</button>
        <p data-video-search-status></p>
        <div data-video-search-results></div>
        <p data-multiview-status></p>
        <p data-player-help></p>
        <p data-state-summary></p>
        <strong data-video-count></strong>
        <strong data-mode-summary></strong>
        <details data-advanced-player-settings></details>
        <button data-run-diagnostics type="button">Diagnostics</button>
        <ul data-diagnostics-output></ul>
        <label><input data-player-option type="radio" name="mode" value="standard" checked /></label>
        <label><input data-player-option type="radio" name="mode" value="privacy" /></label>
        <label><input data-player-option type="radio" name="mode" value="proxy" /></label>
        <div data-multiview-grid></div>
      </div>
    `;
    window.history.replaceState({}, '', '/watch/index.html');

    const reloadedController = createMultiWatchController({
      root: window,
      doc: document,
      loadYouTubeApi: () => Promise.resolve(createYouTubeStub()),
    });

    reloadedController.init();

    expect(reloadedController.getState()).toEqual({
      mode: 'standard',
      videos: [],
    });
    expect(document.querySelector('[data-video-count]').textContent).toBe('0');
  });
});
