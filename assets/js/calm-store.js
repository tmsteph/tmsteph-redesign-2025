import { createInitialState, migrateState } from './calm-models.js';
import { createId } from './calm-utils.js';

const STORAGE_KEY = 'tmstephCalmStructure.v1';
const GROUNDING_NOTES_KEY = 'tmstephCalmStructure.groundingNotes.v1';

export function loadState(storage = globalThis.localStorage, now = new Date()) {
  if (!storage) {
    return createInitialState(now);
  }

  try {
    const stored = storage.getItem(STORAGE_KEY);
    return migrateState(stored ? JSON.parse(stored) : null, now);
  } catch (_error) {
    return createInitialState(now);
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(storage = globalThis.localStorage) {
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

export function loadGroundingNotes(storage = globalThis.localStorage) {
  if (!storage) return '';
  try {
    return storage.getItem(GROUNDING_NOTES_KEY) || '';
  } catch (_error) {
    return '';
  }
}

export function saveGroundingNotes(notes, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(GROUNDING_NOTES_KEY, String(notes || ''));
}

export function clearGroundingNotes(storage = globalThis.localStorage) {
  if (!storage) return;
  storage.removeItem(GROUNDING_NOTES_KEY);
}

export function createRecord(type, payload = {}) {
  const now = Date.now();
  return {
    id: payload.id || createId(type),
    type,
    ...payload,
    createdAt: payload.createdAt || now,
    updatedAt: now
  };
}

export function upsertById(records = [], record) {
  const exists = records.some((item) => item.id === record.id);
  if (!exists) {
    return [...records, record];
  }
  return records.map((item) => (item.id === record.id ? { ...item, ...record, updatedAt: Date.now() } : item));
}
