import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairedEditors} from '../src/paired-editor.js';

const initial={names:['가','나','다'],results:['당번','통과','특별 당번']};
function fixture() {
  const views={};let answer,calls=0;
  const inputs=createPairedEditors(initial,()=>{},()=>{calls++;return new Promise(resolve=>{answer=resolve;});},(id,_label,change)=>{
    const view={change,locked:false,set(values){this.values=[...values];},lock(value){this.locked=value;},focus(){},message(){},draft(){},clear(){}};
    return views[id]=view;
  });
  return {inputs,views,respond:value=>answer(value),calls:()=>calls};
}
test('삭제 확인 중 반복 입력 차단, 취소 후 두 목록과 저장값 유지',async()=>{
  const f=fixture(), before=f.inputs.serialize();
  const pending=f.views.names.change(['가','다'],{kind:'delete',index:1});
  assert.equal(f.views.results.locked,true);
  await f.views.results.change(['통과','특별 당번'],{kind:'delete',index:0});
  assert.equal(f.calls(),1);assert.deepEqual(f.inputs.serialize(),before);
  f.respond(null);await pending;
  assert.deepEqual(f.inputs.serialize(),before);assert.equal(f.views.names.locked,false);
  assert.deepEqual(f.views.names.values,initial.names);
});
test('확인한 삭제만 양쪽에 한 번 적용하고 전체 지우기는 빈칸 2개',async()=>{
  const f=fixture(), pending=f.views.results.change(['통과','특별 당번'],{kind:'delete',index:0});
  f.respond('delete');await pending;
  assert.deepEqual(f.inputs.state,{names:['가','나'],results:['통과','특별 당번']});
  f.inputs.clear();assert.deepEqual(f.inputs.state,{names:['',''],results:['','']});
});
test('초과 초안은 보존하고 수정 후 정상 상태로 복귀',async()=>{
  const f=fixture(), values=Array.from({length:21},(_,i)=>String(i));
  await f.views.names.change(values,{kind:'bulk',raw:values.join(',')});
  assert.equal(f.inputs.serialize().inputDrafts.names,values.join(','));
  assert.deepEqual(f.inputs.state,initial);assert.match(f.inputs.problem(),/최대 20명/);
  await f.views.names.change(['가','나','다'],{kind:'bulk',raw:'가,나,다'});
  assert.equal(f.inputs.serialize().inputDrafts.names,null);assert.equal(f.inputs.problem(),'');
});
