import { trace, COLUMN } from '../ladder.js';
import { createLayout } from '../layout.js';
import { makePlan, samplePlan } from '../animation.js';

export function snapshotResult({ ladder, rhythm, names, results, index, reverse }) {
  const copy = { count: ladder.count, rows: ladder.rows.map(row => ({ y: row.y, edges: [...row.edges] })) };
  const route = trace(copy, index, reverse);
  const layout = createLayout(copy, [...rhythm], 1920, copy.count * 84);
  const points = layout.points(route.points);
  const start = reverse ? route.end : index, end = reverse ? index : route.end;
  return {
    count: copy.count, names: [...names], results: [...results], reverse, index, start, end,
    points, column: layout.column, boardWidth: layout.width, boardHeight: layout.height,
    rows: copy.rows.map(row => ({ y: layout.point({ x: COLUMN / 2, y: row.y }).y, edges: [...row.edges] })),
    message: reverse ? results[end] + ' → ' + names[start] + '!' : names[start] + ' → ' + results[end] + '!'
  };
}

export function replayPlan(snapshot) {
  const plan = makePlan(snapshot.points);
  const movement = Math.min(3900, 2500 + plan.total * 0.35);
  return { plan, lead: 500, movement, hold: 1300, duration: 500 + movement + 1300 };
}

export function replayFrame(replay, elapsed) {
  const progress = Math.min(1, Math.max(0, (elapsed - replay.lead) / replay.movement));
  const sample = samplePlan(replay.plan, progress);
  return { ...sample, progress, arrived: elapsed >= replay.lead + replay.movement,
    arrivalTime: Math.max(0, elapsed - replay.lead - replay.movement), started: elapsed >= replay.lead };
}

export function mediaFilename(extension, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `ladder-result-${stamp}.${extension}`;
}
