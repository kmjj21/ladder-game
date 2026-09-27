import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../src/sound.js';
import { prepareAudio } from '../src/export/audio.js';

function audioMock() {
  const contexts=[], connections=[]; let resolveResume;
  class Audio {
    constructor() { this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.destination={speaker:contexts.length};this.notes=[];this.primed=0;contexts.push(this); }
    resume() { this.resumes=(this.resumes||0)+1; return new Promise(resolve=>{resolveResume=()=>{this.state='running';resolve();};}); }
    createBuffer() {return {};}
    createBufferSource() {const ctx=this;return {connect:to=>connections.push(to),start(){ctx.primed++;queueMicrotask(()=>this.onended?.());},disconnect(){}};}
    createOscillator() {const ctx=this;return {frequency:{setValueAtTime:n=>ctx.notes.push(n),exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){queueMicrotask(()=>this.onended?.());},disconnect(){}};}
    createGain() {return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect:to=>connections.push(to),disconnect(){}};}
    createMediaStreamDestination() {this.recording={stream:{getTracks:()=>[{stop(){}}]},disconnect(){}};return this.recording;}
    close() {this.state='closed';return Promise.resolve();}
  }
  return {Audio,contexts,connections,resume:()=>resolveResume()};
}

test('실제 gesture에서 생성·무음 unlock·resume 후 출발음, interrupted 복구', async () => {
  const mock=audioMock(), engine=createAudioEngine(()=>({AudioContext:mock.Audio}));
  assert.equal(mock.contexts.length,0);
  const ready=engine.unlock('start'),ctx=mock.contexts[0];
  assert.equal(ctx.primed,1); assert.equal(ctx.resumes,1); assert.equal(ctx.notes.length,0);
  mock.resume();assert.equal(await ready,true);assert.equal(ctx.notes.length,2);
  for(const kind of ['swish','turn','finish']) engine.tone(kind,true);
  assert.equal(ctx.notes.length,8);assert.equal(mock.contexts.length,1);
  ctx.state='interrupted';const again=engine.unlock('tap');mock.resume();await again;
  assert.equal(ctx.resumes,2);assert.equal(ctx.notes.length,9);assert.equal(mock.contexts.length,1);
});

test('OFF 상태는 생성/재생하지 않고 대기 중인 ON 확인음도 취소', async () => {
  const mock=audioMock(), engine=createAudioEngine(()=>({AudioContext:mock.Audio}));
  engine.setEnabled(false);await engine.unlock('tap');assert.equal(mock.contexts.length,0);
  engine.setEnabled(true);const ready=engine.unlock('tap');engine.setEnabled(false);mock.resume();await ready;
  assert.equal(mock.contexts[0].notes.length,0);
  engine.setEnabled(true);await engine.unlock('tap');assert.equal(mock.contexts[0].notes.length,1);
  engine.tone('finish',false);assert.equal(mock.contexts[0].notes.length,1);
});

test('export 오디오 종료가 게임 스피커와 활성 context를 끊지 않음', async () => {
  const previous=globalThis.window, mock=audioMock();globalThis.window={AudioContext:mock.Audio};
  try {
    const engine=createAudioEngine(()=>globalThis.window), ready=engine.unlock();mock.resume();await ready;
    const game=mock.contexts[0], exported=prepareAudio(true), recording=mock.contexts[1];
    mock.resume();assert.equal(await exported.ready,true);
    assert.ok(mock.connections.includes(recording.destination));assert.ok(mock.connections.includes(recording.recording));
    exported.play('start');await exported.close();
    assert.equal(recording.state,'closed');assert.equal(game.state,'running');
    engine.tone('finish',true);assert.equal(game.notes.length,4);assert.ok(mock.connections.includes(game.destination));
  } finally {globalThis.window=previous;}
});
