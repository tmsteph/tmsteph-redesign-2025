const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export const initAppSearch = ({
  documentRef = typeof document !== 'undefined' ? document : null,
  searchInput = null,
  cards = null,
  emptyState = null
} = {}) => {
  if (!documentRef) {
    return { applyFilter: () => 0 };
  }

  const input = searchInput || documentRef.querySelector('[data-app-search-input]');
  const cardElements = cards || Array.from(documentRef.querySelectorAll('[data-app-search-card]'));
  const emptyMessage = emptyState || documentRef.querySelector('[data-app-search-empty]');

  if (!input || !cardElements.length) {
    return { applyFilter: () => 0 };
  }

  const applyFilter = () => {
    const query = normalizeText(input.value);
    let visibleCount = 0;

    cardElements.forEach((card) => {
      const matches = !query || normalizeText(card.textContent).includes(query);
      card.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    if (emptyMessage) {
      emptyMessage.hidden = visibleCount > 0;
    }

    return visibleCount;
  };

  input.addEventListener('input', applyFilter);
  applyFilter();

  return { applyFilter };
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initAppSearch();
  });
}
