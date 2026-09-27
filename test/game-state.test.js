import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, restoreGame, shuffleSlots, slotLabels } from '../src/game-state.js';
import { trace } from '../src/ladder.js';
import { snapshotResult, replayPlan, replayFrame } from '../src/export/model.js';
import { read, save } from '../src/storage.js';

for (const count of [2, 8, 12, 20]) test(`${count}명 2,000회: 셔플 슬롯·중복·양방향·export·저장 복구`, () => {
  const names = Array.from({length: count}, (_, i) => `참가자${i}`), inputResults = names.map((_, i) => i % 3 ? '통과' : '당번');
  const original = JSON.stringify(inputResults);
  for (let round = 0; round < 2000; round++) {
    const game = createGame(names, inputResults), results = slotLabels(game), before = JSON.stringify(game);
    assert.equal(game.resultOrder.length, count); assert.equal(new Set(game.resultOrder).size, count);
    assert.deepEqual([...results].sort(), [...inputResults].sort());
    for (let start = 0; start < count; start++) {
      const end = trace(game.ladder, start).end;
      assert.equal(trace(game.ladder, end, true).end, start);
      assert.equal(results[end], inputResults[game.resultOrder[end]]);
    }
    assert.equal(JSON.stringify(game), before); assert.equal(JSON.stringify(inputResults), original);
    const index = round % count, reverse = !!(round % 2), end = trace(game.ladder, index, reverse).end;
    game.lastRoute = { index, reverse }; game.revealed = [reverse ? [end,index] : [index,end]];
    const restored = restoreGame(JSON.parse(JSON.stringify(game)), names, inputResults);
    assert.deepEqual(restored, game);
    if (round % 100 === 0) for (const reverse of [false,true]) {
      const snapshot = snapshotResult({ ...game, results, index, reverse }), plan = replayPlan(snapshot);
      assert.equal(snapshot.results[snapshot.end], inputResults[game.resultOrder[snapshot.end]]);
      assert.equal(snapshot.start, reverse ? trace(game.ladder,index,true).end : index);
      assert.deepEqual(replayFrame(plan,plan.duration).point, snapshot.points.at(-1));
    }
  }
});

test('Fisher-Yates는 입력을 보존하고 인덱스별 중복 슬롯을 유지', () => {
  const values = ['통과','통과','술래','간식'];
  assert.deepEqual(shuffleSlots(values, () => 0), [1,2,3,0]);
  assert.deepEqual(values, ['통과','통과','술래','간식']);
  const orders = new Set(), ladders = new Set();
  for (let i=0;i<30;i++) { const game=createGame(['가','나','다','라'],values); orders.add(JSON.stringify(game.resultOrder)); ladders.add(JSON.stringify(game.ladder)); }
  assert.ok(orders.size>1); assert.ok(ladders.size>1);
});

test('localStorage 왕복은 배치·경로·진행·소리와 입력 원본을 보존', () => {
  const previous=globalThis.localStorage; let stored;
  globalThis.localStorage={setItem:(_,v)=>{stored=v;},getItem:()=>stored};
  try {
    const names=['가','나'],results=['당번','통과'],game=createGame(names,results);
    game.revealed=[[0,trace(game.ladder,0).end]];game.lastRoute={index:0,reverse:false};
    for(const sound of [true,false]) {
      assert.equal(save({names,results,sound,game}),true);
      const cached=read();assert.equal(cached.sound,sound);assert.deepEqual(cached.results,results);
      assert.deepEqual(restoreGame(cached.game,names,results),game);
    }
  } finally {globalThis.localStorage=previous;}
});

test('손상되거나 현재 입력과 다른 저장 게임은 복구하지 않음', () => {
  const names=['가','나','다'],results=['통과','통과','술래'],game=createGame(names,results);
  for(const corrupt of [g=>g.resultOrder=[0,0,2],g=>g.ladder.rows[0].edges=[0,1],g=>g.rhythm[0]=0,g=>g.ladder.rows[0].y=-1,g=>g.revealed=[[0,99]],g=>g.lastRoute={index:2,reverse:true},g=>g.names[0]='다른 이름']) {
    const saved=structuredClone(game);corrupt(saved);assert.equal(restoreGame(saved,names,results),null);
  }
  assert.equal(restoreGame(null,names,results),null);
  assert.equal(restoreGame(game,names,['다른 결과','통과','술래']),null);
  const restored=restoreGame(game,names,results);restored.resultOrder.reverse();assert.notDeepEqual(restored.resultOrder,game.resultOrder);
});
