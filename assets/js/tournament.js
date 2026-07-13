(function () {
  'use strict';

  const STORAGE_KEY = 'nations-cup-preview-data-v3';

  const FALLBACK_DATA = {
    version: 3,
    settings: {
      title: 'Nations Cup',
      eyebrow: 'Office Foosball Tournament',
      subtitle: 'One table. Thirteen players. Twelve nations. One champion.',
      date: 'Tournament Day',
      location: 'Tournament HQ',
      status: 'Draw confirmed',
      updatedAt: null
    },
    players: [
      { id: 'ethan', seed: 1, name: 'Ethan', nation: 'Germany', flag: '🇩🇪' },
      { id: 'akeefah', seed: 2, name: 'Akeefah', nation: 'Morocco', flag: '🇲🇦' },
      { id: 'hugh', seed: 3, name: 'Hugh', nation: 'England', flag: '🇬🇧' },
      { id: 'z', seed: 4, name: 'Z', nation: 'Egypt', flag: '🇪🇬' },
      { id: 'caleb', seed: 5, name: 'Caleb', nation: 'South Korea', flag: '🇰🇷' },
      { id: 'roman', seed: 6, name: 'Roman', nation: 'Colombia', flag: '🇨🇴' },
      { id: 'peter', seed: 7, name: 'Peter', nation: 'Japan', flag: '🇯🇵' },
      { id: 'cortez', seed: 8, name: 'Cortez', nation: 'United States', flag: '🇺🇸' },
      { id: 'dave', seed: 9, name: 'Dave', nation: 'United States', flag: '🇺🇸' },
      { id: 'elizabeth', seed: 10, name: 'Elizabeth', nation: 'Spain', flag: '🇪🇸' },
      { id: 'kevin', seed: 11, name: 'Kevin', nation: 'Norway', flag: '🇳🇴' },
      { id: 'maureen', seed: 12, name: 'Maureen', nation: 'Argentina', flag: '🇦🇷' },
      { id: 'kyle', seed: 13, name: 'Kyle', nation: 'Netherlands', flag: '🇳🇱' }
    ],
    results: {},
    schedule: {}
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function slugify(value) {
    return String(value || 'player')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `player-${Date.now()}`;
  }

  function nextPowerOfTwo(number) {
    let power = 2;
    while (power < number) power *= 2;
    return power;
  }

  function seedOrder(size) {
    if (size <= 2) return [1, 2];
    let order = [1, 2];
    for (let current = 4; current <= size; current *= 2) {
      const next = [];
      order.forEach((seed) => {
        next.push(seed, current + 1 - seed);
      });
      order = next;
    }
    return order;
  }

  function roundName(roundIndex, totalRounds) {
    const remaining = totalRounds - roundIndex;
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinals';
    if (remaining === 3) return 'Quarterfinals';
    if (remaining === 4) return 'Round of 16';
    return `Round ${roundIndex + 1}`;
  }

  function normalizeSchedule(schedule) {
    if (!schedule || typeof schedule !== 'object') return {};
    return Object.fromEntries(Object.entries(schedule).map(([key, slot]) => [key, {
      date: String(slot?.date || ''),
      time: String(slot?.time || ''),
      table: String(slot?.table || '')
    }]));
  }

  function normalizeData(input) {
    const data = clone(input || FALLBACK_DATA);
    data.version = 3;
    data.settings = { ...clone(FALLBACK_DATA.settings), ...(data.settings || {}) };
    data.players = Array.isArray(data.players) ? data.players : clone(FALLBACK_DATA.players);
    data.players = data.players.map((player, index) => ({
      id: player.id || slugify(player.name || `Player ${index + 1}`),
      seed: Number(player.seed) || index + 1,
      name: player.name || `Player ${index + 1}`,
      nation: player.nation || 'Nation TBD',
      flag: player.flag || '🌐'
    })).sort((a, b) => a.seed - b.seed);
    data.results = data.results && typeof data.results === 'object' ? data.results : {};
    data.schedule = normalizeSchedule(data.schedule);
    return data;
  }

  function deriveBracket(input) {
    const data = normalizeData(input);
    const playerCount = data.players.length;
    const slotCount = nextPowerOfTwo(Math.max(playerCount, 2));
    const totalRounds = Math.log2(slotCount);
    const playersBySeed = new Map(data.players.map((player) => [player.seed, player]));
    const firstRoundSlots = seedOrder(slotCount).map((seed) => playersBySeed.get(seed) || null);
    const rounds = [];
    const invalidResultKeys = [];
    let participants = firstRoundSlots;

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
      const matchCount = participants.length / 2;
      const matches = [];
      const winners = [];

      for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
        const playerA = participants[matchIndex * 2] || null;
        const playerB = participants[(matchIndex * 2) + 1] || null;
        const key = `r${roundIndex + 1}m${matchIndex + 1}`;
        const storedResult = data.results[key];
        let result = null;
        let winner = null;
        let state = 'waiting';

        // Structural byes exist only in the opening round. A missing player in
        // later rounds means an earlier match is unfinished, never a free pass.
        if (roundIndex === 0 && playerA && !playerB) {
          winner = playerA;
          state = 'bye';
        } else if (roundIndex === 0 && !playerA && playerB) {
          winner = playerB;
          state = 'bye';
        } else if (playerA && playerB) {
          state = 'ready';
          if (storedResult) {
            const participantsMatch = storedResult.playerAId === playerA.id && storedResult.playerBId === playerB.id;
            const scoreA = Number(storedResult.scoreA);
            const scoreB = Number(storedResult.scoreB);
            const scoresValid = Number.isFinite(scoreA) && Number.isFinite(scoreB) && scoreA >= 0 && scoreB >= 0 && scoreA !== scoreB;

            if (participantsMatch && scoresValid) {
              result = { ...storedResult, scoreA, scoreB };
              winner = scoreA > scoreB ? playerA : playerB;
              state = 'complete';
            } else {
              invalidResultKeys.push(key);
            }
          }
        }

        matches.push({
          key,
          roundIndex,
          matchIndex,
          number: matchIndex + 1,
          playerA,
          playerB,
          result,
          winner,
          state,
          schedule: data.schedule[key] || { date: '', time: '', table: '' }
        });
        winners.push(winner);
      }

      rounds.push({
        index: roundIndex,
        name: roundName(roundIndex, totalRounds),
        matches
      });
      participants = winners;
    }

    const finalMatch = rounds.at(-1)?.matches[0] || null;
    return {
      data,
      rounds,
      champion: finalMatch?.winner || null,
      slotCount,
      byeCount: slotCount - playerCount,
      invalidResultKeys
    };
  }

  async function loadData(options = {}) {
    const useLocalData = options.useLocal !== false;
    if (useLocalData) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return normalizeData(JSON.parse(saved));
        } catch (error) {
          console.warn('Could not read saved tournament data.', error);
        }
      }
    }

    try {
      const response = await fetch(`tournament-data.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
      return normalizeData(await response.json());
    } catch (error) {
      console.warn('Using built-in tournament data.', error);
      return normalizeData(FALLBACK_DATA);
    }
  }

  function savePreview(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
  }

  function clearPreview() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function formatUpdatedAt(value) {
    if (!value) return 'Awaiting first result';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function dateFromSlot(slot) {
    if (!slot?.date) return null;
    const time = slot.time || '12:00';
    const date = new Date(`${slot.date}T${time}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatScheduleDate(slot, options = {}) {
    const date = dateFromSlot(slot);
    if (!date) return '';
    return new Intl.DateTimeFormat(undefined, options.compact
      ? { month: 'short', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }

  function formatScheduleTime(slot) {
    const date = dateFromSlot(slot);
    if (!date || !slot?.time) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function toBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  window.Tournament = {
    STORAGE_KEY,
    FALLBACK_DATA,
    clone,
    escapeHTML,
    slugify,
    normalizeData,
    deriveBracket,
    loadData,
    savePreview,
    clearPreview,
    formatUpdatedAt,
    formatScheduleDate,
    formatScheduleTime,
    dateFromSlot,
    toBase64
  };
}());
