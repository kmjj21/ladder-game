import { restoreGame } from './game-state.js';
import { trace } from './ladder.js';
export const SAVED_GAMES_KEY = 'ladder-game:saved-games:v1';
export const MAX_SAVE_NAME = 60;
const copy = value => JSON.parse(JSON.stringify(value));
const failure = message => { throw new Error(message); };
export function normalizeSaveName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) failure('저장할 이름을 입력해주세요.');
  if (name.length > MAX_SAVE_NAME) failure('이름은 60자 이내로 입력해주세요.');
  return name;
}
export function gameSnapshot(value) {
  const game = restoreGame(value, value?.names, value?.inputResults);
  if (!game) failure('게임 데이터를 확인할 수 없어요.');
  // Store both directions by slot, never by result text (duplicate labels are valid).
  const endpoints = game.names.map((_, i) => trace(game.ladder, i).end);
  const inverse = game.names.map((_, i) => trace(game.ladder, i, true).end);
  return { game, endpoints, inverse };
}
function validRecord(value) {
  try {
    if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id ||
      normalizeSaveName(value.name) !== value.name || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) return false;
    const expected = gameSnapshot(value.snapshot?.game);
    return JSON.stringify(expected.endpoints) === JSON.stringify(value.snapshot.endpoints) && JSON.stringify(expected.inverse) === JSON.stringify(value.snapshot.inverse);
  } catch { return false; }
}
export function createSavedGamesStore(storage = { getItem:key=>localStorage.getItem(key), setItem:(key,value)=>localStorage.setItem(key,value) }, now = Date.now, id = () => crypto.randomUUID()) {
  function records() {
    let raw;
    try { raw = storage.getItem(SAVED_GAMES_KEY); } catch { return failure('이 브라우저에서 저장된 게임에 접근할 수 없어요.'); }
    if (raw === null) return [];
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return failure('저장된 게임 데이터를 읽을 수 없어요. 기존 데이터는 그대로 보관했어요.'); }
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.games)) failure('지원하지 않는 저장 형식이에요. 기존 데이터는 그대로 보관했어요.');
    if (!parsed.games.every(validRecord) || new Set(parsed.games.map(v => v.id)).size !== parsed.games.length) failure('저장된 게임에 손상된 데이터가 있어요. 기존 데이터는 그대로 보관했어요.');
    return parsed.games;
  }
  function write(games) {
    try { storage.setItem(SAVED_GAMES_KEY, JSON.stringify({schemaVersion:1, games})); }
    catch(error) { failure(error.name === 'QuotaExceededError' ? '저장 공간이 부족해요. 오래된 게임을 삭제한 뒤 다시 시도해주세요.' : '게임을 저장하지 못했어요. 브라우저 저장 설정을 확인해주세요.'); }
  }
  function find(games, recordId) { const record = games.find(g => g.id === recordId); if (!record) failure('저장된 게임이 없어요. 목록을 다시 열어주세요.'); return record; }
  return {
    list() { return copy(records().sort((a,b) => b.updatedAt-a.updatedAt || b.createdAt-a.createdAt)); },
    load(recordId) { return copy(find(records(), recordId)); },
    save(name, game, recordId = null) {
      name = normalizeSaveName(name); const snapshot = gameSnapshot(game), games = records(), time = now();
      let record;
      if (recordId !== null) { record = find(games, recordId); Object.assign(record, {name, snapshot, updatedAt:time}); }
      else { record = {schemaVersion:1, id:id(), name, createdAt:time, updatedAt:time, snapshot}; if(games.some(g=>g.id===record.id)) failure('저장 ID가 중복됐어요. 다시 시도해주세요.'); games.push(record); }
      write(games); return copy(record);
    },
    rename(recordId, name) { name=normalizeSaveName(name);const games=records(), record=find(games,recordId);record.name=name;write(games);return copy(record); },
    remove(recordId) { const games=records();find(games,recordId);write(games.filter(g=>g.id!==recordId)); }
  };
}
