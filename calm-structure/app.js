import {
  MEAL_SLOTS,
  MOOD_STATES,
  REQUEST_TYPES,
  RESET_ITEMS,
  TASK_DOMAINS,
  generateShoppingItems,
  getLatestCheckIn,
  getMealsForDate,
  getOpenRepair,
  getTodayTasks,
  getWeekDates
} from '../assets/js/calm-models.js';
import {
  clearSafetyNotes,
  createRecord,
  loadSafetyNotes,
  loadState,
  resetState,
  saveSafetyNotes,
  saveState,
  upsertById
} from '../assets/js/calm-store.js';
import { addDaysISO, formatDate, todayISO } from '../assets/js/calm-utils.js';

const state = loadState();
let seedMeals = [];
let safetyResources = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function persist() {
  saveState(state);
}

function setView(viewName) {
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.viewTarget === viewName));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${viewName}`));
}

function optionList(values, selected = '') {
  return values.map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${titleCase(value)}</option>`).join('');
}

function mealOptions(selected = '', includeEmpty = false) {
  const empty = includeEmpty ? '<option value="">None</option>' : '';
  return `${empty}${seedMeals.map((meal) => `<option value="${meal.id}"${meal.id === selected ? ' selected' : ''}>${meal.name}</option>`).join('')}`;
}

