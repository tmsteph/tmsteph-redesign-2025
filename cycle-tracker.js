const dayMs = 24 * 60 * 60 * 1000;

const formatDate = (date) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const addDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

function getMoonInfo(date) {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const eventTime = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  let dayOffset = Math.floor((eventTime - startOfYear) / dayMs);
  dayOffset = ((dayOffset % 364) + 364) % 364; // wrap into the 13-month cycle for that year

  const moonMonth = Math.floor(dayOffset / 28) + 1;
  const moonDay = (dayOffset % 28) + 1;
  const moonWeek = Math.ceil(moonDay / 7);

  return { moonMonth, moonDay, moonWeek };
}

function buildCycleRows({ startDate, cycleLength, periodLength }) {
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const periodStart = addDays(startDate, i * cycleLength);
    const periodEnd = addDays(periodStart, Math.max(periodLength - 1, 0));

    const ovulationDay = addDays(periodStart, cycleLength - 14);
    const fertileStart = addDays(ovulationDay, -5);
    const fertileEnd = ovulationDay;

    const moonInfo = getMoonInfo(periodStart);

    rows.push({
      index: i + 1,
      periodStart,
      periodEnd,
      fertileStart,
      fertileEnd,
      ovulationDay,
      moonInfo,
    });
  }
  return rows;
}

function renderCycleRows(rows, container) {
  container.innerHTML = '';

  if (!rows.length) {
    container.innerHTML = '<p class="muted">Add a start date to see predictions.</p>';
    return;
  }

  rows.forEach((row) => {
    const card = document.createElement('article');
    card.className = 'cycle-card';

    card.innerHTML = `
      <div class="cycle-card__header">
        <div>
          <p class="muted">Cycle ${row.index}</p>
          <h4>${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}</h4>
        </div>
        <span class="moon-chip">Moon ${row.moonInfo.moonMonth} · Week ${row.moonInfo.moonWeek}</span>
      </div>
      <ul class="cycle-card__details">
        <li><strong>Fertile window:</strong> ${formatDate(row.fertileStart)} → ${formatDate(row.fertileEnd)}</li>
        <li><strong>Ovulation estimate:</strong> ${formatDate(row.ovulationDay)}</li>
        <li><strong>Moon day:</strong> Day ${row.moonInfo.moonDay} of 28</li>
      </ul>
    `;

    container.appendChild(card);
  });
}

function buildMoonCalendar(year, highlightedDates) {
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const calendar = [];

  for (let i = 0; i < 13; i++) {
    const monthStart = addDays(startOfYear, i * 28);
    const monthEnd = addDays(monthStart, 27);
    const monthNumber = i + 1;

    const matchingDates = highlightedDates.filter((date) => getMoonInfo(date).moonMonth === monthNumber);

    calendar.push({
      monthNumber,
      monthStart,
      monthEnd,
      highlights: matchingDates,
    });
  }

  return calendar;
}

function renderMoonCalendar(calendar, container) {
  container.innerHTML = '';

  calendar.forEach((moon) => {
    const item = document.createElement('article');
    item.className = 'moon-card';

    const highlights = moon.highlights
      .map((date) => `<span class="moon-dot" title="Cycle starts ${formatDate(date)}"></span>`)
      .join('');

    item.innerHTML = `
      <div class="moon-card__header">
        <div>
          <p class="muted">Moon Month</p>
          <h4>${moon.monthNumber}</h4>
        </div>
        <div class="moon-dots" aria-label="Cycle markers">${highlights || '<span class="muted">—</span>'}</div>
      </div>
      <p class="muted">${formatDate(moon.monthStart)} → ${formatDate(moon.monthEnd)}</p>
    `;

    container.appendChild(item);
  });
}

function hydrateInputs(lastPeriodInput, cycleLengthInput, periodLengthInput, moonYearInput) {
  const saved = localStorage.getItem('cycle-tracker');
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    if (data.lastPeriod) lastPeriodInput.value = data.lastPeriod;
    if (data.cycleLength) cycleLengthInput.value = data.cycleLength;
    if (data.periodLength) periodLengthInput.value = data.periodLength;
    if (data.moonYear) moonYearInput.value = data.moonYear;
  } catch (e) {
    console.warn('Unable to read saved cycle data', e);
  }
}

function persistInputs({ lastPeriod, cycleLength, periodLength, moonYear }) {
  localStorage.setItem(
    'cycle-tracker',
    JSON.stringify({ lastPeriod, cycleLength, periodLength, moonYear })
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const lastPeriodInput = document.getElementById('last-period');
  const cycleLengthInput = document.getElementById('cycle-length');
  const periodLengthInput = document.getElementById('period-length');
  const moonYearInput = document.getElementById('moon-year');
  const resultsContainer = document.getElementById('cycle-results');
  const moonCalendarContainer = document.getElementById('moon-calendar');

  hydrateInputs(lastPeriodInput, cycleLengthInput, periodLengthInput, moonYearInput);

  const update = () => {
    const lastPeriodValue = lastPeriodInput.value;
    const cycleLength = clampNumber(parseInt(cycleLengthInput.value, 10) || 28, 20, 40);
    const periodLength = clampNumber(parseInt(periodLengthInput.value, 10) || 5, 2, 10);
    const moonYear = parseInt(moonYearInput.value, 10) || new Date().getFullYear();

    cycleLengthInput.value = cycleLength;
    periodLengthInput.value = periodLength;
    moonYearInput.value = moonYear;

    persistInputs({ lastPeriod: lastPeriodValue, cycleLength, periodLength, moonYear });

    if (!lastPeriodValue) {
      resultsContainer.innerHTML = '<p class="muted">Add a start date to see predictions.</p>';
      renderMoonCalendar(buildMoonCalendar(moonYear, []), moonCalendarContainer);
      return;
    }

    const startDate = new Date(lastPeriodValue + 'T00:00:00Z');
    if (Number.isNaN(startDate)) {
      resultsContainer.innerHTML = '<p class="muted">Enter a valid date to see predictions.</p>';
      return;
    }

    const rows = buildCycleRows({ startDate, cycleLength, periodLength });
    renderCycleRows(rows, resultsContainer);

    const highlightedDates = rows.map((row) => row.periodStart);
    const calendar = buildMoonCalendar(moonYear, highlightedDates);
    renderMoonCalendar(calendar, moonCalendarContainer);
  };

  lastPeriodInput.addEventListener('change', update);
  cycleLengthInput.addEventListener('input', update);
  periodLengthInput.addEventListener('input', update);
  moonYearInput.addEventListener('input', update);

  update();
});
