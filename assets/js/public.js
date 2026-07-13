(function () {
  'use strict';

  let currentData = null;
  const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';

  function playerRow(player, match, side) {
    const isWinner = Boolean(match.winner && player && match.winner.id === player.id);
    const score = match.result ? match.result[side === 'a' ? 'scoreA' : 'scoreB'] : '';
    const emptyLabel = match.state === 'bye' ? 'BYE' : 'To be decided';

    if (!player) {
      return `
        <div class="match-player match-player--empty">
          <span class="match-player__flag">—</span>
          <span class="match-player__identity">
            <span class="match-player__name">${emptyLabel}</span>
            <span class="match-player__nation">${match.state === 'bye' ? 'Automatic opening-round advance' : 'Waiting for result'}</span>
          </span>
          <span class="match-player__score">–</span>
        </div>`;
    }

    return `
      <div class="match-player${isWinner ? ' is-winner' : ''}">
        <span class="match-player__flag" aria-hidden="true">${Tournament.escapeHTML(player.flag)}</span>
        <span class="match-player__identity">
          <span class="match-player__name">${Tournament.escapeHTML(player.name)}</span>
          <span class="match-player__nation">${Tournament.escapeHTML(player.nation)}</span>
        </span>
        <span class="match-player__score">${score === '' ? '–' : score}</span>
      </div>`;
  }

  function matchScheduleMarkup(match) {
    const date = Tournament.formatScheduleDate(match.schedule, { compact: true });
    const time = Tournament.formatScheduleTime(match.schedule);
    const table = match.schedule?.table || '';
    if (!date && !time && !table) return '';

    return `
      <div class="match-card__slot">
        <span>${Tournament.escapeHTML([date, time].filter(Boolean).join(' · '))}</span>
        ${table ? `<strong>${Tournament.escapeHTML(table)}</strong>` : ''}
      </div>`;
  }

  function renderMatch(match, roundIndex) {
    const stateLabel = {
      complete: 'Final',
      ready: 'Ready',
      bye: 'Opening bye',
      waiting: 'Pending'
    }[match.state];

    return `
      <article class="match-card match-card--${match.state}" aria-label="Match ${match.number}">
        <div class="match-card__meta">
          <span>${roundIndex === 0 ? `Match ${String(match.number).padStart(2, '0')}` : `Tie ${String(match.number).padStart(2, '0')}`}</span>
          <span class="match-state">${stateLabel}</span>
        </div>
        <div class="match-card__players">
          ${playerRow(match.playerA, match, 'a')}
          ${playerRow(match.playerB, match, 'b')}
        </div>
        ${matchScheduleMarkup(match)}
      </article>`;
  }

  function renderBracket(bracket) {
    const bracketElement = document.querySelector('[data-bracket]');
    bracketElement.innerHTML = bracket.rounds.map((round) => `
      <section class="bracket-round" aria-labelledby="round-${round.index}">
        <header class="bracket-round__header">
          <span class="bracket-round__number">0${round.index + 1}</span>
          <div>
            <h3 id="round-${round.index}">${round.name}</h3>
            <p>${round.matches.length} ${round.matches.length === 1 ? 'match' : 'matches'}</p>
          </div>
        </header>
        <div class="bracket-round__matches" style="--match-count:${round.matches.length}">
          ${round.matches.map((match) => renderMatch(match, round.index)).join('')}
        </div>
      </section>`).join('');
  }

  function renderSchedule(bracket) {
    const container = document.querySelector('[data-public-schedule]');
    const scheduled = bracket.rounds.flatMap((round) => round.matches
      .filter((match) => match.state !== 'bye' && (match.schedule?.date || match.schedule?.time || match.schedule?.table))
      .map((match) => ({ ...match, roundName: round.name })));

    scheduled.sort((a, b) => {
      const aDate = Tournament.dateFromSlot(a.schedule)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = Tournament.dateFromSlot(b.schedule)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate || a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex;
    });

    if (!scheduled.length) {
      container.innerHTML = `
        <div class="schedule-empty">
          <span>Schedule pending</span>
          <h3>Match dates have not been published yet.</h3>
          <p>The tournament organizer can generate and edit every slot from the control room.</p>
        </div>`;
      return;
    }

    const groups = new Map();
    scheduled.forEach((match) => {
      const groupKey = match.schedule.date || 'Time to be confirmed';
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(match);
    });

    container.innerHTML = [...groups.entries()].map(([dateKey, matches]) => {
      const heading = dateKey === 'Time to be confirmed'
        ? dateKey
        : Tournament.formatScheduleDate(matches[0].schedule);
      return `
        <section class="schedule-day">
          <header class="schedule-day__header">
            <span>${Tournament.escapeHTML(heading)}</span>
            <strong>${matches.length} ${matches.length === 1 ? 'match' : 'matches'}</strong>
          </header>
          <div class="schedule-day__matches">
            ${matches.map((match) => {
              const playerA = match.playerA?.name || 'TBD';
              const playerB = match.playerB?.name || 'TBD';
              return `
                <article class="schedule-row">
                  <time>${Tournament.escapeHTML(Tournament.formatScheduleTime(match.schedule) || 'TBD')}</time>
                  <div>
                    <span>${Tournament.escapeHTML(match.roundName)} · Match ${String(match.number).padStart(2, '0')}</span>
                    <strong>${Tournament.escapeHTML(playerA)} <em>vs</em> ${Tournament.escapeHTML(playerB)}</strong>
                  </div>
                  <small>${Tournament.escapeHTML(match.schedule.table || 'Table TBD')}</small>
                </article>`;
            }).join('')}
          </div>
        </section>`;
    }).join('');
  }

  function renderPlayers(data, bracket) {
    const completedWins = new Map();
    bracket.rounds.forEach((round) => {
      round.matches.forEach((match) => {
        if (match.winner && match.state === 'complete') {
          completedWins.set(match.winner.id, (completedWins.get(match.winner.id) || 0) + 1);
        }
      });
    });

    const table = document.querySelector('[data-player-list]');
    table.innerHTML = data.players.map((player, index) => `
      <div class="roster-row">
        <span class="roster-row__seed">${String(index + 1).padStart(2, '0')}</span>
        <span class="roster-row__flag" aria-hidden="true">${Tournament.escapeHTML(player.flag)}</span>
        <span class="roster-row__player">${Tournament.escapeHTML(player.name)}</span>
        <span class="roster-row__nation">${Tournament.escapeHTML(player.nation)}</span>
        <span class="roster-row__wins">${completedWins.get(player.id) || 0}W</span>
      </div>`).join('');
  }

  function renderChampion(bracket) {
    const championCard = document.querySelector('[data-champion-card]');
    if (!bracket.champion) {
      championCard.innerHTML = `
        <span class="champion-card__kicker">The final word</span>
        <div class="champion-card__empty-mark">?</div>
        <h3>Champion pending</h3>
        <p>The title is still on the table. Results will appear here as the bracket advances.</p>`;
      championCard.classList.remove('has-champion');
      return;
    }

    championCard.classList.add('has-champion');
    championCard.innerHTML = `
      <span class="champion-card__kicker">Nations Cup champion</span>
      <div class="champion-card__flag" aria-hidden="true">${Tournament.escapeHTML(bracket.champion.flag)}</div>
      <h3>${Tournament.escapeHTML(bracket.champion.name)}</h3>
      <p>${Tournament.escapeHTML(bracket.champion.nation)} takes the table and the title.</p>`;
  }

  function renderHeader(data, bracket) {
    document.title = `${data.settings.title} — Foosball Tournament`;
    document.querySelectorAll('[data-title]').forEach((element) => { element.textContent = data.settings.title; });
    const titleWords = String(data.settings.title || 'Nations Cup').trim().split(/\s+/);
    const heroTitle = document.querySelector('[data-hero-title]');
    const secondLine = titleWords.length > 1 ? titleWords.pop() : '';
    if (heroTitle) {
      heroTitle.innerHTML = `<span>${Tournament.escapeHTML(titleWords.join(' ') || data.settings.title)}</span>${secondLine ? `<span>${Tournament.escapeHTML(secondLine)}</span>` : ''}`;
    }
    document.querySelector('[data-eyebrow]').textContent = data.settings.eyebrow;
    document.querySelector('[data-subtitle]').textContent = data.settings.subtitle;
    document.querySelector('[data-event-date]').textContent = data.settings.date;
    document.querySelector('[data-event-location]').textContent = data.settings.location;
    document.querySelector('[data-event-status]').textContent = data.settings.status;
    document.querySelectorAll('[data-player-count]').forEach((element) => { element.textContent = data.players.length; });
    document.querySelectorAll('[data-hero-player-count]').forEach((element) => { element.textContent = data.players.length; });
    const confirmedNations = new Set(data.players
      .map((player) => player.nation)
      .filter((nation) => nation && !/tbd/i.test(nation)));
    document.querySelector('[data-nation-count]').textContent = confirmedNations.size;
    document.querySelector('[data-bye-count]').textContent = bracket.byeCount;
    document.querySelector('[data-updated]').textContent = Tournament.formatUpdatedAt(data.settings.updatedAt);
  }

  function render(data) {
    currentData = data;
    const bracket = Tournament.deriveBracket(data);
    renderHeader(data, bracket);
    renderBracket(bracket);
    renderSchedule(bracket);
    renderPlayers(data, bracket);
    renderChampion(bracket);
  }

  async function refresh() {
    const data = await Tournament.loadData({ preview: previewMode });
    if (JSON.stringify(data) !== JSON.stringify(currentData)) render(data);
  }

  function initNavigation() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const navigation = document.querySelector('[data-navigation]');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      navigation.classList.toggle('is-open', !open);
    });
    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      navigation.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  function initBracketControls() {
    const bracket = document.querySelector('[data-bracket]');
    document.querySelector('[data-scroll-left]').addEventListener('click', () => {
      bracket.scrollBy({ left: -380, behavior: 'smooth' });
    });
    document.querySelector('[data-scroll-right]').addEventListener('click', () => {
      bracket.scrollBy({ left: 380, behavior: 'smooth' });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initBracketControls();
    await refresh();
    if (!previewMode) window.setInterval(refresh, 30000);
  });
}());
