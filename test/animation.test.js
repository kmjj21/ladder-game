import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, samplePlan, animate } from '../src/animation.js';
import { generateLadder, trace } from '../src/ladder.js';
import { parseList } from '../src/editor.js';

test('쉼표·줄바꿈 입력, 공백 제거, 중복 유지', () => {
  assert.deepEqual(parseList(' 민수, 영희\r\n철수，지영\n\n'), ['민수', '영희', '철수', '지영']);
  assert.deepEqual(parseList('당번,당번, 통과'), ['당번', '당번', '통과']);
  assert.deepEqual(parseList(' , \n'), []);
});
test('애니메이션의 모든 꺾임점과 중간점이 계산된 경로 위에 존재', () => {
  for (const count of [8, 12, 20]) for (let round = 0; round < 20; round++) {
    const ladder = generateLadder(count);
    for (let i = 0; i < count; i++) for (const reverse of [false, true]) {
      const route = trace(ladder, i, reverse), plan = makePlan(route.points);
      assert.deepEqual(samplePlan(plan, 0).point, route.points[0]);
      assert.deepEqual(samplePlan(plan, 1).point, route.points.at(-1));
      for (const segment of plan.segments) {
        const p = samplePlan(plan, (segment.time + segment.weight / 2) / plan.time).point;
        assert.ok(Math.abs(p.x - (segment.a.x + segment.b.x) / 2) < 0.00001);
        assert.ok(Math.abs(p.y - (segment.a.y + segment.b.y) / 2) < 0.00001);
      }
    }
  }
});
test('실제 애니메이션 프레임 끝점, 진행률, 2.5~4초 및 동작 줄이기', async () => {
  const original = globalThis.requestAnimationFrame;
  try {
    for (const reverse of [false, true]) for (const reduced of [false, true]) {
      let time = 0, last, lastScale, previous = -1;
      globalThis.requestAnimationFrame = callback => { time += 16; queueMicrotask(() => callback(time)); };
      const route = trace(generateLadder(20), 7, reverse);
      await animate(route.points, (point, progress, _total, scale, segmentStart) => {
        assert.ok(progress >= previous); previous = progress; last = point; lastScale=scale;
        const index=route.points.indexOf(segmentStart), end=route.points[index+1];
        assert.ok(index>=0 && end);
        assert.ok(point.x>=Math.min(segmentStart.x,end.x)-1e-8 && point.x<=Math.max(segmentStart.x,end.x)+1e-8);
        assert.ok(point.y>=Math.min(segmentStart.y,end.y)-1e-8 && point.y<=Math.max(segmentStart.y,end.y)+1e-8);
        assert.ok(point.x===segmentStart.x || point.y===segmentStart.y);
      }, () => {}, reduced);
      assert.deepEqual(last, route.points.at(-1)); assert.equal(previous, 1);
      assert.equal(lastScale,1);
      assert.ok(reduced ? time < 250 : time >= 2500 && time <= 4000);
    }
  } finally { globalThis.requestAnimationFrame = original; }
});
