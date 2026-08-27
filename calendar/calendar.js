const SNAPSHOT_UPDATED = 'demo data only';

const events = [
  { start: '2026-09-01T08:00:00-07:00', end: '2026-09-01T17:00:00-07:00', title: 'Work — A1', type: 'work' },
  { start: '2026-09-02T14:00:00-07:00', end: '2026-09-02T15:00:00-07:00', title: 'Appointment', type: 'personal' },
  { start: '2026-09-03T18:00:00-07:00', end: '2026-09-03T20:00:00-07:00', title: 'Family plans', type: 'personal' },
  { start: '2026-09-04T10:00:00-07:00', end: '2026-09-04T15:00:00-07:00', title: 'Work — Set/Strike', type: 'work' },
  { start: '2026-09-08T08:00:00-07:00', end: '2026-09-08T16:30:00-07:00', title: 'Work — Show call', type: 'work' },
  { start: '2026-09-10T17:00:00-07:00', end: '2026-09-11T02:00:00-07:00', title: 'Work — Overnight call', type: 'work' },
  { start: '2026-09-12T08:00:00-07:00', end: '2026-09-12T17:00:00-07:00', title: 'Work — Event', type: 'work' },
  { start: '2026-09-14T06:00:00-07:00', end: '2026-09-14T12:00:00-07:00', title: 'Work — Audio', type: 'work' },
  { start: '2026-09-19T09:00:00-07:00', end: '2026-09-19T12:00:00-07:00', title: 'Family morning', type: 'personal' },
  { start: '2026-09-23T09:00:00-07:00', end: '2026-09-23T17:30:00-07:00', title: 'Work — Graphics', type: 'work' }
];

const grid = document.querySelector('[data-calendar-grid]');
const monthLabel = document.querySelector('[data-month-label]');
const todayButton = document.querySelector('[data-month-today]');
const navButtons = document.querySelectorAll('[data-month-nav]');
const snapshotDate = document.querySelector('[data-snapshot-date]');
const emptyMonth = document.querySelector('[data-empty-month]');
const demoMonthButton = document.querySelector('[data-demo-month]');
const now = new Date();
const sampleMonth = new Date(events[0].start);
let viewDate = new Date(sampleMonth.getFullYear(), sampleMonth.getMonth(), 1);

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventDateKey(event) { return event.date || event.start.slice(0, 10); }

function compactTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
    .format(date)
    .replace(':00', '')
    .replace(/\s/g, '')
    .toLowerCase();
}

function formatRange(event) {
  if (event.allDay) return 'All day';
  const start = compactTime(event.start);
  const end = compactTime(event.end);
  const overnight = event.start.slice(0, 10) !== event.end.slice(0, 10);
  return `${start}–${end}${overnight ? ' +1' : ''}`;
}

function shortTime(value) {
  return compactTime(value).replace('am', 'a').replace('pm', 'p');
}

function formatCompactRange(event) {
  if (event.allDay) return 'All day';
  const overnight = event.start.slice(0, 10) !== event.end.slice(0, 10);
  return `${shortTime(event.start)}–${shortTime(event.end)}${overnight ? '+1' : ''}`;
}

function render() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  monthLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate);
  grid.innerHTML = '';
  const monthStart = new Date(year, month, 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const todayKey = dateKey(now);
  let visibleEventCount = 0;

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const key = dateKey(cellDate);
    const day = document.createElement('article');
    day.className = 'day';
    if (cellDate.getMonth() !== month) day.classList.add('day--muted');
    if (key === todayKey) day.classList.add('day--today');
    const number = document.createElement('p');
    number.className = 'day__number';
    number.textContent = cellDate.getDate();
    day.appendChild(number);
    const dayEvents = events.filter(event => eventDateKey(event) === key);
    if (cellDate.getMonth() === month) visibleEventCount += dayEvents.length;
    dayEvents.slice(0, 3).forEach(event => {
      const block = document.createElement('div');
      block.className = `event event--${event.type}`;
      block.setAttribute('aria-label', `${formatRange(event)}, ${event.title}`);
      const time = document.createElement('div');
      time.className = 'event__time';
      const fullTime = document.createElement('span');
      fullTime.className = 'event__time-full';
      fullTime.textContent = formatRange(event);
      const compactTimeLabel = document.createElement('span');
      compactTimeLabel.className = 'event__time-compact';
      compactTimeLabel.textContent = formatCompactRange(event);
      time.append(fullTime, compactTimeLabel);
      const title = document.createElement('div');
      title.className = 'event__title';
      title.textContent = event.title;
      block.append(time, title);
      day.appendChild(block);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement('p');
      more.className = 'more';
      more.textContent = `+${dayEvents.length - 3} more`;
      day.appendChild(more);
    }
    const dayLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(cellDate);
    const eventLabels = dayEvents.slice(0, 3).map(event => `${formatRange(event)} ${event.title}`);
    day.setAttribute('aria-label', [dayLabel, ...eventLabels].join(', '));
    grid.appendChild(day);
  }

  if (emptyMonth) emptyMonth.hidden = visibleEventCount > 0;
}

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const delta = button.dataset.monthNav === 'next' ? 1 : -1;
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
    render();
  });
});

todayButton.addEventListener('click', () => {
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
  render();
});

demoMonthButton?.addEventListener('click', () => {
  viewDate = new Date(sampleMonth.getFullYear(), sampleMonth.getMonth(), 1);
  render();
});

snapshotDate.textContent = `Public demo: ${SNAPSHOT_UPDATED}. Your real calendar is not published here.`;
render();
