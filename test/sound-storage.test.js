import test from 'node:test';
import assert from 'node:assert/strict';
import {read,save} from '../src/storage.js';
import {unlock,tone} from '../src/sound.js';

test('저장 차단·손상된 JSON에서도 안전하게 동작',()=>{
  const original=globalThis.localStorage;
  try {
    globalThis.localStorage={getItem:()=>'{broken',setItem:()=>{throw Error('blocked');}};
    assert.deepEqual(read(),{});assert.equal(save({names:['가','나']}),false);
    globalThis.localStorage={getItem:()=>{throw Error('blocked');}};
    assert.deepEqual(read(),{});
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
