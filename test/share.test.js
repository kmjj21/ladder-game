import test from 'node:test';
import assert from 'node:assert/strict';
import {shareFile} from '../src/export/share.js';
import {createExportControls} from '../src/export/controls.js';
import {generateLadder} from '../src/ladder.js';
import {createRhythm} from '../src/layout.js';
import {snapshotResult} from '../src/export/model.js';

test('파일 공유 지원·취소·활성화 만료·재시도',async()=>{
 const file=new File(['png'],'result.png',{type:'image/png'});let calls=0;
 const nav={canShare:()=>true,share:async data=>{calls++;assert.equal(data.title,'사다리 타기 결과');assert.equal(data.files[0],file);},userActivation:{isActive:false}};
 assert.equal(await shareFile(file,{nav}), 'ready');assert.equal(calls,0);
 assert.equal(await shareFile(file,{nav,gesture:true}),'shared');
 assert.equal(await shareFile(file,{nav,gesture:true}),'shared');assert.equal(calls,2);
 for(const missing of [{},{share(){}},{canShare:()=>true},{share(){},canShare:()=>false},{share(){},canShare(){throw Error();}}]) assert.equal(await shareFile(file,{nav:missing}),'unsupported');
 for(const [name,outcome] of [['AbortError','cancelled'],['NotAllowedError','ready'],['Error','failed']]) {nav.share=async()=>{throw Object.assign(Error(),{name});};assert.equal(await shareFile(file,{nav,gesture:true}),outcome);}
});

test('공유 컨트롤: 양방향 이미지/영상·중복 endpoint·음향·기존 저장·중복 클릭·상태 보존',async()=>{
 const previous=Object.fromEntries(['document','window','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,download:'',textContent:'',clicks:0,pause(){},load(){},focus(){},setAttribute(){},removeAttribute(){},close(){this.open=false;},showModal(){this.open=true;},click(){this.clicks++;}});return nodes.get(id);};
 let files=[],captured=[],sounds=[],sound=true,hold=null;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:node}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){}}});
 const nav={canShare:()=>true,share:async data=>files.push(data),userActivation:{isActive:true}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:nav});
 try {
 const controller=createExportControls(()=>sound,{exportImage:async s=>{captured.push(s);if(hold)await hold;return new Blob(['png'],{type:'image/png'});},exportVideo:async(s,a)=>{captured.push(s);return {blob:new Blob(['video'],{type:'video/webm'}),extension:'webm',withAudio:a.enabled};},videoSupported:()=>true,prepareAudio:enabled=>{sounds.push(enabled);return{enabled};}});
 const ladder=generateLadder(8),data={ladder,rhythm:createRhythm(ladder),names:Array.from({length:8},(_,i)=>'이름'+i),results:Array(8).fill('통과'),index:4,reverse:false};
 for(const reverse of [false,true]) for(const kind of ['image','video']) {
  data.reverse=reverse;const before=JSON.stringify(data);controller.set(data);
  node('result-share').onclick();assert.equal(node('share-choice').open,true);
  await node('share-'+kind).onclick();assert.deepEqual(captured.at(-1),snapshotResult(data));assert.equal(JSON.stringify(data),before);
  assert.equal(files.at(-1).files[0].type,kind==='image'?'image/png':'video/webm');
  assert.equal(node('export-download').clicks,0);
 }
 sound=false;await node('share-video').onclick();assert.deepEqual(sounds,[true,true,false]);
 nav.share=undefined;await node('share-image').onclick();assert.equal(node('export-download').clicks,1);
 nav.share=async()=>{};nav.canShare=()=>false;await node('share-video').onclick();assert.equal(node('export-download').clicks,2);
 for(const kind of ['image','video'])await node('export-'+kind).onclick();assert.equal(node('export-download').clicks,4);
 let release;hold=new Promise(resolve=>release=resolve);const count=captured.length;
 const pending=node('share-image').onclick();assert.equal(node('result-share').disabled,true);await node('share-image').onclick();assert.equal(captured.length,count+1);release();await pending;hold=null;
 nav.canShare=()=>true;nav.userActivation.isActive=false;await node('share-image').onclick();assert.match(node('export-status').textContent,/아래 공유하기/);
 nav.share=async()=>{throw Object.assign(Error(),{name:'AbortError'});};await node('export-share').onclick();assert.equal(node('export-status').textContent,'파일이 준비됐어요.');
 controller.clear();assert.equal(node('export-controls').hidden,true);
 }finally{for(const [k,descriptor] of Object.entries(previous))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
});
