import { generateLadder, trace, HEIGHT } from './ladder.js';
import { createRhythm } from './layout.js';

// Slot identity is the original input index, even when labels are identical.
export function shuffleSlots(results, random = Math.random) {
  const order = results.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
export const slotLabels = game => game.resultOrder.map(index => game.inputResults[index]);
export function createGame(names, inputResults, random = Math.random) {
  const ladder = generateLadder(names.length, random);
  return { version: 1, names: [...names], inputResults: [...inputResults],
    resultOrder: shuffleSlots(inputResults, random), ladder, rhythm: createRhythm(ladder, random), revealed: [], lastRoute: null };
}

// Saved games are untrusted: reject malformed geometry rather than repairing connections.
export function restoreGame(value, names, inputResults) {
  try {
    const n = names.length, same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
    const index = v => Number.isInteger(v) && v >= 0 && v < n;
    if (!value || value.version !== 1 || n < 2 || n > 20 || inputResults.length !== n ||
      !names.every(s => typeof s === 'string' && s.trim()) || !inputResults.every(s => typeof s === 'string' && s.trim()) ||
      !same(value.names, names) || !same(value.inputResults, inputResults)) return null;
    const { ladder, rhythm, resultOrder, revealed, lastRoute } = value;
    if (!Array.isArray(resultOrder) || resultOrder.length !== n || !resultOrder.every(index) || new Set(resultOrder).size !== n) return null;
    if (!ladder || ladder.count !== n || !Array.isArray(ladder.rows) || ladder.rows.length < 2 || ladder.rows.length > 48) return null;
    let previousY = 0;
    for (const row of ladder.rows) {
      if (!row || !Number.isFinite(row.y) || row.y <= previousY || row.y >= HEIGHT || !Array.isArray(row.edges)) return null;
      if (!row.edges.every((edge, i) => Number.isInteger(edge) && edge >= 0 && edge < n - 1 && (!i || edge > row.edges[i - 1] + 1))) return null;
      previousY = row.y;
    }
    if (!Array.isArray(rhythm) || rhythm.length !== ladder.rows.length - 1 || !rhythm.every(v => Number.isFinite(v) && v > 0 && v <= 3)) return null;
    if (!Array.isArray(revealed) || revealed.length > n || new Set(revealed.map(pair => pair?.[0])).size !== revealed.length ||
      !revealed.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(index) && trace(ladder, pair[0]).end === pair[1])) return null;
    if (lastRoute !== null) {
      if (!lastRoute || !index(lastRoute.index) || typeof lastRoute.reverse !== 'boolean') return null;
      const end = trace(ladder, lastRoute.index, lastRoute.reverse).end;
      if (!revealed.some(([a, b]) => a === (lastRoute.reverse ? end : lastRoute.index) && b === (lastRoute.reverse ? lastRoute.index : end))) return null;
    }
    return JSON.parse(JSON.stringify(value));
  } catch { return null; }
}
