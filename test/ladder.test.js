import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLadder, trace, COLUMN, HEIGHT } from '../src/ladder.js';
for (const count of [2, 8, 12, 20]) test(`${count}명: 2,000회 생성, 일대일 대응, 역방향과 경로 일치`, () => {
  for (let iteration = 0; iteration < 2000; iteration++) {
    const ladder = generateLadder(count), ends = [];
    for (const row of ladder.rows) {
      assert.equal(new Set(row.edges.flatMap(e => [e, e + 1])).size, row.edges.length * 2);
      assert.ok(row.edges.every(e => e >= 0 && e < count - 1));
    }
    for (let start = 0; start < count; start++) {
      const forward = trace(ladder, start), backward = trace(ladder, forward.end, true);
      ends.push(forward.end); assert.equal(backward.end, start);
      assert.deepEqual(backward.points, [...forward.points].reverse());
      assert.deepEqual(forward.points.at(-1), { x: forward.end * COLUMN + COLUMN / 2, y: HEIGHT });
      for (let p = 1; p < forward.points.length; p++) {
        const a = forward.points[p - 1], b = forward.points[p];
        assert.ok(a.x === b.x || a.y === b.y); assert.ok(b.y >= a.y);
      }
    }
    assert.equal(new Set(ends).size, count);
  }
});
test('입력 범위 검증', () => { for (const n of [0, 1, 21, 2.5]) assert.throws(() => generateLadder(n)); });
test('다시 생성할 때 구조 변경', () => { const structures = new Set(Array.from({ length: 100 }, () => JSON.stringify(generateLadder(20)))); assert.equal(structures.size, 100); });

test('인원별 밀도와 재섞기 연결 다양성: 각 2,000회', t => {
  let seed=20260917;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const count of [2,8,12,20]) {
    const mappings=new Set(), histogram=Array.from({length:count},()=>Array(count).fill(0));
    let rungs=0;
    for(let i=0;i<2000;i++) {
      const ladder=generateLadder(count,random), mapping=[];
      rungs+=ladder.rows.reduce((sum,row)=>sum+row.edges.length,0);
      assert.equal(ladder.rows.length,Math.round(Math.min(48,16+count*2)*0.75));
      for(let start=0;start<count;start++) {const end=trace(ladder,start).end;histogram[start][end]++;mapping.push(end);}
      mappings.add(mapping.join(','));
    }
    assert.ok(mappings.size>=(count===2?2:100));
    for(const frequencies of histogram) assert.ok(Math.max(...frequencies)<1400,'한 결과에 70% 이상 고정되지 않음');
    const expected=[0,0.52];
    for(let slots=2;slots<count;slots++) expected[slots]=0.52*(1+expected[slots-2])+0.48*expected[slots-1];
    const baseline=Math.min(48,16+count*2)*expected[count-1], ratio=rungs/2000/baseline;
    assert.ok(ratio>=0.70 && ratio<=0.80);
    t.diagnostic(`${count}명: 가로선 평균 ${(rungs/2000).toFixed(1)}개, 기존 기대값 대비 ${((1-ratio)*100).toFixed(1)}% 감소`);
  }
});
