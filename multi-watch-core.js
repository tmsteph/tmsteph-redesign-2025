export const PLAYER_MODES = Object.freeze(['standard', 'privacy', 'proxy']);
export const DEFAULT_MODE = 'standard';
export const DEFAULT_VOLUME = 70;
export const MAX_VIDEOS = 8;
export const DEFAULT_VIDEO_IDS = Object.freeze(['dQw4w9WgXcQ', 'Zi_XLOBDo_Y']);

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function matchesHost(hostname, expectedHost) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

export function normalizeMode(value) {
  return PLAYER_MODES.includes(value) ? value : DEFAULT_MODE;
}

export function normalizeVolume(value, fallback = DEFAULT_VOLUME) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function extractVideoId(value) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let candidate = trimmed;
  if (!/^[a-z]+:\/\//i.test(candidate) && /^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();

    if (matchesHost(host, 'youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    if (
      matchesHost(host, 'youtube.com') ||
      matchesHost(host, 'youtube-nocookie.com') ||
      matchesHost(host, 'piped.video')
    ) {
      const queryId = url.searchParams.get('v');
      if (queryId && VIDEO_ID_PATTERN.test(queryId)) {
        return queryId;
      }

      const parts = url.pathname.split('/').filter(Boolean);
      const indexedPaths = ['embed', 'shorts', 'live', 'watch'];
      for (const pathName of indexedPaths) {
        const index = parts.indexOf(pathName);
        if (index > -1 && VIDEO_ID_PATTERN.test(parts[index + 1] || '')) {
          return parts[index + 1];
        }
      }

      const lastPart = parts[parts.length - 1];
      if (VIDEO_ID_PATTERN.test(lastPart || '')) {
        return lastPart;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

export function extractVideoIds(value) {
  if (!value) {
    return [];
  }

  const uniqueIds = [];
  const seen = new Set();
  const parts = String(value)
    .split(/[\s,\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const id = extractVideoId(part);
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    uniqueIds.push(id);
    if (uniqueIds.length >= MAX_VIDEOS) {
      break;
    }
  }

  return uniqueIds;
}

export function createVideoEntries(videoIds, overrides = []) {
  const overrideMap = new Map(
    overrides
      .filter((entry) => entry && entry.videoId)
      .map((entry) => [
        entry.videoId,
        {
          volume: normalizeVolume(entry.volume, DEFAULT_VOLUME),
          muted: Boolean(entry.muted),
          title: typeof entry.title === 'string' ? entry.title : '',
        },
      ]),
  );

  const uniqueIds = [];
  const seen = new Set();
  for (const id of videoIds) {
    const normalizedId = extractVideoId(id);
    if (!normalizedId || seen.has(normalizedId)) {
      continue;
    }
    seen.add(normalizedId);
    uniqueIds.push(normalizedId);
    if (uniqueIds.length >= MAX_VIDEOS) {
      break;
    }
  }

  return uniqueIds.map((videoId) => {
    const override = overrideMap.get(videoId);
    return {
      videoId,
      volume: normalizeVolume(override?.volume, DEFAULT_VOLUME),
      muted: Boolean(override?.muted),
      title: override?.title || '',
    };
  });
}

function parseVideoParam(value) {
  const [rawId = '', rawVolume = '', rawMuted = ''] = String(value).split(':');
  const videoId = extractVideoId(rawId);

  if (!videoId) {
    return null;
  }

  return {
    videoId,
    volume: normalizeVolume(rawVolume, DEFAULT_VOLUME),
    muted: TRUE_VALUES.has(String(rawMuted).trim().toLowerCase()),
  };
}

export function parseTheaterState(search = '', options = {}) {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const defaultVideoIds = Array.isArray(options.defaultVideoIds) && options.defaultVideoIds.length
    ? options.defaultVideoIds
    : DEFAULT_VIDEO_IDS;

  const parsedEntries = params
    .getAll('video')
    .map(parseVideoParam)
    .filter(Boolean);

  let videos = parsedEntries;
  if (!videos.length) {
    const fallbackIds = extractVideoIds(params.get('videos') || '');
    videos = createVideoEntries(fallbackIds.length ? fallbackIds : defaultVideoIds);
  } else {
    videos = createVideoEntries(
      parsedEntries.map((entry) => entry.videoId),
      parsedEntries,
    );
  }

  return {
    mode: normalizeMode(params.get('mode')),
    videos,
  };
}

export function buildTheaterSearch(state) {
  const params = new URLSearchParams();
  const mode = normalizeMode(state?.mode);
  const videos = createVideoEntries(
    Array.isArray(state?.videos) ? state.videos.map((entry) => entry?.videoId) : [],
    Array.isArray(state?.videos) ? state.videos : [],
  );

  if (mode !== DEFAULT_MODE) {
    params.set('mode', mode);
  }

  videos.forEach((entry) => {
    params.append('video', `${entry.videoId}:${entry.volume}:${entry.muted ? '1' : '0'}`);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}
