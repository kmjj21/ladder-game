import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Minimal DOM surface for the real app, editors, persistence and button handlers.
// No production state or validation logic is copied into this fixture.
class Element extends EventTarget {
  constructor(tag) {
    super();this.tag=tag;this.children=[];this.value='';this.hidden=false;this.disabled=false;this.attributes={};
    this.style={setProperty(){}};this.clientWidth=1000;this.scrollWidth=1000;this.scrollLeft=0;
    const classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)};
  }
  append(...children){this.children.push(...children);}
  insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);}
  replaceChildren(...children){this.children=children;}
  get firstElementChild(){return this.children[0];}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.classList.add(...value.split(' '));}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector.split(',').some(s=>s.startsWith('.')?child.classList.contains(s.slice(1)):child.tag===s)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){return {height:0,top:0};}
  focus(){}
  pause(){}
  load(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
}
let serial=0;
async function boot(saved, savedGames) {
  const originals=Object.fromEntries(['document','window','localStorage','matchMedia','ResizeObserver','innerWidth'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),nodes={};
  for(const [,tag,attrs,id] of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node=nodes[id]=new Element(tag);node.hidden=/\bhidden\b/.test(attrs);node.placeholder=attrs.match(/placeholder="([^"]*)"/)?.[1]||'';
  }
  for(const side of ['names','results'])nodes[side+'-editor'].append(nodes[side]);
  for(const name of ['sound-wave','sound-slash']){const node=new Element('path');node.classList.add(name);nodes.sound.append(node);}
  const stored=new Map(saved===undefined?[]:[['ladder-game:v1',JSON.stringify(saved)]]);
  if(savedGames)stored.set('ladder-game:saved-games:v1',JSON.stringify(savedGames));
  const globals={
    document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),body:new Element('body'),addEventListener(){}},
    window:{addEventListener(){},scrollTo(){}},
    localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},innerWidth:1280,
  };
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const restore=()=>{for(const [key,descriptor] of Object.entries(originals))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
  try{await import(`../src/app.js?initial-state=${++serial}`);}catch(error){restore();throw error;}
  return {nodes,restore,saved:()=>JSON.parse(stored.get('ladder-game:saved-games:v1')||'null'),read:()=>JSON.parse(stored.get('ladder-game:preferences:v1')||'null'),legacy:()=>stored.get('ladder-game:v1'),rows:side=>nodes[side+'-editor'].querySelectorAll('input')};
}
const empty={names:['',''],results:['','']};
const user={names:['민수','영희','지영'],results:['통과','통과','당번'],sound:false};
function values(f){return {names:f.rows('names').map(n=>n.value),results:f.rows('results').map(n=>n.value)};}
function input(f,side,index,value){const node=f.rows(side)[index];node.value=value;node.oninput({isComposing:true});}

