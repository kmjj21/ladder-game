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
async function boot(saved) {
  const originals=Object.fromEntries(['document','window','localStorage','matchMedia','ResizeObserver','innerWidth'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),nodes={};
  for(const [,tag,attrs,id] of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node=nodes[id]=new Element(tag);node.hidden=/\bhidden\b/.test(attrs);node.placeholder=attrs.match(/placeholder="([^"]*)"/)?.[1]||'';
  }
  for(const side of ['names','results'])nodes[side+'-editor'].append(nodes[side]);
  for(const name of ['sound-wave','sound-slash']){const node=new Element('path');node.classList.add(name);nodes.sound.append(node);}
  let stored=saved===undefined?null:JSON.stringify(saved);
  const globals={
    document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),body:new Element('body'),addEventListener(){}},
    window:{addEventListener(){},scrollTo(){}},
    localStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;}},
    matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},innerWidth:1280,
  };
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const restore=()=>{for(const [key,descriptor] of Object.entries(originals))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
  try{await import(`../src/app.js?initial-state=${++serial}`);}catch(error){restore();throw error;}
  return {nodes,restore,read:()=>JSON.parse(stored),rows:side=>nodes[side+'-editor'].querySelectorAll('input')};
}
const empty={names:['',''],results:['','']};
const user={names:['민수','영희','지영'],results:['통과','통과','당번'],sound:false};
function values(f){return {names:f.rows('names').map(n=>n.value),results:f.rows('results').map(n=>n.value)};}
function input(f,side,index,value){const node=f.rows(side)[index];node.value=value;node.oninput({isComposing:true});}

test('A: no localStorage starts with exactly two empty participant/result values',async()=>{
  const f=await boot();try{assert.deepEqual(values(f),empty);assert.equal(f.read().game,null);}finally{f.restore();}
});
test('B: empty row and bulk inputs display the requested placeholders',async()=>{
  const f=await boot();try{for(const [side,label] of [['names','이름을 입력하세요'],['results','결과를 입력하세요']]) {
    assert.equal(f.nodes[side].placeholder,label);assert.ok(f.rows(side).every(n=>n.placeholder===label));
  }}finally{f.restore();}
});
test('C: placeholders are never persisted as user input',async()=>{
  const f=await boot();try{assert.deepEqual({names:f.read().names,results:f.read().results},empty);assert.ok(f.nodes.create.disabled);}finally{f.restore();}
});
test('D: saved arrays, legacy strings and exact former sample values are preserved',async()=>{
  const samples={names:['민수','영희','지영','준호','수빈','지우','현우','서연'],results:['간식 사기','통과','통과','오늘의 당번','통과','통과','통과','면제']};
  for(const saved of [user,{names:user.names.join('\n'),results:user.results.join('\n')},samples]) {
    const f=await boot(saved);try{
      const expected={names:Array.isArray(saved.names)?saved.names:saved.names.split('\n'),results:Array.isArray(saved.results)?saved.results:saved.results.split('\n')};
      assert.deepEqual(values(f),expected);assert.deepEqual({names:f.read().names,results:f.read().results},expected);
    }finally{f.restore();}
  }
});
test('E: new-game cancel preserves data; confirm clears inputs and persisted game',async()=>{
  const f=await boot(user);let saved;
  try {
    f.nodes.create.onclick();f.nodes.all.onclick();const before=f.read();assert.equal(before.game.revealed.length,3);
    let pending=f.nodes.new.onclick();assert.equal(f.nodes['choice-actions'].children.length,1);
    f.nodes['choice-cancel'].onclick();await pending;assert.deepEqual(f.read(),before);
    pending=f.nodes.new.onclick();f.nodes['choice-actions'].firstElementChild.onclick();await pending;
    assert.deepEqual(values(f),empty);assert.equal(f.read().game,null);assert.equal(f.nodes.setup.hidden,false);assert.equal(f.nodes.game.hidden,true);assert.equal(f.nodes.create.disabled,true);
    saved=f.read();
    for(const side of ['names','results'])for(let i=0;i<2;i++)input(f,side,i,side==='names'?'새 이름'+i:'새 결과'+i);
    f.nodes.create.onclick();assert.deepEqual(f.read().game.revealed,[]);assert.equal(f.read().game.lastRoute,null);assert.equal(f.read().game.resultOrder.length,2);
  }finally{f.restore();}
  const restored=await boot(saved);try{assert.deepEqual(values(restored),empty);assert.equal(restored.nodes.game.hidden,true);}finally{restored.restore();}
});
test('F: shuffle preserves names/results and clears revealed game progress',async()=>{
  const f=await boot(user);try{
    f.nodes.create.onclick();f.nodes.all.onclick();const pending=f.nodes.shuffle.onclick();f.nodes['choice-actions'].firstElementChild.onclick();await pending;
    assert.deepEqual(values(f),{names:user.names,results:user.results});assert.deepEqual(f.read().names,user.names);assert.deepEqual(f.read().results,user.results);
    assert.deepEqual(f.read().game.revealed,[]);assert.equal(f.read().game.lastRoute,null);
  }finally{f.restore();}
});
test('G: empty inputs cannot start even if the start handler is invoked directly',async()=>{
  const f=await boot();try{assert.equal(f.nodes.create.disabled,true);f.nodes.create.onclick();assert.equal(f.nodes.game.hidden,true);assert.equal(f.read().game,null);}finally{f.restore();}
});
test('H: filling all two names/results enables start; blank synchronized slot disables it',async()=>{
  const f=await boot();try{
    input(f,'names',0,'민수');input(f,'names',1,'영희');input(f,'results',0,'통과');assert.equal(f.nodes.create.disabled,true);
    input(f,'results',1,'당번');assert.equal(f.nodes.create.disabled,false);
    f.nodes['names-editor'].children.find(n=>n.className==='add-entry').onclick();
    assert.equal(f.nodes.create.disabled,true);assert.deepEqual(values(f),{names:['민수','영희',''],results:['통과','당번','']});
    input(f,'names',2,'지영');input(f,'results',2,'간식');assert.equal(f.nodes.create.disabled,false);f.nodes.create.onclick();assert.equal(f.nodes.game.hidden,false);
  }finally{f.restore();}
});
