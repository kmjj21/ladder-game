import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLadder, trace } from '../src/ladder.js';
import { createRhythm, createLayout } from '../src/layout.js';
import { snapshotResult, replayPlan, replayFrame, mediaFilename } from '../src/export/model.js';
import { supportedTypes, extensionFor } from '../src/export/support.js';
import { createRenderer, wrapText } from '../src/export/render.js';

for(const count of [2,8,12,20]) test(`export ${count}명: 양방향·중복 결과·동일 경로·원본 불변`,()=>{
  for(let round=0;round<50;round++) {
    const ladder=generateLadder(count),rhythm=createRhythm(ladder),names=Array.from({length:count},(_,i)=>'참가자 '+i),results=Array(count).fill('당번');
    const before=JSON.stringify({ladder,rhythm,names,results});
    for(let index=0;index<count;index++) for(const reverse of [false,true]) {
      const snapshot=snapshotResult({ladder,rhythm,names,results,index,reverse});
      const route=trace(ladder,index,reverse),layout=createLayout(ladder,rhythm,1920,count*84);
      assert.deepEqual(snapshot.points,layout.points(route.points));
      assert.equal(snapshot.start,reverse?route.end:index);assert.equal(snapshot.end,reverse?index:route.end);
      const replay=replayPlan(snapshot);
      assert.ok(replay.duration>=4000 && replay.duration<=7000);
      assert.deepEqual(replayFrame(replay,0).point,snapshot.points[0]);
      assert.deepEqual(replayFrame(replay,replay.duration).point,snapshot.points.at(-1));
      for(let t=500;t<replay.duration-1300;t+=71) {
        const frame=replayFrame(replay,t), segment=replay.plan.segments[frame.index];
        assert.ok(frame.point.x===segment.a.x || frame.point.y===segment.a.y);
      }
      snapshot.names[0]='수정';snapshot.rows[0].edges.length=0;
      assert.equal(JSON.stringify({ladder,rhythm,names,results}),before);
    }
  }
});
test('지원 포맷 탐지와 확장자, 위험한 파일명 문자 없음',()=>{
  assert.deepEqual(supportedTypes(undefined),[]);
  assert.deepEqual(supportedTypes({isTypeSupported:type=>type==='video/webm'}),['video/webm']);
  assert.deepEqual(supportedTypes({isTypeSupported:()=>{throw Error();}}),[]);
  assert.equal(extensionFor('video/mp4;codecs=avc1'),'mp4');assert.equal(extensionFor('video/webm'),'webm');
  assert.throws(()=>extensionFor('audio/mpeg'));
  assert.match(mediaFilename('png',new Date('2026-09-19T12:00:00Z')),/^ladder-result-20260919-120000\.png$/);
});
test('20명 렌더러 전체 텍스트·해상도 상한·캔버스 정리',()=>{
  const original=globalThis.document, texts=[];
  const context=new Proxy({measureText:s=>({width:Array.from(s).length*12}),fillText:s=>texts.push(s)}, {get:(obj,key)=>obj[key]||(()=>{})});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  try {
    const ladder=generateLadder(20),names=Array.from({length:20},(_,i)=>`이름${i}긴한글이름`),results=Array.from({length:20},(_,i)=>`결과${i}당번`);
    const snapshot=snapshotResult({ladder,rhythm:createRhythm(ladder),names,results,index:19,reverse:false});
    for(const kind of ['image','video']) {
      const renderer=createRenderer(snapshot,kind);renderer.draw();
      assert.ok(renderer.canvas.width>=1280);assert.ok(renderer.canvas.width*renderer.canvas.height<=6000000);
      assert.ok(texts.join('').includes('이름19긴한글이름'));assert.ok(texts.join('').includes('결과19당번'));
      renderer.dispose();assert.equal(renderer.canvas.width,1);
    }
    assert.deepEqual(wrapText(context,'가나다라마',24),['가나','다라','마']);
  } finally {globalThis.document=original;}
});
