(function () {
  'use strict';

  let workingData = null;
  let appInitialized = false;
  let liveSaveChain = Promise.resolve();
  let loginBusy = false;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function publishLive(message) {
    const snapshot = Tournament.normalizeData(workingData);
    Tournament.savePreview(snapshot);

    if (!window.LiveData?.isConfigured()) {
      setStatus('Live publishing is not configured yet. Complete the one-time Firebase setup in assets/js/live-config.js.', 'error');
      return;
    }

    setStatus('Publishing the latest change…', 'neutral');
    liveSaveChain = liveSaveChain
      .catch(() => undefined)
      .then(() => window.LiveData.saveTournament(snapshot))
      .then(() => setStatus(`${message} The public page is now updated.`, 'success'))
      .catch((error) => setStatus(`The change was kept locally, but the public page could not update: ${window.LiveData.friendlyError(error)}`, 'error'));
  }

  function markDirty(message = 'Changes saved.') {
    workingData.settings.updatedAt = new Date().toISOString();
    renderSummary();
    publishLive(message);
  }

  function setStatus(message, type = 'neutral') {
    const status = qs('[data-admin-status]');
    status.textContent = message;
    status.dataset.type = type;
  }

  function matchParticipant(player, side, match) {
    if (!player) {
      return `<div class="admin-player admin-player--empty"><span>—</span><div><strong>${match.state === 'bye' ? 'BYE' : 'Waiting'}</strong><small>${match.state === 'bye' ? 'Automatic advance' : 'Previous result required'}</small></div></div>`;
    }
    return `<div class="admin-player"><span class="admin-player__flag">${Tournament.escapeHTML(player.flag)}</span><div><strong>${Tournament.escapeHTML(player.name)}</strong><small>${Tournament.escapeHTML(player.nation)}</small></div><span class="admin-player__side">${side}</span></div>`;
  }

  function renderMatchEditor(match, roundName) {
    const isPlayable = Boolean(match.playerA && match.playerB);
    const result = match.result;
    const winnerText = match.winner ? `${match.winner.name} advances` : '';

    return `
      <article class="admin-match" data-match-key="${match.key}">
        <div class="admin-match__head">
          <div>
            <span>${Tournament.escapeHTML(roundName)}</span>
            <h4>Match ${String(match.number).padStart(2, '0')}</h4>
          </div>
          <span class="admin-match__state admin-match__state--${match.state}">${match.state}</span>
        </div>
        <div class="admin-match__players">
          ${matchParticipant(match.playerA, 'A', match)}
          ${matchParticipant(match.playerB, 'B', match)}
        </div>
        ${(match.schedule?.date || match.schedule?.time || match.schedule?.table) ? `
          <div class="admin-match__slot">
            <span>${Tournament.escapeHTML([Tournament.formatScheduleDate(match.schedule, { compact: true }), Tournament.formatScheduleTime(match.schedule)].filter(Boolean).join(' · ') || 'Time TBD')}</span>
            <strong>${Tournament.escapeHTML(match.schedule.table || 'Table TBD')}</strong>
          </div>` : ''}
        ${isPlayable ? `
          <div class="score-entry">
            <label>
              <span>${Tournament.escapeHTML(match.playerA.name)} score</span>
              <input type="number" min="0" step="1" inputmode="numeric" data-score-a value="${result ? result.scoreA : ''}" placeholder="0">
            </label>
            <span class="score-entry__divider">—</span>
            <label>
              <span>${Tournament.escapeHTML(match.playerB.name)} score</span>
              <input type="number" min="0" step="1" inputmode="numeric" data-score-b value="${result ? result.scoreB : ''}" placeholder="0">
            </label>
          </div>
          <div class="admin-match__actions">
            <button class="button button--primary button--small" type="button" data-save-result data-round="${match.roundIndex}" data-match="${match.matchIndex}">${result ? 'Update result' : 'Save result'}</button>
            ${result ? `<button class="button button--ghost button--small" type="button" data-clear-result data-key="${match.key}">Clear</button>` : ''}
            <span class="admin-match__winner">${Tournament.escapeHTML(winnerText)}</span>
          </div>` : `
          <div class="admin-match__notice">
            ${match.state === 'bye' && match.winner ? `${Tournament.escapeHTML(match.winner.name)} advances automatically.` : 'This match unlocks when both players are known.'}
          </div>`}
      </article>`;
  }

  function renderMatches() {
    const bracket = Tournament.deriveBracket(workingData);
    if (bracket.invalidResultKeys.length) {
      bracket.invalidResultKeys.forEach((key) => delete workingData.results[key]);
      Tournament.savePreview(workingData);
    }
    const container = qs('[data-match-editors]');
    container.innerHTML = bracket.rounds.map((round, index) => `
      <section class="admin-round${index === 0 ? ' is-open' : ''}" data-admin-round>
        <button class="admin-round__toggle" type="button" aria-expanded="${index === 0 ? 'true' : 'false'}" data-round-toggle>
          <span><small>Round ${index + 1}</small>${round.name}</span>
          <span>${round.matches.filter((match) => match.state === 'complete').length}/${round.matches.filter((match) => match.state !== 'bye').length} complete</span>
        </button>
        <div class="admin-round__body">
          <div class="admin-match-grid">
            ${round.matches.map((match) => renderMatchEditor(match, round.name)).join('')}
          </div>
        </div>
      </section>`).join('');

    qsa('[data-round-toggle]', container).forEach((button) => button.addEventListener('click', () => {
      const section = button.closest('[data-admin-round]');
      const isOpen = section.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    }));

    qsa('[data-save-result]', container).forEach((button) => button.addEventListener('click', saveResult));
    qsa('[data-clear-result]', container).forEach((button) => button.addEventListener('click', clearResult));
  }

  function scheduleParticipantLabel(match) {
    const playerA = match.playerA?.name || 'TBD';
    const playerB = match.playerB?.name || 'TBD';
    return `${playerA} vs ${playerB}`;
  }

  function renderScheduleEditors() {
    const container = qs('[data-schedule-editors]');
    if (!container) return;
    const bracket = Tournament.deriveBracket(workingData);
    container.innerHTML = bracket.rounds.map((round) => {
      const schedulableMatches = round.matches.filter((match) => match.state !== 'bye');
      return `
        <section class="schedule-editor-round">
          <header>
            <div><span>Round ${round.index + 1}</span><h3>${Tournament.escapeHTML(round.name)}</h3></div>
            <strong>${schedulableMatches.length} ${schedulableMatches.length === 1 ? 'slot' : 'slots'}</strong>
          </header>
          <div class="schedule-editor-grid">
            ${schedulableMatches.map((match) => `
              <article class="schedule-slot-editor" data-schedule-key="${match.key}">
                <div class="schedule-slot-editor__title">
                  <span>Match ${String(match.number).padStart(2, '0')}</span>
                  <strong>${Tournament.escapeHTML(scheduleParticipantLabel(match))}</strong>
                </div>
                <label><span>Date</span><input type="date" data-slot-date value="${Tournament.escapeHTML(match.schedule?.date || '')}"></label>
                <label><span>Time</span><input type="time" data-slot-time value="${Tournament.escapeHTML(match.schedule?.time || '')}"></label>
                <label class="schedule-slot-editor__table"><span>Table / court</span><input type="text" data-slot-table value="${Tournament.escapeHTML(match.schedule?.table || '')}" placeholder="Table 1"></label>
              </article>`).join('')}
          </div>
        </section>`;
    }).join('');
  }

  function syncScheduleFromEditor() {
    const container = qs('[data-schedule-editors]');
    if (!container) return;
    const nextSchedule = { ...(workingData.schedule || {}) };
    qsa('[data-schedule-key]', container).forEach((card) => {
      const key = card.dataset.scheduleKey;
      const slot = {
        date: qs('[data-slot-date]', card).value,
        time: qs('[data-slot-time]', card).value,
        table: qs('[data-slot-table]', card).value.trim()
      };
      if (slot.date || slot.time || slot.table) nextSchedule[key] = slot;
      else delete nextSchedule[key];
    });
    workingData.schedule = nextSchedule;
  }

  function saveSchedule() {
    syncScheduleFromEditor();
    markDirty('Match date and time slots saved.');
    renderMatches();
  }

  function localDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function localTimeValue(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function generateSchedule(event) {
    event.preventDefault();
    const dateValue = qs('#schedule-start-date').value;
    const timeValue = qs('#schedule-start-time').value;
    const duration = Number(qs('#schedule-duration').value);
    const tableCount = Number(qs('#schedule-tables').value);
    const roundBreak = Number(qs('#schedule-round-break').value);

    if (!dateValue || !timeValue || !Number.isFinite(duration) || duration < 5 || !Number.isInteger(tableCount) || tableCount < 1 || !Number.isFinite(roundBreak) || roundBreak < 0) {
      setStatus('Add a valid start date, time, match duration, table count, and round break.', 'error');
      return;
    }

    const start = new Date(`${dateValue}T${timeValue}:00`);
    if (Number.isNaN(start.getTime())) {
      setStatus('The schedule start date or time is invalid.', 'error');
      return;
    }

    const bracket = Tournament.deriveBracket(workingData);
    const generated = {};
    let cursor = new Date(start);

    bracket.rounds.forEach((round) => {
      const matches = round.matches.filter((match) => match.state !== 'bye');
      const roundStart = new Date(cursor);
      matches.forEach((match, index) => {
        const batch = Math.floor(index / tableCount);
        const tableNumber = (index % tableCount) + 1;
        const slotDate = new Date(roundStart.getTime() + (batch * duration * 60000));
        generated[match.key] = {
          date: localDateValue(slotDate),
          time: localTimeValue(slotDate),
          table: `Table ${tableNumber}`
        };
      });
      const batches = Math.ceil(matches.length / tableCount);
      cursor = new Date(roundStart.getTime() + ((batches * duration + roundBreak) * 60000));
    });

    workingData.schedule = generated;
    workingData.settings.date = Tournament.formatScheduleDate({ date: dateValue });
    markDirty('A complete tournament timetable was generated and saved. Review any individual slots below.');
    renderEventForm();
    renderScheduleEditors();
    renderMatches();
  }

  function saveResult(event) {
    const button = event.currentTarget;
    const roundIndex = Number(button.dataset.round);
    const matchIndex = Number(button.dataset.match);
    const bracket = Tournament.deriveBracket(workingData);
    const match = bracket.rounds[roundIndex]?.matches[matchIndex];
    const card = button.closest('[data-match-key]');
    const scoreA = Number(qs('[data-score-a]', card).value);
    const scoreB = Number(qs('[data-score-b]', card).value);

    if (!match?.playerA || !match?.playerB) {
      setStatus('This match is not ready yet.', 'error');
      return;
    }
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
      setStatus('Enter two whole-number scores of zero or higher.', 'error');
      return;
    }
    if (scoreA === scoreB) {
      setStatus('Foosball matches need a winner. Tied scores cannot be saved.', 'error');
      return;
    }

    workingData.results[match.key] = {
      playerAId: match.playerA.id,
      playerBId: match.playerB.id,
      scoreA,
      scoreB,
      updatedAt: new Date().toISOString()
    };
    markDirty(`${scoreA > scoreB ? match.playerA.name : match.playerB.name} advances. The bracket has been updated.`);
    renderMatches();
    renderScheduleEditors();
  }

  function clearResult(event) {
    const key = event.currentTarget.dataset.key;
    delete workingData.results[key];
    markDirty('Result cleared. Any affected later-round result was also removed.');
    renderMatches();
    renderScheduleEditors();
  }

  function renderEventForm() {
    const settings = workingData.settings;
    qs('#event-title').value = settings.title || '';
    qs('#event-eyebrow').value = settings.eyebrow || '';
    qs('#event-subtitle').value = settings.subtitle || '';
    qs('#event-date').value = settings.date || '';
    qs('#event-location').value = settings.location || '';
    qs('#event-status').value = settings.status || '';
  }

  function saveEventSettings(event) {
    event.preventDefault();
    workingData.settings = {
      ...workingData.settings,
      title: qs('#event-title').value.trim() || 'Nations Cup',
      eyebrow: qs('#event-eyebrow').value.trim(),
      subtitle: qs('#event-subtitle').value.trim(),
      date: qs('#event-date').value.trim(),
      location: qs('#event-location').value.trim(),
      status: qs('#event-status').value.trim()
    };
    markDirty('Event details saved.');
  }

  function renderPlayersEditor() {
    const container = qs('[data-player-editor]');
    container.innerHTML = workingData.players
      .sort((a, b) => a.seed - b.seed)
      .map((player, index) => `
        <div class="player-editor-row" data-player-id="${Tournament.escapeHTML(player.id)}">
          <span class="player-editor-row__seed">${String(index + 1).padStart(2, '0')}</span>
          <input class="player-editor-row__flag" value="${Tournament.escapeHTML(player.flag)}" aria-label="Flag for ${Tournament.escapeHTML(player.name)}">
          <input value="${Tournament.escapeHTML(player.name)}" data-player-name aria-label="Player name">
          <input value="${Tournament.escapeHTML(player.nation)}" data-player-nation aria-label="Nation">
          <div class="player-editor-row__controls">
            <button type="button" class="icon-button" data-move-up aria-label="Move ${Tournament.escapeHTML(player.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-button" data-move-down aria-label="Move ${Tournament.escapeHTML(player.name)} down" ${index === workingData.players.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon-button icon-button--danger" data-remove-player aria-label="Remove ${Tournament.escapeHTML(player.name)}">×</button>
          </div>
        </div>`).join('');

    qsa('[data-move-up]', container).forEach((button) => button.addEventListener('click', () => movePlayer(button, -1)));
    qsa('[data-move-down]', container).forEach((button) => button.addEventListener('click', () => movePlayer(button, 1)));
    qsa('[data-remove-player]', container).forEach((button) => button.addEventListener('click', removePlayer));
  }

  function syncPlayersFromEditor() {
    const rows = qsa('[data-player-id]', qs('[data-player-editor]'));
    workingData.players = rows.map((row, index) => ({
      id: row.dataset.playerId,
      seed: index + 1,
      flag: qs('.player-editor-row__flag', row).value.trim() || '🌐',
      name: qs('[data-player-name]', row).value.trim() || `Player ${index + 1}`,
      nation: qs('[data-player-nation]', row).value.trim() || 'Nation TBD'
    }));
  }

  function resetResultsForDrawChange(message) {
    workingData.results = {};
    workingData.players.forEach((player, index) => { player.seed = index + 1; });
    markDirty(message);
    renderPlayersEditor();
    renderMatches();
    renderScheduleEditors();
  }

  function movePlayer(button, direction) {
    syncPlayersFromEditor();
    const row = button.closest('[data-player-id]');
    const index = workingData.players.findIndex((player) => player.id === row.dataset.playerId);
    const target = index + direction;
    if (target < 0 || target >= workingData.players.length) return;
    [workingData.players[index], workingData.players[target]] = [workingData.players[target], workingData.players[index]];
    resetResultsForDrawChange('Draw order changed. Existing match results were reset.');
  }

  function removePlayer(event) {
    syncPlayersFromEditor();
    const id = event.currentTarget.closest('[data-player-id]').dataset.playerId;
    if (workingData.players.length <= 2) {
      setStatus('A tournament needs at least two players.', 'error');
      return;
    }
    workingData.players = workingData.players.filter((player) => player.id !== id);
    resetResultsForDrawChange('Player removed. The draw and existing results were reset.');
  }

  function addPlayer() {
    syncPlayersFromEditor();
    const nextNumber = workingData.players.length + 1;
    let id = `player-${nextNumber}`;
    while (workingData.players.some((player) => player.id === id)) id = `${id}-${Date.now()}`;
    workingData.players.push({ id, seed: nextNumber, name: `Player ${nextNumber}`, nation: 'Nation TBD', flag: '🌐' });
    resetResultsForDrawChange('Player added. Complete their details, then save the draw.');
  }

  function savePlayers() {
    syncPlayersFromEditor();
    workingData.players.forEach((player, index) => {
      player.seed = index + 1;
      if (!player.id || player.id.startsWith('player-')) player.id = `${Tournament.slugify(player.name)}-${index + 1}`;
    });
    resetResultsForDrawChange('Players and draw saved. Existing match results were reset.');
  }

  function shuffleDraw() {
    syncPlayersFromEditor();
    for (let index = workingData.players.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [workingData.players[index], workingData.players[randomIndex]] = [workingData.players[randomIndex], workingData.players[index]];
    }
    resetResultsForDrawChange('A new random draw was created. Existing results were reset.');
  }

  function renderSummary() {
    const bracket = Tournament.deriveBracket(workingData);
    const completed = bracket.rounds.flatMap((round) => round.matches).filter((match) => match.state === 'complete').length;
    const playable = bracket.rounds.flatMap((round) => round.matches).filter((match) => match.state !== 'bye').length;
    qs('[data-summary-players]').textContent = workingData.players.length;
    qs('[data-summary-byes]').textContent = bracket.byeCount;
    qs('[data-summary-results]').textContent = `${completed}/${playable}`;
    qs('[data-summary-champion]').textContent = bracket.champion?.name || 'Pending';
  }

  function downloadData() {
    syncPlayersFromEditor();
    syncScheduleFromEditor();
    workingData.settings.updatedAt = new Date().toISOString();
    Tournament.savePreview(workingData);
    const blob = new Blob([`${JSON.stringify(workingData, null, 2)}
`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tournament-data.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus('Tournament backup downloaded.', 'success');
  }

  async function importData(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      workingData = Tournament.normalizeData(parsed);
      renderAll();
      markDirty('Tournament backup restored successfully.');
    } catch (error) {
      setStatus('That file is not a valid tournament backup.', 'error');
    } finally {
      event.currentTarget.value = '';
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const current = qs('[data-current-password]').value;
    const next = qs('[data-new-password]').value;
    const confirm = qs('[data-confirm-password]').value;

    if (next.length < 8) {
      setStatus('Use a password with at least eight characters.', 'error');
      return;
    }
    if (next !== confirm) {
      setStatus('The new passwords do not match.', 'error');
      return;
    }

    try {
      setStatus('Updating the admin password…', 'neutral');
      await window.LiveData.changePassword(current, next);
      event.currentTarget.reset();
      setStatus('Admin password updated. The new password works from every device.', 'success');
    } catch (error) {
      setStatus(`The password could not be changed: ${window.LiveData.friendlyError(error)}`, 'error');
    }
  }

  function showAdminApp() {
    document.body.classList.remove('admin-body--locked');
    qs('[data-login-screen]').hidden = true;
    qs('[data-admin-app]').hidden = false;
  }

  function showLogin() {
    document.body.classList.add('admin-body--locked');
    qs('[data-admin-app]').hidden = true;
    qs('[data-login-screen]').hidden = false;
    qs('[data-login-password]').value = '';
    qs('[data-login-error]').textContent = '';
    window.setTimeout(() => qs('[data-login-password]')?.focus(), 50);
  }

  async function unlockAdmin(event) {
    event?.preventDefault?.();
    if (loginBusy) return;

    const form = qs('[data-login-form]');
    const input = qs('[data-login-password]');
    const error = qs('[data-login-error]');
    const submit = qs('[data-login-submit]', form) || qs('[data-login-submit]');
    const password = input?.value || '';

    if (!window.LiveData?.isConfigured()) {
      error.textContent = 'Firebase is not connected. Set enabled to true and add the API key and database URL in assets/js/live-config.js.';
      return;
    }

    if (!password) {
      error.textContent = 'Enter the tournament password.';
      input?.focus();
      return;
    }

    loginBusy = true;
    error.textContent = 'Checking password…';
    error.dataset.state = 'loading';
    submit.disabled = true;
    submit.textContent = 'Opening dashboard…';

    try {
      await window.LiveData.signIn(password);
      error.textContent = '';
      delete error.dataset.state;
      showAdminApp();
      window.location.hash = 'dashboard';
      window.scrollTo({ top: 0, behavior: 'auto' });
      await initApp();
    } catch (loginError) {
      showLogin();
      error.textContent = window.LiveData?.friendlyError(loginError) || 'The live tournament could not be reached.';
      error.dataset.state = 'error';
      input?.select();
    } finally {
      loginBusy = false;
      submit.disabled = false;
      submit.textContent = 'Unlock tournament desk';
    }
  }

  function lockAdmin() {
    window.LiveData?.signOut();
    showLogin();
  }

  function resetPreview() {
    Tournament.clearPreview();
    workingData = Tournament.normalizeData(Tournament.FALLBACK_DATA);
    renderAll();
    markDirty('Tournament reset to the original 13-player draw with three opening-round byes and no later byes.');
  }

  function initTabs() {
    qsa('[data-tab-button]').forEach((button) => button.addEventListener('click', () => {
      const tab = button.dataset.tabButton;
      qsa('[data-tab-button]').forEach((item) => item.classList.toggle('is-active', item === button));
      qsa('[data-tab-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.tabPanel === tab));
    }));
  }

  function renderAll() {
    renderEventForm();
    renderPlayersEditor();
    renderMatches();
    renderScheduleEditors();
    renderSummary();
  }

  async function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    let liveConnected = false;
    let connectionError = null;
    try {
      const remoteData = await window.LiveData.loadTournament();
      if (remoteData) {
        workingData = Tournament.normalizeData(remoteData);
      } else {
        workingData = await Tournament.loadData({ useLive: false });
        workingData.settings.updatedAt = new Date().toISOString();
        await window.LiveData.saveTournament(workingData);
      }
      Tournament.savePreview(workingData);
      liveConnected = true;
    } catch (error) {
      connectionError = error;
      workingData = await Tournament.loadData({ useLive: false });
    }

    initTabs();
    renderAll();
    if (liveConnected) {
      setStatus('Connected. Every saved change publishes directly to the public page.', 'success');
    } else {
      setStatus(`The desk opened with its local backup, but live publishing is unavailable: ${window.LiveData.friendlyError(connectionError)}`, 'error');
    }

    qs('[data-event-form]')?.addEventListener('submit', saveEventSettings);
    qs('[data-schedule-generator]')?.addEventListener('submit', generateSchedule);
    qs('[data-save-schedule]')?.addEventListener('click', saveSchedule);
    qs('[data-add-player]')?.addEventListener('click', addPlayer);
    qs('[data-save-players]')?.addEventListener('click', savePlayers);
    qs('[data-shuffle]')?.addEventListener('click', shuffleDraw);
    qs('[data-download]')?.addEventListener('click', downloadData);
    qs('[data-import]')?.addEventListener('change', importData);
    qs('[data-password-form]')?.addEventListener('submit', changePassword);
    qs('[data-reset]')?.addEventListener('click', resetPreview);
    qs('[data-lock-admin]')?.addEventListener('click', lockAdmin);
  }

  window.NationsCupAdminLogin = unlockAdmin;

  document.addEventListener('DOMContentLoaded', async () => {
    const error = qs('[data-login-error]');

    if (!window.LiveData) {
      showLogin();
      error.textContent = 'The live connection script did not load. Replace assets/js/live-data.js and hard-refresh this page.';
      error.dataset.state = 'error';
      return;
    }

    if (!window.LiveData.isConfigured()) {
      showLogin();
      error.textContent = 'Firebase is not connected. In assets/js/live-config.js, set enabled to true and add your real API key and database URL.';
      error.dataset.state = 'error';
      return;
    }

    error.textContent = 'Firebase connection found. Enter your tournament password.';
    error.dataset.state = 'ready';

    if (window.LiveData.hasSession()) {
      try {
        await window.LiveData.ensureToken();
        showAdminApp();
        await initApp();
      } catch (sessionError) {
        window.LiveData.signOut();
        showLogin();
        error.textContent = 'Your previous session expired. Enter the password again.';
        error.dataset.state = 'error';
      }
    } else {
      showLogin();
      error.textContent = 'Firebase connection found. Enter your tournament password.';
      error.dataset.state = 'ready';
    }
  });
}());