function fill(f,count=2) {
  while(f.rows('names').length<count)f.nodes['names-editor'].children.find(n=>n.className==='add-entry').onclick();
  for(let i=0;i<count;i++){input(f,'names',i,'참가자'+i);input(f,'results',i,'결과'+i);}
}
test('A: first load starts with empty 2+2 and disabled start',async()=>{
 const f=await boot();try{assert.deepEqual(values(f),empty);assert.ok(f.nodes.create.disabled);}finally{f.restore();}
});
test('B: placeholders are displayed but never values or saved input',async()=>{
 const f=await boot();try{for(const [side,label] of [['names','이름을 입력하세요'],['results','결과를 입력하세요']]) {
 assert.equal(f.nodes[side].placeholder,label);assert.ok(f.rows(side).every(n=>n.placeholder===label&&n.value===''));
 }assert.deepEqual(f.read(),{sound:true});assert.equal(f.legacy(),undefined);}finally{f.restore();}
});
for(const count of [2,8,20])test(`refresh after ${count} entries starts empty; only sound survives`,async()=>{
 const f=await boot({sound:false});let preferences;
 try{fill(f,count);assert.equal(f.nodes.create.disabled,false);f.nodes.create.onclick();f.nodes.all.onclick();preferences=f.read();assert.deepEqual(preferences,{sound:false});assert.equal(f.legacy(),undefined);}finally{f.restore();}
 const next=await boot(preferences);try{assert.deepEqual(values(next),empty);assert.equal(next.nodes.game.hidden,true);assert.equal(next.nodes.sound.attributes['aria-pressed'],'false');}finally{next.restore();}
});
test('old sample, user names, drafts and complete game never restore, even after queued work',async()=>{
 const {createGame}=await import('../src/game-state.js');
 const samples={names:['민수','영희','지영','준호','수빈','지우','현우','서연'],results:['간식 사기','통과','통과','오늘의 당번','통과','통과','통과','면제']};
 for(const saved of [user,samples,{...samples,names:samples.names.join('\n')},{...user,game:createGame(user.names,user.results),inputDrafts:{names:'옛 입력'}}]) {
 const f=await boot(saved);try{await new Promise(resolve=>setTimeout(resolve,10));assert.deepEqual(values(f),empty);assert.equal(f.nodes.game.hidden,true);assert.equal(f.legacy(),undefined);}finally{f.restore();}
 }
});
test('new game cancel preserves inputs; confirm resets empty 2+2',async()=>{
 const f=await boot();try{fill(f,8);f.nodes.create.onclick();f.nodes.all.onclick();const before=values(f);
 let pending=f.nodes.new.onclick();f.nodes['choice-cancel'].onclick();await pending;assert.deepEqual(values(f),before);
 pending=f.nodes.new.onclick();f.nodes['choice-actions'].firstElementChild.onclick();await pending;
 assert.deepEqual(values(f),empty);assert.equal(f.nodes.game.hidden,true);assert.ok(f.nodes.create.disabled);
 fill(f);f.nodes.create.onclick();assert.equal(f.nodes.progress.textContent,'확인 0 / 2');
 }finally{f.restore();}
});
test('shuffle preserves inputs and resets revealed progress',async()=>{
 const f=await boot();try{fill(f,8);const before=values(f);f.nodes.create.onclick();f.nodes.all.onclick();
 const pending=f.nodes.shuffle.onclick();f.nodes['choice-actions'].firstElementChild.onclick();await pending;
 assert.deepEqual(values(f),before);assert.equal(f.nodes.progress.textContent,'확인 0 / 8');
 }finally{f.restore();}
});
test('empty cannot start; complete input enables; added empty slot disables',async()=>{
 const f=await boot();try{f.nodes.create.onclick();assert.equal(f.nodes.game.hidden,true);fill(f);assert.equal(f.nodes.create.disabled,false);
 f.nodes['names-editor'].children.find(n=>n.className==='add-entry').onclick();assert.ok(f.nodes.create.disabled);assert.deepEqual(values(f).names,['참가자0','참가자1','']);
 input(f,'names',2,'지영');input(f,'results',2,'간식');assert.equal(f.nodes.create.disabled,false);
 }finally{f.restore();}
});

test('saved games never auto-load; explicit load restores names, slots and geometry',async()=>{
 const {createGame,slotLabels}=await import('../src/game-state.js');const {gameSnapshot}=await import('../src/saved-games.js');
 const game=createGame(Array.from({length:20},(_,i)=>'이름'+i),Array(20).fill('통과'));
 const envelope={schemaVersion:1,games:[{id:'test',schemaVersion:1,name:'20명 저장',createdAt:1,updatedAt:1,snapshot:gameSnapshot(game)}]};
 const f=await boot(undefined,envelope);try{
 assert.deepEqual(values(f),empty);assert.deepEqual(f.saved(),envelope);
 f.nodes['saved-open'].onclick();const pending=f.nodes['saved-list'].children[0].children[2].children[0].onclick();
 f.nodes['choice-actions'].firstElementChild.onclick();await pending;
 assert.deepEqual(values(f),{names:game.names,results:game.inputResults});
 assert.deepEqual(f.nodes['bottom-labels'].children.map(n=>n.children[0].textContent),slotLabels(game));
 assert.equal(f.nodes.game.hidden,false);assert.deepEqual(f.saved(),envelope);
 }finally{f.restore();}
});
test('save UI writes only explicitly; canceled name dialog never saves',async()=>{
 const f=await boot();try{fill(f,8);f.nodes.create.onclick();assert.equal(f.saved(),null);
 await f.nodes['game-save'].onclick();f.nodes['save-cancel'].onclick();assert.equal(f.saved(),null);
 await f.nodes['game-save'].onclick();f.nodes['save-name'].value='한글 저장';f.nodes['save-form'].onsubmit({preventDefault(){}});
 assert.equal(f.saved().games.length,1);assert.equal(f.saved().games[0].name,'한글 저장');assert.deepEqual(f.saved().games[0].snapshot.game.names,values(f).names);
 }finally{f.restore();}
});

