const exploreSearchInput = document.getElementById('explore-search-input');
const exploreSearchStatus = document.getElementById('explore-search-status');
const exploreSearchEmpty = document.getElementById('explore-search-empty');
const exploreGrid = document.getElementById('explore-project-grid');
const appSearchJump = document.querySelector('[data-app-search-jump]');

if (exploreSearchInput && exploreSearchStatus && exploreSearchEmpty && exploreGrid) {
  const projectCards = Array.from(exploreGrid.querySelectorAll('.project-card'));

  const updateSearchResults = () => {
    const query = exploreSearchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    projectCards.forEach((card) => {
      const cardLabel = card.textContent?.trim().toLowerCase() ?? '';
      const cardHref = card.getAttribute('href')?.trim().toLowerCase() ?? '';
      const isMatch = query === '' || cardLabel.includes(query) || cardHref.includes(query);
      card.hidden = !isMatch;
      if (isMatch) {
        visibleCount += 1;
      }
    });

    const totalCount = projectCards.length;
    const hasQuery = query.length > 0;
    const statusText = hasQuery
      ? `Showing ${visibleCount} of ${totalCount} apps for "${exploreSearchInput.value.trim()}".`
      : `Showing all ${totalCount} apps.`;

    exploreSearchStatus.textContent = statusText;
    exploreSearchEmpty.hidden = visibleCount !== 0;
  };

  exploreSearchInput.addEventListener('input', updateSearchResults);
  updateSearchResults();

  if (appSearchJump) {
    appSearchJump.addEventListener('click', (event) => {
      event.preventDefault();

      const searchContainer = exploreSearchInput.closest('.explore-search');
      document.getElementById('explore-more')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      window.setTimeout(() => {
        exploreSearchInput.focus({ preventScroll: true });
        searchContainer?.classList.add('is-highlighted');
      }, 260);

      window.setTimeout(() => {
        searchContainer?.classList.remove('is-highlighted');
      }, 1800);
    });
  }
}
