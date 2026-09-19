import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateInputs, planChange, inputProblem, parseList } from '../src/input-state.js';
import { read, save } from '../src/storage.js';
const initial = (n = 10) => ({ names: Array.from({length:n},(_,i)=>'이름 '+(i+1)), results:Array.from({length:n},(_,i)=>'결과 '+(i+1)) });
for (const side of ['names','results']) {
  const other = side === 'names' ? 'results' : 'names';
  test(side + ': 중간 항목 삭제는 반대편 마지막 항목만 제거', () => {
    const state = initial(), snapshot = JSON.stringify(state), values = [...state[side]]; values.splice(6,1);
    const plan = planChange(state,side,values,'delete');
    assert.equal(plan.state.names.length,9); assert.equal(plan.state.results.length,9);
    assert.deepEqual(plan.state[side],values); assert.deepEqual(plan.state[other],state[other].slice(0,9));
    assert.equal(plan.needsConfirm,true); assert.equal(JSON.stringify(state),snapshot);
  });
  test(side + ': 추가는 양쪽 빈 슬롯을 추가하고 기존 데이터를 보존', () => {
    const state=initial(), plan=planChange(state,side,[...state[side],''],'add');
    assert.equal(plan.state[other].length,11); assert.equal(plan.state[other][10],'');
    assert.deepEqual(plan.state[other].slice(0,10),state[other]); assert.equal(plan.needsConfirm,false);
    assert.match(inputProblem(plan.state),/이름 1개와 결과 1개/);
  });
  test(side + ': 빈 반대편 꼬리 삭제에는 확인 불필요', () => {
    const state=initial(); state[other][9]='  ';
    assert.equal(planChange(state,side,state[side].slice(0,9),'delete').needsConfirm,false);
  });
}
test('일괄 8명 / 15개와 여러 개 축소·확장', () => {
  const state=initial(12), shrink=planChange(state,'names',parseList('가,나,다,라,마,바,사,아'),'bulk');
  assert.equal(shrink.removed.length,4); assert.deepEqual(shrink.state.results,state.results.slice(0,8));
  const grow=planChange(shrink.state,'results',initial(15).results,'bulk');
  assert.equal(grow.state.names.length,15); assert.deepEqual(grow.state.names.slice(0,8),shrink.state.names);
  assert.deepEqual(grow.state.names.slice(8),Array(7).fill(''));
});
test('최소 2명 삭제 차단, 최대 20개 초과를 자르지 않고 거절', () => {
  const two=initial(2), twenty=initial(20);
  assert.match(planChange(two,'names',['하나'],'delete').error,/최소 2명/);
  assert.match(planChange(twenty,'results',initial(21).results,'bulk').error,/최대 20명/);
  assert.equal(twenty.results.length,20);
  assert.equal(planChange(two,'names',['하나'],'bulk').state.names.length,2);
});
test('내용만 지우면 슬롯은 유지하고 미입력 검사', () => {
  const state=initial(), values=[...state.results]; values[3]=''; values[4]='  ';
  const plan=planChange(state,'results',values);
  assert.equal(plan.state.names.length,10); assert.equal(plan.state.results.length,10);
  assert.match(inputProblem(plan.state),/결과 2개만 입력하면 출발/);
});
test('구버전 localStorage 15/20, 20/15 모두 비파괴 복원', () => {
  const original=globalThis.localStorage;
  let stored;
  globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
  try {
    for(const reverse of [false,true]) {
      const old={names:initial(reverse?20:15).names.join('\n'),results:initial(reverse?15:20).results.join('\n'),sound:false};
      assert.equal(save(old),true);
      const restored=migrateInputs(read());
      assert.equal(restored.names.length,20); assert.equal(restored.results.length,20);
      assert.deepEqual(restored.names.slice(0,reverse?20:15),parseList(old.names));
      assert.deepEqual(restored.results.slice(0,reverse?15:20),parseList(old.results));
      assert.deepEqual(restored[reverse?'results':'names'].slice(15),Array(5).fill(''));
      save({...restored,sound:false}); assert.deepEqual(migrateInputs(read()),restored);
    }
  } finally { globalThis.localStorage=original; }
});
test('구버전 20명 초과도 데이터 보존, 빈 배열은 두 슬롯', () => {
  const state=migrateInputs({names:initial(23).names,results:['당번']});
  assert.equal(state.names.length,23); assert.equal(state.results.length,23); assert.match(inputProblem(state),/최대 20명/);
  assert.deepEqual(migrateInputs({names:[],results:[]}),{names:['',''],results:['','']});
});
