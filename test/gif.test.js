import test from 'node:test';
import assert from 'node:assert/strict';
import {createGifEncoder} from '../src/export/gif-encoder.js';
import {gifFrames,workerClient,exportGif} from '../src/export/gif.js';
import {snapshotResult,replayPlan,replayFrame} from '../src/export/model.js';
import {generateLadder,trace} from '../src/ladder.js';
import {createRhythm,createLayout} from '../src/layout.js';
import {createRenderer} from '../src/export/render.js';

// Independent GIF/LZW decoder: verify real pixels, not just the filename/header.
function decode(bytes) {
  assert.equal(Buffer.from(bytes.subarray(0,6)).toString(),'GIF89a');
  let at=6;const word=()=>bytes[at++]|bytes[at++]<<8;
  const width=word(),height=word(),packed=bytes[at++];at+=2;
  const global=bytes.slice(at,at+3*(2**((packed&7)+1)));if(packed&128)at+=global.length;
  const blocks=()=>{const data=[];for(let n;(n=bytes[at++]);){data.push(...bytes.slice(at,at+n));at+=n;}return data;};
  const frames=[];let delay=0;
  while(bytes[at]!==0x3b) {
    const marker=bytes[at++];
    if(marker===0x21) {const label=bytes[at++],data=blocks();if(label===0xf9)delay=(data[1]|data[2]<<8)*10;continue;}
    assert.equal(marker,0x2c);const x=word(),y=word(),w=word(),h=word(),flags=bytes[at++];
    let palette=global;if(flags&128){palette=bytes.slice(at,at+3*2**((flags&7)+1));at+=palette.length;}
    const minimum=bytes[at++],data=blocks(),clear=1<<minimum,end=clear+1;
    let dictionary,size,next,bit=0,previous;const pixels=[];
    const reset=()=>{dictionary=Array.from({length:clear},(_,i)=>[i]);size=minimum+1;next=end+1;previous=null;};reset();
    while(bit<data.length*8) {
      let code=0;for(let i=0;i<size;i++,bit++)code|=((data[bit>>3]>>(bit&7))&1)<<i;
      if(code===clear){reset();continue;}if(code===end)break;
      const entry=dictionary[code]||(code===next&&previous?[...previous,previous[0]]:null);assert.ok(entry,'valid LZW code');
      pixels.push(...entry);
      if(previous){dictionary[next++]=[...previous,entry[0]];if(next===(1<<size)&&size<12)size++;}
      previous=entry;
    }
    assert.equal(pixels.length,w*h);frames.push({x,y,w,h,delay,pixels,palette});
  }
  return {width,height,frames};
}

test('GIF encoder: independent decode of pixels, frame delays, loop and valid trailer',()=>{
  const width=32,height=16,rgba=new Uint8Array(width*height*4),other=new Uint8Array(rgba.length);
  for(let i=0;i<rgba.length;i+=4){rgba.set([255,0,0,255],i);other.set([0,0,255,255],i);}
  const samples=new Uint8Array([...rgba,...other]),encoder=createGifEncoder(width,height,samples);
  encoder.frame(rgba,80);encoder.frame(other,1300);const bytes=encoder.finish(),gif=decode(bytes);
  assert.equal(bytes.at(-1),0x3b);assert.ok(Buffer.from(bytes).includes(Buffer.from('NETSCAPE2.0')));
  assert.deepEqual([gif.width,gif.height],[width,height]);assert.equal(gif.frames.length,2);
  for(const [i,color] of [[0,[255,0,0]],[1,[0,0,255]]]) {
    const frame=gif.frames[i];assert.equal(frame.delay,i?1300:80);
    for(const pixel of frame.pixels)assert.deepEqual([...frame.palette.slice(pixel*3,pixel*3+3)],color);
  }
  assert.throws(()=>encoder.frame(rgba,80));encoder.dispose();
});

for(const count of [2,8,12,20]) test(`GIF ${count}명 양방향: 동일 경로·endpoint·중복 슬롯·타이밍`,()=>{
  const ladder=generateLadder(count),rhythm=createRhythm(ladder),names=Array.from({length:count},(_,i)=>'긴 한글 참가자 이름 '+i),results=Array(count).fill('같은 결과');
  const before=JSON.stringify({ladder,rhythm,names,results});
  for(let index=0;index<count;index++)for(const reverse of [false,true]) {
    const snapshot=snapshotResult({ladder,rhythm,names,results,index,reverse}),replay=replayPlan(snapshot),frames=gifFrames(replay),route=trace(ladder,index,reverse);
    assert.deepEqual(snapshot.points,createLayout(ladder,rhythm,1920,count*84).points(route.points));
    assert.equal(snapshot.start,reverse?route.end:index);assert.equal(snapshot.end,reverse?index:route.end);
    assert.equal(snapshot.message,reverse?`같은 결과 → ${names[route.end]}!`:`${names[index]} → 같은 결과!`);
    assert.deepEqual(replayFrame(replay,frames[0].time).point,snapshot.points[0]);
    assert.deepEqual(replayFrame(replay,frames.at(-1).time).point,snapshot.points.at(-1));
    const duration=frames.reduce((sum,f)=>sum+f.delay,0);assert.ok(duration>=4000&&duration<=6000);
    assert.ok(frames.length/duration*1000<=15);assert.ok(frames.every(f=>f.delay>=70&&f.delay%10===0));
    assert.ok(frames.filter(f=>replayFrame(replay,f.time).arrived).reduce((sum,f)=>sum+f.delay,0)>=1200);
    assert.equal(JSON.stringify({ladder,rhythm,names,results}),before);
  }
});