test('result screen saved-games entry reuses the initial screen list and preserves game',async()=>{
 const f=await boot();try{
 assert.equal(f.nodes['saved-open-game'].onclick,f.nodes['saved-open'].onclick);
 fill(f,8);f.nodes.create.onclick();const before=values(f);
 f.nodes['saved-open-game'].onclick();assert.equal(f.nodes['saved-dialog'].open,true);
 assert.equal(f.nodes['saved-list'].children[0].textContent,'아직 저장된 게임이 없어요.');
 f.nodes['saved-close'].onclick();assert.deepEqual(values(f),before);assert.equal(f.nodes.game.hidden,false);
 }finally{f.restore();}
});
for(const count of [2,8,12,20])test(`summary ${count}: same rendered lines and slots, no randomness or animation`,async()=>{
 const f=await boot();const random=Math.random;
 try{
 fill(f,count);input(f,'names',0,'아주 긴 한글 참가자 이름을 그대로 표시');for(let i=0;i<count;i++)input(f,'results',i,i===1?'긴 한글 결과 간식 사기':'통과');
 f.nodes.create.onclick();const source=f.nodes.ladder.querySelectorAll('.rail,.rung').map(n=>({...n.attributes}));
 const names=f.nodes['top-labels'].children.map(n=>n.children[0].textContent),results=f.nodes['bottom-labels'].children.map(n=>n.children[0].textContent);
 Math.random=()=>{throw Error('summary must not randomize');};f.nodes.all.onclick();
 const board=f.nodes['summary-board'];assert.deepEqual(board.children[0].children.map(n=>n.textContent),names);assert.deepEqual(board.children[2].children.map(n=>n.textContent),results);
 assert.deepEqual(board.children[1].querySelectorAll('.rail,.rung').map(n=>n.attributes),source);assert.equal(board.querySelectorAll('button').length,count*2);assert.equal(board.querySelectorAll('.traveler,.active-path').length,0);
 assert.equal(f.nodes['summary-list'].children.length,count);assert.deepEqual(f.nodes.ladder.querySelectorAll('.rail,.rung').map(n=>n.attributes),source);
 f.nodes.back.onclick();assert.equal(f.nodes['play-area'].hidden,false);
 }finally{Math.random=random;f.restore();}
});
for(const count of [2,8,12,20])test(`summary routes ${count}: exact live paths, slot endpoints, highlight only`,async()=>{
 const {trace,pathData}=await import('../src/ladder.js');const {createLayout}=await import('../src/layout.js');const f=await boot();
 try{fill(f,count);for(let i=0;i<count;i++)input(f,'results',i,i===1?'술래':'통과');f.nodes.create.onclick();await f.nodes['game-save'].onclick();f.nodes['save-name'].value='경로';f.nodes['save-form'].onsubmit({preventDefault(){}});
 const before=f.saved(),g=before.games[0].snapshot.game,layout=createLayout(g.ladder,g.rhythm,1280,1000);f.nodes.all.onclick();
 const board=f.nodes['summary-board'],paths=board.children[1].querySelectorAll('.summary-route');assert.equal(paths.length,count);
 for(let i=0;i<count;i++){const r=trace(g.ladder,i);assert.equal(paths[i].getAttribute('d'),pathData(layout.points(r.points)));assert.equal(paths[i].getAttribute('data-end'),String(r.end));assert.equal(board.children[2].children[r.end].getAttribute('data-route-index'),String(i));}
 const end=trace(g.ladder,0).end;board.children[0].children[0].onclick();assert.equal(paths[0].getAttribute('opacity'),'1');assert.equal(paths[1].getAttribute('opacity'),'.14');assert.equal(board.children[2].children[end].getAttribute('aria-pressed'),'true');
 board.children[2].children[end].onclick();assert.ok(paths.every(p=>p.getAttribute('opacity')==='.78'));board.children[0].children[1].onclick();board.children[1].onclick();assert.ok(paths.every(p=>p.getAttribute('opacity')==='.78'));assert.deepEqual(f.saved(),before);
 }finally{f.restore();}
});
