import test from 'node:test';
import assert from 'node:assert/strict';
import {read,save} from '../src/storage.js';
import {unlock,tone} from '../src/sound.js';

test('저장 차단·손상된 JSON에서도 안전하게 동작',()=>{
  const original=globalThis.localStorage;
  try {
    globalThis.localStorage={getItem:()=>'{broken',setItem:()=>{throw Error('blocked');}};
    assert.deepEqual(read(),{sound:true});assert.equal(save({names:['가','나']}),false);
    globalThis.localStorage={getItem:()=>{throw Error('blocked');}};
    assert.deepEqual(read(),{sound:true});
  } finally {globalThis.localStorage=original;}
});

test('효과음 ON/OFF·음역·음량·노드 정리',()=>{
  const original=globalThis.window, notes=[],peaks=[];let disconnected=0;
  class AudioContext {
    state='running';currentTime=0;destination={};resume(){return Promise.resolve();}
    createOscillator(){return {type:'',frequency:{setValueAtTime:f=>notes.push(f),exponentialRampToValueAtTime:f=>assert.ok(f<=1020)},connect(){},start(){},stop(){queueMicrotask(()=>this.onended());},disconnect(){disconnected++;}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime:v=>peaks.push(v),exponentialRampToValueAtTime(){}},connect(){},disconnect(){disconnected++;}};}
  }
  globalThis.window={AudioContext};
  try {
    unlock();tone('start',false);assert.equal(notes.length,0);
    for(const kind of ['start','swish','turn','finish']) tone(kind,true);
    assert.equal(notes.length,8);assert.ok(Math.max(...notes)<=784);assert.ok(Math.max(...peaks)<=0.024);
    return Promise.resolve().then(()=>assert.equal(disconnected,16));
  } finally {globalThis.window=original;}
});

test('legacy game data is removed after sound migrates; other settings remain untouched',()=>{
 const original=globalThis.localStorage;
 try {
  for(const sound of [true,false]) {
   const data=new Map([['ladder-game:v1',JSON.stringify({names:['민수','영희'],results:['당번','통과'],game:{},inputDrafts:{},sound})],['other-preference','keep']]);
   globalThis.localStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
   assert.deepEqual(read(),{sound});assert.equal(data.has('ladder-game:v1'),false);assert.equal(data.get('other-preference'),'keep');
   save({sound:!sound,names:['never save'],game:{}});assert.deepEqual(read(),{sound:!sound});
   assert.deepEqual(JSON.parse(data.get('ladder-game:preferences:v1')),{sound:!sound});
  }
 }finally{globalThis.localStorage=original;}
});
test('new preference wins over legacy; failed cleanup never exposes game data',()=>{
 const original=globalThis.localStorage;
 try {
  globalThis.localStorage={getItem:k=>JSON.stringify(k==='ladder-game:v1'?{sound:false,names:['old']}:{sound:true}),setItem(){},removeItem(){throw Error('blocked');}};
  assert.deepEqual(read(),{sound:true});
  globalThis.localStorage={getItem:k=>k==='ladder-game:v1'?JSON.stringify({sound:false,names:['old']}):null,setItem(){throw Error('quota');},removeItem(){throw Error('must preserve preference');}};
  assert.deepEqual(read(),{sound:false});
 }finally{globalThis.localStorage=original;}
});
