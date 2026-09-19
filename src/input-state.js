export const parseList = value => value.split(/[\r\n,，]+/).map(s => s.trim()).filter(Boolean);
const list = value => Array.isArray(value) ? value.map(s => typeof s === 'string' ? s : '') : typeof value === 'string' ? parseList(value) : [];
export function migrateInputs(saved) {
  const names = list(saved.names), results = list(saved.results);
  const count = Math.max(2, names.length, results.length);
  return { names: [...names, ...Array(count - names.length).fill('')], results: [...results, ...Array(count - results.length).fill('')] };
}
export function planChange(state, side, values, kind = 'edit') {
  const other = side === 'names' ? 'results' : 'names';
  if (kind === 'delete' && state[side].length <= 2) return { error: '사다리는 최소 2명부터 시작할 수 있어요.' };
  if (values.length > 20 && kind !== 'delete') return { error: '최대 20명까지 사용할 수 있어요. 입력 내용을 수정해주세요.' };
  const next = [...values]; while (next.length < 2) next.push('');
  const removed = state[other].slice(next.length);
  const peers = state[other].slice(0, next.length); while (peers.length < next.length) peers.push('');
  return { state: { ...state, [side]: next, [other]: peers }, removed, other, needsConfirm: removed.some(s => s.trim() !== '') };
}
export function inputProblem(state) {
  if (state.names.length > 20) return '최대 20명까지 사용할 수 있어요. 입력 내용을 수정해주세요.';
  if (state.names.length < 2) return '사다리는 최소 2명부터 시작할 수 있어요.';
  const names = state.names.filter(s => !s.trim()).length, results = state.results.filter(s => !s.trim()).length;
  if (names && results) return '이름 ' + names + '개와 결과 ' + results + '개만 입력하면 출발!';
  if (names) return '이름 ' + names + '개만 입력하면 출발!';
  if (results) return '결과 ' + results + '개만 입력하면 출발!';
  return '';
}