test('GIF renderer: long Korean text stays visible; independent GIF dimensions and canvas disposal',()=>{
  const previous=globalThis.document,texts=[];
  const ctx=new Proxy({measureText:s=>({width:Array.from(s).length*14}),fillText:s=>texts.push(s)}, {get:(obj,key)=>obj[key]||(()=>{})});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
  try {
    for(const count of [2,8,12,20])for(const reverse of [false,true]) {
      const ladder=generateLadder(count),names=Array(count).fill('긴한글참가자이름'),results=Array(count).fill('아주긴결과문자열');
      const snapshot=snapshotResult({ladder,rhythm:createRhythm(ladder),names,results,index:count-1,reverse});
      const renderer=createRenderer(snapshot,'gif');texts.length=0;renderer.draw();
      assert.ok(texts.join('').includes(snapshot.message));assert.ok(texts.join('').includes('사다리 타기'));
      assert.ok(renderer.canvas.width>=640);assert.ok(renderer.canvas.width*renderer.canvas.height<=3000000);
      assert.ok(renderer.canvas.width>=snapshot.boardWidth,'normal Korean names are not scaled down');
      renderer.dispose();assert.equal(renderer.canvas.width,1);
    }
  }finally{globalThis.document=previous;}
});

class MockWorker {
  terminated=0;
  postMessage(data) {queueMicrotask(()=>this.onmessage?.({data:{ok:true,type:data.type}}));}
  terminate(){this.terminated++;}
}
test('GIF worker cleanup on success, abort, error, timeout and postMessage failure',async()=>{
  for(const mode of ['success','abort','error','messageerror','timeout','post']) {
    const worker=new MockWorker(),abort=new AbortController();
    if(mode!=='success')worker.postMessage=()=>{if(mode==='post')throw Error('post');};
    const client=workerClient(worker,abort.signal,10),pending=client.request({type:'init'});
    if(mode==='abort')abort.abort();if(mode==='error')worker.onerror();if(mode==='messageerror')worker.onmessageerror();
    if(mode==='success')await pending;else await assert.rejects(pending);
    client.dispose();client.dispose();assert.equal(worker.terminated,1);assert.equal(worker.onmessage,null);
  }
});

test('GIF export: five runs dispose worker/canvas; fallback and abort preserve snapshot',async()=>{
  const previous=globalThis.document;globalThis.document={fonts:{ready:Promise.resolve()}};
  let disposed=0,terminated=0;
  const snapshot={unchanged:true};
  const renderer=()=>({canvas:{width:4,height:4,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(64).fill(255)})})},replay:{duration:4300},draw(){},dispose(){disposed++;}});
  const makeWorker=()=>{
    let encoder;
    return {postMessage(data){queueMicrotask(()=>{
      if(data.type==='init')encoder=createGifEncoder(data.width,data.height,new Uint8Array(data.buffer));
      if(data.type==='frame')encoder.frame(new Uint8Array(data.buffer),data.delay);
      const result=data.type==='finish'?{buffer:encoder.finish().buffer}:{ok:true};this.onmessage?.({data:result});
    });},terminate(){terminated++;encoder?.dispose();}};
  };
  try {
    for(let i=0;i<5;i++) {
      const blob=await exportGif(snapshot,undefined,{createRenderer:renderer,makeWorker});assert.equal(blob.type,'image/gif');assert.ok(blob.size>0);
      assert.ok(decode(new Uint8Array(await blob.arrayBuffer())).frames.length>1);
      assert.equal(disposed,i+1);assert.equal(terminated,i+1);
    }
    const blob=await exportGif(snapshot,undefined,{createRenderer:renderer,makeWorker(){throw Error('unsupported');}});assert.equal(blob.type,'image/gif');assert.equal(disposed,6);
    const abort=new AbortController();abort.abort();await assert.rejects(exportGif(snapshot,abort.signal,{createRenderer:renderer}),{name:'AbortError'});assert.equal(disposed,6);
    assert.deepEqual(snapshot,{unchanged:true});
  }finally{globalThis.document=previous;}
});
