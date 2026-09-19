import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLadder, trace } from '../src/ladder.js';
import { createRhythm, createLayout } from '../src/layout.js';
import { resultLabel, resultVisible } from '../src/reveal.js';
import { makePlan, samplePlan } from '../src/animation.js';

for (const count of [2, 8, 12, 20]) test(`${count}명 1,000회: 표시 좌표·양방향·숨김·중복 슬롯`, () => {
  for (let round = 0; round < 1000; round++) {
    const ladder = generateLadder(count), rhythm = createRhythm(ladder);
    const layout = createLayout(ladder, rhythm, round % 2 ? 390 : 1920, round % 2 ? 340 : 1740);
    const revealed = new Map(), results = Array.from({length:count}, (_, i) => i < 2 ? '당번' : '통과');
    let previous = 0;
    for (const row of ladder.rows) {
      const y = layout.point({x:50,y:row.y}).y;
      assert.ok(y - previous >= 6 - 1e-8); previous = y;
    }
    const endpoints = new Set();
    const gaps=ladder.rows.slice(1).map((row,i)=>layout.point({x:50,y:row.y}).y-layout.point({x:50,y:ladder.rows[i].y}).y);
    assert.ok(Math.max(...gaps)>Math.min(...gaps)*2,'밀집 구간과 여유 구간의 간격 차이 유지');
    for (let i = 0; i < count; i++) {
      assert.equal(resultLabel('forward', revealed, i, results), '?');
      assert.equal(resultLabel('reverse', revealed, i, results), results[i]);
      const forward = trace(ladder,i), reverse = trace(ladder,forward.end,true);
      const points = layout.points(forward.points); endpoints.add(forward.end);
      assert.deepEqual(layout.points(reverse.points), [...points].reverse());
      assert.deepEqual(samplePlan(makePlan(points),1).point, points.at(-1));
    }
    assert.equal(endpoints.size,count);
    const first = trace(ladder,0).end; revealed.set(0,first);
    for (let i = 0; i < count; i++) assert.equal(resultVisible('forward',revealed,i), i === first);
    // Toggling visibility cannot mutate the ladder or identify slots by duplicate text.
    const before = JSON.stringify(ladder);
    results.forEach((_,i) => resultLabel('reverse',revealed,i,results));
    assert.equal(JSON.stringify(ladder),before);
  }
});
test('1920 PC는 20열 전체, 스마트폰은 100px 열 유지', () => {
  const ladder = generateLadder(20), rhythm = createRhythm(ladder);
  const wide = createLayout(ladder,rhythm,1920,1740), phone = createLayout(ladder,rhythm,390,340);
  assert.ok(wide.width <= 1740); assert.equal(wide.height,420);
  assert.equal(phone.width,2000); assert.equal(phone.column,100); assert.equal(phone.height,360);
  assert.notDeepEqual(ladder.rows.slice(1).map((row,i)=>wide.point({x:50,y:row.y}).y-wide.point({x:50,y:ladder.rows[i].y}).y), Array(41).fill(10));
});
