import { COLUMN, HEIGHT } from './ladder.js';

// Presentation-only rhythm. Row order and all endpoint connections remain unchanged.
export function createRhythm(ladder, random = Math.random) {
  let closeGaps = random() < 0.5 ? 1 : 2;
  return ladder.rows.slice(1).map(() => {
    if (closeGaps-- > 0) return 0.05 + random() * 0.15;
    closeGaps = random() < 0.5 ? 1 : 2;
    return 1 + random() * 2;
  });
}
export function createLayout(ladder, rhythm, viewportWidth, availableWidth) {
  const mobile = viewportWidth < 700;
  const column = viewportWidth >= 1280 ? Math.max(64, Math.min(90, Math.floor(availableWidth / ladder.count))) : mobile ? 100 : 90;
  const height = mobile ? 360 : 420;
  const yMap = new Map([[0, 0], [HEIGHT, height]]);
  const total = rhythm.reduce((a, b) => a + b, 0), spare = height - 28 - (ladder.rows.length - 1) * 6;
  let sum = 0;
  ladder.rows.forEach((row, index) => {
    if (index) sum += rhythm[index - 1];
    yMap.set(row.y, 14 + index * 6 + spare * sum / total);
  });
  const point = p => ({ x: p.x / COLUMN * column, y: yMap.get(p.y) });
  return { column, height, width: column * ladder.count, point, points: points => points.map(point) };
}
