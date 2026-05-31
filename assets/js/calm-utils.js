export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function toISODate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
}

export function addDaysISO(dateValue, offset) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

export function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function createId(prefix = 'rec') {
  const random = Math.random().toString(16).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function normalizeText(value) {
  return String(value || '').trim();
}

export function sortByUpdatedDesc(records = []) {
  return [...records].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

export function groupBy(records = [], getKey) {
  return records.reduce((groups, record) => {
    const key = getKey(record);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
    return groups;
  }, {});
}
