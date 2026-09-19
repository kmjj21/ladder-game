export const COLUMN = 100;
export const HEIGHT = 510;
export function generateLadder(count, random = Math.random) {
  if (!Number.isInteger(count) || count < 2 || count > 20) throw new RangeError('참가자는 2~20명이어야 합니다.');
  const rows = [];
  const rowCount = Math.round(Math.min(48, 16 + count * 2) * 0.75);
  for (let row = 0; row < rowCount; row++) {
    const edges = [];
    for (let col = 0; col < count - 1; col++) {
      if (random() < 0.52) { edges.push(col); col++; }
    }
    rows.push({ y: 16 + row * (HEIGHT - 32) / (rowCount - 1), edges });
  }
  return { count, rows };
}
export function trace(ladder, index, reverse = false) {
  if (!Number.isInteger(index) || index < 0 || index >= ladder.count) throw new RangeError('잘못된 출발점');
  let col = index;
  const x = c => c * COLUMN + COLUMN / 2;
  const points = [{ x: x(col), y: reverse ? HEIGHT : 0 }];
  for (const row of reverse ? [...ladder.rows].reverse() : ladder.rows) {
    points.push({ x: x(col), y: row.y });
    const edge = row.edges.find(e => e === col || e + 1 === col);
    if (edge !== undefined) {
      col = col === edge ? col + 1 : col - 1;
      points.push({ x: x(col), y: row.y });
    }
  }
  points.push({ x: x(col), y: reverse ? 0 : HEIGHT });
  return { end: col, points };
}
export const pathData = points => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