function titleCase(value = '') {
  return String(value)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function mealName(mealId) {
  return seedMeals.find((meal) => meal.id === mealId)?.name || 'Unplanned';
}

function renderToday() {
  $('#selected-date').value = state.selectedDate;
  $('#meal-date').value = $('#meal-date').value || state.selectedDate;
  $('#task-due').value = $('#task-due').value || state.selectedDate;

  const todayMeals = getMealsForDate(state.mealPlan, state.selectedDate);
  $('#today-meals').innerHTML = todayMeals.length
    ? todayMeals.map((entry) => `
        <div class="record">
          <div class="record-header">
            <span class="record-title">${titleCase(entry.mealSlot)}</span>
            <span class="tag">${entry.assignedCook || state.settings.selfName}</span>
          </div>
          <div>${mealName(entry.mealId)}</div>
          ${entry.fallbackMealId ? `<div class="record-meta">Fallback: ${mealName(entry.fallbackMealId)}</div>` : ''}
        </div>
      `).join('')
    : '<div class="empty">No meals planned for this date yet.</div>';

  const todayTasks = getTodayTasks(state.tasks, state.selectedDate);
  $('#today-tasks').innerHTML = todayTasks.length
    ? todayTasks.slice(0, 5).map(renderTaskRecord).join('')
    : '<div class="empty">No open owned tasks due today.</div>';

  const dayChecks = state.resetChecks[state.selectedDate] || {};
  $('#reset-checks').innerHTML = RESET_ITEMS.map((item) => `
    <label class="check-row">
      <input type="checkbox" data-reset-id="${item.id}"${dayChecks[item.id] ? ' checked' : ''}>
      <span>${item.label}</span>
    </label>
  `).join('');

  const latestCheckIn = getLatestCheckIn(state.checkIns);
  $('#latest-checkin').innerHTML = latestCheckIn
    ? `<strong>${titleCase(latestCheckIn.moodState)}</strong><br>${titleCase(latestCheckIn.requestType)}${latestCheckIn.message ? ` - ${escapeHtml(latestCheckIn.message)}` : ''}`
    : 'No check-in saved yet.';

  const openRepair = getOpenRepair(state.repairs);
  $('#open-repair').innerHTML = openRepair
    ? `<strong>${escapeHtml(openRepair.eventLabel)}</strong><br>${escapeHtml(openRepair.nextAction || openRepair.repairAction)}`
    : 'No open repair right now.';

  const handled = state.handledLogs
    .filter((log) => log.date === state.selectedDate)
    .sort((a, b) => b.createdAt - a.createdAt);
  $('#handled-list').innerHTML = handled.length
    ? handled.map((log) => `<div class="handled-item">${escapeHtml(log.text)}</div>`).join('')
    : '<div class="empty">Nothing logged yet.</div>';
}

function renderMeals() {
  const weekDates = getWeekDates(state.selectedDate);
  const entriesByDate = Object.groupBy
    ? Object.groupBy(state.mealPlan.filter((entry) => !entry.deletedAt), (entry) => entry.date)
    : state.mealPlan.reduce((grouped, entry) => {
        if (!entry.deletedAt) {
          grouped[entry.date] = [...(grouped[entry.date] || []), entry];
        }
        return grouped;
      }, {});

  $('#week-plan').innerHTML = weekDates.map((date) => {
    const entries = (entriesByDate[date] || []).sort((a, b) => MEAL_SLOTS.indexOf(a.mealSlot) - MEAL_SLOTS.indexOf(b.mealSlot));
    const rows = entries.length
      ? entries.map((entry) => `
          <div class="meal-row">
            <span>${titleCase(entry.mealSlot)}</span>
            <span>${mealName(entry.mealId)}${entry.fallbackMealId ? ` / fallback: ${mealName(entry.fallbackMealId)}` : ''}</span>
          </div>
        `).join('')
      : '<div class="meal-row"><span>Open</span><span>No meals planned.</span></div>';
    return `<div class="week-day"><strong>${formatDate(date)}</strong>${rows}</div>`;
  }).join('');

  $('#grocery-list').innerHTML = state.shoppingItems.length
    ? state.shoppingItems.map((item) => `
        <div class="grocery-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="record-meta">${escapeHtml(item.category)} / ${escapeHtml(item.sourceMeals?.join(', ') || 'Meal plan')}</span>
        </div>
      `).join('')
    : '<div class="empty">Generate groceries from this week&apos;s meal plan.</div>';
}

function renderTasks() {
  const mode = $('#task-filter').value;
  const weekEnd = addDaysISO(state.selectedDate, 7);
  let tasks = state.tasks.filter((task) => !task.deletedAt);

  if (mode === 'today') {
    tasks = getTodayTasks(tasks, state.selectedDate);
  } else if (mode === 'week') {
    tasks = tasks.filter((task) => task.status !== 'done' && (!task.dueDate || task.dueDate <= weekEnd));
  } else if (mode === 'done') {
    tasks = tasks.filter((task) => task.status === 'done');
  } else if (mode === 'recurring') {
    tasks = tasks.filter((task) => task.recurrence);
  }

  tasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  $('#task-list').innerHTML = tasks.length ? tasks.map(renderTaskRecord).join('') : '<div class="empty">No tasks in this view.</div>';
}

function renderTaskRecord(task) {
  return `
    <div class="record" data-task-id="${task.id}">
      <div class="record-header">
        <span class="record-title">${escapeHtml(task.title)}</span>
        <span class="tag">${escapeHtml(task.status || 'open')}</span>
      </div>
      <div class="record-meta">
        <span>${escapeHtml(task.domain || 'household')}</span>
        <span>${task.dueDate ? formatDate(task.dueDate) : 'No date'}</span>
        <span>${escapeHtml(task.owner || state.settings.selfName || 'Me')}</span>
      </div>
      ${task.visiblePromise ? `<div>${escapeHtml(task.visiblePromise)}</div>` : ''}
      <div class="record-actions">
        <button type="button" data-task-action="claim">Claim ownership</button>
        <button type="button" class="primary" data-task-action="done">Done visibly</button>
        ${task.recurrence ? '<button type="button" data-task-action="duplicate">Next recurrence</button>' : ''}
      </div>
    </div>
  `;
}

function renderCheckIns() {
  const recent = [...state.checkIns].filter((entry) => !entry.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
  $('#checkin-list').innerHTML = recent.length
    ? recent.slice(0, 8).map((entry) => `
        <div class="record">
          <div class="record-header">
            <span class="record-title">${titleCase(entry.moodState)}</span>
            <span class="tag">${titleCase(entry.requestType)}</span>
          </div>
          ${entry.message ? `<div>${escapeHtml(entry.message)}</div>` : ''}
          <div class="record-meta">${new Date(entry.createdAt).toLocaleString()}</div>
        </div>
      `).join('')
    : '<div class="empty">No check-ins yet.</div>';

  $('#support-map-list').innerHTML = state.supportMaps.length
    ? state.supportMaps.filter((entry) => !entry.deletedAt).map((entry) => `
        <div class="record">
          <strong>${escapeHtml(entry.situation)}</strong>
          <div><span class="tag">Helps</span> ${escapeHtml(entry.whatHelps)}</div>
          ${entry.requestPhrase ? `<div><span class="tag">Ask</span> ${escapeHtml(entry.requestPhrase)}</div>` : ''}
          ${entry.boundary ? `<div><span class="tag">Boundary</span> ${escapeHtml(entry.boundary)}</div>` : ''}
        </div>
      `).join('')
    : '<div class="empty">No support maps saved yet.</div>';
}

function renderRepairs() {
  const repairs = state.repairs.filter((repair) => !repair.deletedAt).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#repair-list').innerHTML = repairs.length
    ? repairs.map((repair) => `
        <div class="record" data-repair-id="${repair.id}">
          <div class="record-header">
            <span class="record-title">${escapeHtml(repair.eventLabel)}</span>
            <span class="tag">${escapeHtml(repair.status || 'open')}</span>
          </div>
          <div><strong>Mine:</strong> ${escapeHtml(repair.whatIOwn)}</div>
          <div><strong>Repair:</strong> ${escapeHtml(repair.repairAction)}</div>
          <div><strong>Next:</strong> ${escapeHtml(repair.nextAction)}</div>
          <div class="record-actions">
            <button type="button" class="primary" data-repair-action="complete">Complete repair</button>
          </div>
        </div>
      `).join('')
    : '<div class="empty">No repairs logged yet.</div>';
}

function renderSafety() {
  $('#safety-resources').innerHTML = safetyResources
    .sort((a, b) => a.priority - b.priority)
    .map((resource) => `
      <div class="resource">
        <strong>${escapeHtml(resource.label)}</strong>
        <a href="tel:${resource.phone.replace(/[^0-9]/g, '')}">${escapeHtml(resource.phone)}</a>
        <span>${escapeHtml(resource.description)}</span>
        <a href="${resource.url}" target="_blank" rel="noreferrer">Source</a>
      </div>
    `).join('');
}

function renderSettings() {
  $('#self-name').value = state.settings.selfName || 'Me';
  $('#household-name').value = state.settings.householdName || 'Home';
}

function renderAll() {
  renderToday();
  renderMeals();
  renderTasks();
  renderCheckIns();
  renderRepairs();
  renderSafety();
  renderSettings();
}

function setupStaticOptions() {
  $('#meal-slot').innerHTML = optionList(MEAL_SLOTS);
  $('#meal-choice').innerHTML = mealOptions();
  $('#fallback-meal').innerHTML = mealOptions('', true);
  $('#task-domain').innerHTML = optionList(TASK_DOMAINS);
  $('#mood-state').innerHTML = optionList(MOOD_STATES);
  $('#request-type').innerHTML = optionList(REQUEST_TYPES);
}

function setupEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-view-target]');
    if (target) {
      setView(target.dataset.viewTarget);
    }

    const taskButton = event.target.closest('[data-task-action]');
    if (taskButton) {
      handleTaskAction(taskButton.closest('[data-task-id]')?.dataset.taskId, taskButton.dataset.taskAction);
    }

    const repairButton = event.target.closest('[data-repair-action]');
    if (repairButton) {
      handleRepairAction(repairButton.closest('[data-repair-id]')?.dataset.repairId, repairButton.dataset.repairAction);
    }
  });

  $('#selected-date').addEventListener('change', (event) => {
    state.selectedDate = event.target.value || todayISO();
    persist();
    renderAll();
  });

  $('#reset-checks').addEventListener('change', (event) => {
    const input = event.target.closest('[data-reset-id]');
    if (!input) return;
    state.resetChecks[state.selectedDate] = {
      ...(state.resetChecks[state.selectedDate] || {}),
      [input.dataset.resetId]: input.checked
    };
    persist();
  });

  $('#handled-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#handled-text');
    const text = input.value.trim();
    if (!text) return;
    state.handledLogs.push(createRecord('handled', { text, date: state.selectedDate }));
    input.value = '';
    persist();
    renderToday();
  });

  $('#meal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = createRecord('mealPlanEntry', {
      date: $('#meal-date').value || state.selectedDate,
      mealSlot: $('#meal-slot').value,
      mealId: $('#meal-choice').value,
      fallbackMealId: $('#fallback-meal').value,
      assignedCook: $('#assigned-cook').value.trim() || state.settings.selfName,
      groceryGenerated: false
    });
    state.mealPlan = upsertById(state.mealPlan, record);
    persist();
    renderAll();
  });

  $('#generate-groceries').addEventListener('click', () => {
    const weekDates = new Set(getWeekDates(state.selectedDate));
    const planned = state.mealPlan.filter((entry) => !entry.deletedAt && weekDates.has(entry.date));
    state.shoppingItems = generateShoppingItems(planned, seedMeals).map((item) => createRecord('shoppingItem', item));
    state.mealPlan = state.mealPlan.map((entry) => weekDates.has(entry.date) ? { ...entry, groceryGenerated: true, updatedAt: Date.now() } : entry);
    persist();
    renderMeals();
  });

  $('#task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = createRecord('task', {
      title: $('#task-title').value.trim(),
      domain: $('#task-domain').value,
      owner: $('#task-owner').value.trim() || state.settings.selfName,
      status: 'open',
      dueDate: $('#task-due').value,
      recurrence: $('#task-recurrence').value,
      visiblePromise: $('#task-promise').value.trim(),
      notes: $('#task-notes').value.trim()
    });
    if (!record.title) return;
    state.tasks.push(record);
    event.target.reset();
    $('#task-due').value = state.selectedDate;
    persist();
    renderAll();
  });

  $('#task-filter').addEventListener('change', renderTasks);

  $('#checkin-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.checkIns.push(createRecord('checkIn', {
      moodState: $('#mood-state').value,
      requestType: $('#request-type').value,
      urgency: $('#checkin-urgency').value,
      visibility: 'local',
      message: $('#checkin-message').value.trim()
    }));
    $('#checkin-message').value = '';
    persist();
    renderAll();
  });

  $('#support-map-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const record = createRecord('triggerSupportMap', {
      situation: $('#support-situation').value.trim(),
      whatHelps: $('#support-helps').value.trim(),
      whatMakesItWorse: $('#support-worse').value.trim(),
      requestPhrase: $('#support-request').value.trim(),
      boundary: $('#support-boundary').value.trim()
    });
    if (!record.situation) return;
    state.supportMaps.push(record);
    event.target.reset();
    persist();
    renderCheckIns();
  });

  $('#repair-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.repairs.push(createRecord('repair', {
      eventLabel: $('#repair-event').value.trim(),
      whatIOwn: $('#repair-own').value.trim(),
      impact: $('#repair-impact').value.trim(),
      repairAction: $('#repair-action').value.trim(),
      nextAction: $('#repair-next').value.trim(),
      status: 'open'
    }));
    event.target.reset();
    persist();
    renderAll();
  });

  $('#quick-exit').addEventListener('click', () => {
    window.location.replace('https://www.google.com/search?q=weather');
  });

  $('#safety-notes').value = loadSafetyNotes();
  $('#save-safety-notes').addEventListener('click', () => {
    saveSafetyNotes($('#safety-notes').value);
  });
  $('#clear-safety-notes').addEventListener('click', () => {
    clearSafetyNotes();
    $('#safety-notes').value = '';
  });

  $('#settings-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.settings.selfName = $('#self-name').value.trim() || 'Me';
    state.settings.householdName = $('#household-name').value.trim() || 'Home';
    persist();
    renderAll();
  });

  $('#reset-demo').addEventListener('click', () => {
    resetState();
    window.location.reload();
  });
}

