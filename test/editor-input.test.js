import test from 'node:test';
import assert from 'node:assert/strict';
import { createPairedEditors } from '../src/paired-editor.js';

// Exercise the real editor event handlers and paired state, not a mocked editor.
class Element {
  constructor(tag) { this.tag=tag; this.children=[]; this.value=''; this.classList={add(){},remove(){}}; }
  append(...children) { this.children.push(...children); }
  insertBefore(child,before) { this.children.splice(this.children.indexOf(before),0,child); }
  replaceChildren(...children) { this.children=children; }
  setAttribute() {}
  getBoundingClientRect() { return {height:0}; }
  querySelectorAll(selector) {
    return this.children.flatMap(child=>[...(selector.split(',').includes(child.tag)?[child]:[]),...child.querySelectorAll(selector)]);
  }
  focus() {}
}
function fixture(saved={names:['',''],results:['','']}) {
  const elements={};
  for(const side of ['names','results']) {
    elements[side]=new Element('textarea'); elements[side+'-editor']=new Element('section');
    elements[side+'-editor'].append(elements[side]);
  }
  const oldDocument=globalThis.document;
  let stored, confirmations=0;
  globalThis.document={createElement:tag=>new Element(tag),getElementById:id=>elements[id]};
  const inputs=createPairedEditors(saved,()=>{stored=structuredClone(inputs.serialize());},async()=>{confirmations++;return null;});
  return {
    inputs,elements,read:()=>stored,confirmations:()=>confirmations,
    rows:side=>elements[side+'-editor'].querySelectorAll('input'),
    add:side=>elements[side+'-editor'].children.find(el=>el.className==='add-entry').onclick(),
    restore(){globalThis.document=oldDocument;},
  };
}
async function type(input,value,composing=true) { input.value=value; await input.oninput({isComposing:composing}); }

test('조합 종료 전 입력도 시작 검증·현재 상태에 반영하고 추가 시 보존',async()=>{
  const f=fixture();
  try {
    for(const [side,values] of Object.entries({names:['민수','영희'],results:['통과','당번']}))
      for(const [i,value] of values.entries()) await type(f.rows(side)[i],value);
    assert.equal(f.inputs.problem(),'');
    assert.deepEqual(f.read().names,['민수','영희']);
    await f.add('names');
    assert.deepEqual(f.inputs.state.names,['민수','영희','']);
    assert.deepEqual(f.inputs.state.results,['통과','당번','']);
    assert.deepEqual(f.rows('names').map(el=>el.value),['민수','영희','']);
  } finally {f.restore();}
});

test('결과 편집은 참가자 DOM·입력·현재 상태를 덮어쓰지 않는다',async()=>{
  const f=fixture();
  try {
    const name=f.rows('names')[0];
    await type(name,'지영');
    await type(f.rows('results')[0],'간식 사기');
    assert.equal(f.rows('names')[0],name);
    assert.equal(name.value,'지영');
    assert.equal(f.inputs.state.names[0],'지영');
    assert.equal(f.read().names[0],'지영');
    await name.oncompositionend();
    assert.equal(f.inputs.state.names[0],'지영');
    await type(name,'지영 수정');
    assert.equal(f.rows('results')[0].value,'간식 사기');
    assert.equal(f.inputs.state.results[0],'간식 사기');
  } finally {f.restore();}
});

test('일반 입력·change 및 편집 모드 전환은 현재 입력을 유지',async()=>{
  const f=fixture();
  try {
    await type(f.rows('names')[0],'Alex',false);
    const input=f.rows('names')[1];input.value='영희';await input.onchange();
    await type(f.rows('results')[0],'통과',false);await type(f.rows('results')[1],'당번',false);
    const before=f.inputs.serialize();
    for(const side of ['names','results']) {
      const tabs=f.elements[side+'-editor'].children[0].children;
      tabs[0].onclick();tabs[1].onclick();
    }
    assert.deepEqual(f.inputs.serialize(),before);assert.equal(f.inputs.problem(),'');
    assert.deepEqual(f.rows('names').map(el=>el.value),['Alex','영희']);
    assert.deepEqual(f.rows('results').map(el=>el.value),['통과','당번']);
  } finally {f.restore();}
});

test('일괄 한글 조합 중 개수 축소는 반대쪽 입력을 삭제하지 않는다',async()=>{
  const f=fixture({names:['민수','영희','지영'],results:['통과','당번','간식']});
  try {
    f.elements['names-editor'].children[0].children[0].onclick();
    await type(f.elements.names,'민수\n영희\n');
    assert.deepEqual(f.inputs.state.results,['통과','당번','간식']);
    assert.equal(f.confirmations(),0);
    await type(f.elements.names,'민수\n영희\n준호');
    await f.elements.names.oncompositionend();
    assert.deepEqual(f.read().names,['민수','영희','준호']);
    assert.equal(f.inputs.problem(),'');
  } finally {f.restore();}
});
