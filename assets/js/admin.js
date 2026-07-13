(function () {
  'use strict';

  const REPO_SETTINGS_KEY = 'nations-cup-github-settings-v1';
  const TOKEN_SESSION_KEY = 'nations-cup-github-token-session';
  const TOKEN_LOCAL_KEY = 'nations-cup-github-token-local';
  let workingData = null;
  let dirty = false;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function markDirty(message = 'Changes saved to this browser preview.') {
    dirty = true;
    workingData.settings.updatedAt = new Date().toISOString();
    Tournament.savePreview(workingData);
    setStatus(message, 'success');
    renderSummary();
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
    markDirty('Match date and time slots saved to the browser preview.');
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
    markDirty('A complete tournament timetable was generated. Review the individual slots before publishing.');
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
    markDirty(`${scoreA > scoreB ? match.playerA.name : match.playerB.name} advances. Preview updated.`);
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
    markDirty('Event details updated in the browser preview.');
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
    resetResultsForDrawChange('Player added. Complete their details before publishing.');
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

  function loadRepoSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(REPO_SETTINGS_KEY) || '{}'); } catch (error) { saved = {}; }
    qs('#github-owner').value = saved.owner || '';
    qs('#github-repo').value = saved.repo || '';
    qs('#github-branch').value = saved.branch || 'main';
    qs('#github-path').value = saved.path || 'tournament-data.json';
    const rememberedToken = localStorage.getItem(TOKEN_LOCAL_KEY);
    const sessionToken = sessionStorage.getItem(TOKEN_SESSION_KEY);
    qs('#github-token').value = rememberedToken || sessionToken || '';
    qs('#remember-token').checked = Boolean(rememberedToken);
  }

  function storeRepoSettings() {
    const settings = {
      owner: qs('#github-owner').value.trim(),
      repo: qs('#github-repo').value.trim(),
      branch: qs('#github-branch').value.trim() || 'main',
      path: qs('#github-path').value.trim() || 'tournament-data.json'
    };
    localStorage.setItem(REPO_SETTINGS_KEY, JSON.stringify(settings));
    const token = qs('#github-token').value.trim();
    sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    if (qs('#remember-token').checked) localStorage.setItem(TOKEN_LOCAL_KEY, token);
    else localStorage.removeItem(TOKEN_LOCAL_KEY);
    return { ...settings, token };
  }

  async function publishToGitHub() {
    const buttons = qsa('[data-publish]');
    const config = storeRepoSettings();
    if (!config.owner || !config.repo || !config.token) {
      setStatus('Add the repository owner, repository name, and a GitHub token first.', 'error');
      return;
    }

    buttons.forEach((button) => {
      button.disabled = true;
      button.textContent = 'Publishing…';
    });
    setStatus('Connecting to GitHub…', 'neutral');

    try {
      syncPlayersFromEditor();
      syncScheduleFromEditor();
      workingData.settings.updatedAt = new Date().toISOString();
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config.branch)}`;
      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      };

      let sha;
      const existingResponse = await fetch(apiUrl, { headers });
      if (existingResponse.ok) {
        const existing = await existingResponse.json();
        sha = existing.sha;
      } else if (existingResponse.status !== 404) {
        const errorBody = await existingResponse.json().catch(() => ({}));
        throw new Error(errorBody.message || `GitHub returned ${existingResponse.status}`);
      }

      const updateUrl = apiUrl.split('?')[0];
      const payload = {
        message: `Update tournament results — ${new Date().toLocaleString()}`,
        content: Tournament.toBase64(`${JSON.stringify(workingData, null, 2)}\n`),
        branch: config.branch
      };
      if (sha) payload.sha = sha;

      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responseBody = await updateResponse.json().catch(() => ({}));
      if (!updateResponse.ok) throw new Error(responseBody.message || `Publish failed with ${updateResponse.status}`);

      dirty = false;
      Tournament.savePreview(workingData);
      setStatus('Published. GitHub Pages will serve the new results after its next site refresh.', 'success');
      renderSummary();
    } catch (error) {
      setStatus(`Publish failed: ${error.message}`, 'error');
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
        button.textContent = 'Publish live results';
      });
    }
  }

  function downloadData() {
    syncPlayersFromEditor();
    syncScheduleFromEditor();
    workingData.settings.updatedAt = new Date().toISOString();
    const blob = new Blob([`${JSON.stringify(workingData, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tournament-data.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus('Downloaded tournament-data.json. Replace the file in your repository to publish manually.', 'success');
  }

  function resetPreview() {
    Tournament.clearPreview();
    workingData = Tournament.normalizeData(Tournament.FALLBACK_DATA);
    dirty = false;
    Tournament.savePreview(workingData);
    renderAll();
    setStatus('Tournament reset to the original 13-player draw with three opening-round byes and no later byes.', 'success');
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

  document.addEventListener('DOMContentLoaded', async () => {
    workingData = await Tournament.loadData({ preview: true });
    Tournament.savePreview(workingData);
    initTabs();
    loadRepoSettings();
    renderAll();

    qs('[data-event-form]')?.addEventListener('submit', saveEventSettings);
    qs('[data-schedule-generator]')?.addEventListener('submit', generateSchedule);
    qs('[data-save-schedule]')?.addEventListener('click', saveSchedule);
    qs('[data-add-player]').addEventListener('click', addPlayer);
    qs('[data-save-players]').addEventListener('click', savePlayers);
    qs('[data-shuffle]').addEventListener('click', shuffleDraw);
    qsa('[data-publish]').forEach((button) => button.addEventListener('click', publishToGitHub));
    qs('[data-download]').addEventListener('click', downloadData);
    qs('[data-reset]').addEventListener('click', resetPreview);

    window.addEventListener('beforeunload', (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  });
}());