function handleTaskAction(taskId, action) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (action === 'claim') {
    task.owner = state.settings.selfName || 'Me';
  }

  if (action === 'done') {
    task.status = 'done';
    task.doneAt = Date.now();
    state.handledLogs.push(createRecord('handled', {
      text: task.title,
      date: state.selectedDate
    }));
  }

  if (action === 'duplicate') {
    const nextDue = task.recurrence === 'daily'
      ? addDaysISO(task.dueDate || state.selectedDate, 1)
      : task.recurrence === 'monthly'
        ? addDaysISO(task.dueDate || state.selectedDate, 30)
        : addDaysISO(task.dueDate || state.selectedDate, 7);
    state.tasks.push(createRecord('task', {
      ...task,
      id: undefined,
      status: 'open',
      doneAt: null,
      dueDate: nextDue
    }));
  }

  task.updatedAt = Date.now();
  persist();
  renderAll();
}

function handleRepairAction(repairId, action) {
  const repair = state.repairs.find((item) => item.id === repairId);
  if (!repair || action !== 'complete') return;
  repair.status = 'complete';
  repair.completedAt = Date.now();
  repair.updatedAt = Date.now();
  persist();
  renderAll();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadJson(path, fallback = []) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch (_error) {
    return fallback;
  }
}

async function init() {
  [seedMeals, safetyResources] = await Promise.all([
    loadJson('../data/seed-meals.json'),
    loadJson('../data/safety-resources.json')
  ]);
  setupStaticOptions();
  setupEvents();
  renderAll();
}

init();
