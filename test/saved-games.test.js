import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,slotLabels} from '../src/game-state.js';
import {trace} from '../src/ladder.js';
import {createSavedGamesStore,SAVED_GAMES_KEY,gameSnapshot} from '../src/saved-games.js';
function fixture(){const data=new Map();let time=100,id=0;const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};return {data,storage,store:createSavedGamesStore(storage,()=>++time,()=>String(++id))};}
function game(n){return createGame(Array.from({length:n},(_,i)=>'참가자 '+i),Array.from({length:n},(_,i)=>i===1?'술래':'통과'));}
for(const n of [2,8,12,20])test(`${n} saved snapshot: deep equality, duplicate slots and both directions`,()=>{
 const f=fixture(),before=game(n);before.revealed=[[0,trace(before.ladder,0).end]];before.lastRoute={index:0,reverse:false};
 const record=f.store.save(' 테스트 ',before),loaded=f.store.load(record.id);
 assert.equal(loaded.name,'테스트');assert.deepEqual(loaded.snapshot.game,before);
 assert.deepEqual(slotLabels(loaded.snapshot.game),slotLabels(before));
 for(let i=0;i<n;i++){assert.equal(loaded.snapshot.endpoints[i],trace(before.ladder,i).end);assert.equal(loaded.snapshot.inverse[loaded.snapshot.endpoints[i]],i);}
 const again=createSavedGamesStore(f.storage).load(record.id);assert.deepEqual(again,loaded);
 before.names[0]='mutated';loaded.snapshot.game.ladder.rows[0].y=0;assert.notEqual(f.store.load(record.id).snapshot.game.names[0],'mutated');assert.ok(f.store.load(record.id).snapshot.game.ladder.rows[0].y>0);
});
test('multiple and same-name saves have unique IDs and newest-first ordering',()=>{
 const f=fixture();assert.deepEqual(f.store.list(),[]);const a=f.store.save('동일 이름',game(2)),b=f.store.save('동일 이름',game(8));assert.notEqual(a.id,b.id);assert.deepEqual(f.store.list().map(g=>g.id),[b.id,a.id]);
});
test('rename changes only name; delete only removes selected save',()=>{
 const f=fixture(),a=f.store.save('하나',game(2)),b=f.store.save('둘',game(8));f.store.rename(a.id,' 새 이름 ');assert.deepEqual(f.store.load(a.id),{...a,name:'새 이름'});f.store.remove(a.id);assert.deepEqual(f.store.list(),[b]);
});
test('shuffle/current edits never mutate saved original; update is explicit',()=>{
 const f=fixture(),a=f.store.save('원본',game(20)),opened=f.store.load(a.id);opened.snapshot.game=game(20);assert.deepEqual(f.store.load(a.id),a);
 const b=f.store.save('별도',opened.snapshot.game);assert.deepEqual(f.store.load(a.id),a);
 const updated=f.store.save(a.name,opened.snapshot.game,a.id);assert.equal(updated.id,a.id);assert.equal(updated.createdAt,a.createdAt);assert.ok(updated.updatedAt>a.updatedAt);assert.deepEqual(updated.snapshot.game,opened.snapshot.game);assert.deepEqual(f.store.load(b.id),b);
});
test('empty/long save names rejected, safe literal names accepted',()=>{
 const f=fixture();for(const name of ['', '  ', '가'.repeat(61)])assert.throws(()=>f.store.save(name,game(2)));
 const a=f.store.save('<img onerror=alert(1)>',game(2));assert.equal(a.name,'<img onerror=alert(1)>');assert.throws(()=>f.store.rename(a.id,' '));
});
test('bad JSON and unknown schemas are preserved without overwriting',()=>{
 for(const raw of ['{bad',JSON.stringify({schemaVersion:9,games:[]}),JSON.stringify({schemaVersion:1,games:[{}]})]){
 const f=fixture();f.data.set(SAVED_GAMES_KEY,raw);assert.throws(()=>f.store.list());assert.throws(()=>f.store.save('이름',game(2)));assert.equal(f.data.get(SAVED_GAMES_KEY),raw);
 }
});
test('corrupted endpoints, duplicate IDs, invalid ladder and record schema rejected',()=>{
 for(const change of [a=>a[0].snapshot.endpoints[0]=99,a=>a[0].snapshot.inverse[0]=99,a=>a.push(a[0]),a=>a[0].snapshot.game.ladder.rows[0].y=-1,a=>a[0].schemaVersion=2]){
 const f=fixture();f.store.save('게임',game(8));const raw=JSON.parse(f.data.get(SAVED_GAMES_KEY));change(raw.games);f.data.set(SAVED_GAMES_KEY,JSON.stringify(raw));assert.throws(()=>f.store.list());
 }
});
test('quota and blocked storage errors do not overwrite data',()=>{
 const f=fixture(),a=f.store.save('기존',game(2)),raw=f.data.get(SAVED_GAMES_KEY);f.storage.setItem=()=>{const e=new Error();e.name='QuotaExceededError';throw e;};assert.throws(()=>f.store.save('새 게임',game(8)),/저장 공간/);assert.deepEqual(f.store.load(a.id),a);assert.equal(f.data.get(SAVED_GAMES_KEY),raw);
 const denied=createSavedGamesStore({getItem(){throw Error('blocked');}});assert.throws(()=>denied.list(),/접근/);
});
test('preferences and legacy cleanup cannot erase saved games',async()=>{
 const f=fixture();f.store.save('보존',game(2));const original=globalThis.localStorage;globalThis.localStorage={...f.storage,removeItem:k=>f.data.delete(k)};
 try{const {read,save}=await import('../src/storage.js');const before=f.data.get(SAVED_GAMES_KEY);read();save({sound:false});assert.equal(f.data.get(SAVED_GAMES_KEY),before);}finally{globalThis.localStorage=original;}
});
test('missing IDs and invalid snapshots fail without changing other records',()=>{
 const f=fixture(),a=f.store.save('기존',game(2));for(const fn of [()=>f.store.load('missing'),()=>f.store.remove('missing'),()=>f.store.rename('missing','이름'),()=>f.store.save('이름',game(2),'missing'),()=>gameSnapshot({})])assert.throws(fn);assert.deepEqual(f.store.list(),[a]);
});
