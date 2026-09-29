import { COLUMN, trace, pathData } from './ladder.js';
import { animate } from './animation.js';
import { unlock, tone, setSoundEnabled } from './sound.js';
import { read, save } from './storage.js';
import { createPairedEditors } from './paired-editor.js';
import { choose } from './dialog.js';
import { makeFollower } from './follow.js';
import { createLayout } from './layout.js';
import { createGame, restoreGame, slotLabels } from './game-state.js';
import { createExportControls } from './export/controls.js';

const $ = id => document.getElementById(id);
const cached = read(), reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const initialInputs = {
  ...cached,
  names: cached.names ?? ['', ''],
  results: cached.results ?? ['', '']
};
let sound = cached.sound !== false, ladder, rhythm, layout, names = [], results = [], busy = false, prompting = false;
let activeGame = null, lastRoute = null, pendingResize = false;
const revealed = new Map();
function persist() {
  const game = activeGame ? { ...activeGame, revealed: [...revealed], lastRoute } : null;
  $('storage-note').textContent = save({ ...inputs.serialize(), sound, game }) ? '✓ 이 기기에 자동 저장됨' : '자동 저장이 안 돼요. 입력 내용을 따로 복사해주세요.';
}
function validate() {
  const { names: a, results: b } = inputs.state;
  $('name-count').textContent = a.length + '명'; $('result-count').textContent = b.length + '개';
  const error = inputs.problem();
  $('validation').textContent = error || '준비됐어요. 이제 사다리를 시작해볼까요?';
  $('validation').className = error ? 'error' : 'valid'; $('create').disabled = !!error;
  persist(); return !error;
}
const inputs = createPairedEditors(initialInputs, validate, choose);
const media = createExportControls(() => sound);
function syncSound() {
  $('sound').querySelector('.sound-wave').style.display = sound ? '' : 'none';
  $('sound').querySelector('.sound-slash').style.display = sound ? 'none' : '';
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').setAttribute('aria-label', sound ? '효과음 끄기' : '효과음 켜기');
  $('sound').title = sound ? '효과음 끄기' : '효과음 켜기';
}
$('sound').onclick = () => { sound = !sound; setSoundEnabled(sound); if (sound) unlock('tap'); syncSound(); persist(); };
// No autoplay on load; the first interaction (and a gesture after interruption) resumes audio.
for (const event of ['pointerdown', 'touchend', 'click']) document.addEventListener(event, e => {
  if (sound && !e.target.closest('#sound')) unlock();
}, { capture: true, passive: true });
const svgElement = (tag, attributes) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};
function makeMarker() {
  const marker = svgElement('g', { class: 'traveler' });
  marker.append(svgElement('circle', { r: 18, fill: '#f4bd4f', stroke: '#fff', 'stroke-width': 3 }),
    svgElement('path', { d: 'M-9,-7L-4,-9M4,-9L9,-7', fill:'none', stroke:'#49324c', 'stroke-width':1.8, 'stroke-linecap':'round' }),
    svgElement('circle', { cx: -6, cy: -2, r: 2, fill: '#49324c' }), svgElement('circle', { cx: 6, cy: -2, r: 2, fill: '#49324c' }),
    svgElement('ellipse', { cx:-11, cy:4, rx:3, ry:1.7, fill:'#eb8873' }), svgElement('ellipse', { cx:11, cy:4, rx:3, ry:1.7, fill:'#eb8873' }),
    svgElement('path', { class:'mouth', d: 'M-6,5Q0,13 7,3', fill: 'none', stroke: '#49324c', 'stroke-width': 2, 'stroke-linecap':'round' }));
  return marker;
}
function updateLabels() {
  $('progress').textContent = '확인 ' + revealed.size + ' / ' + names.length;
  for (const [id, labels, reverse] of [['top-labels', names, false], ['bottom-labels', results, true]]) {
    [...$(id).children].forEach((button, index) => {
      const known = reverse ? [...revealed.values()].includes(index) : revealed.has(index);
      const text = labels[index];
      button.querySelector('span').textContent = text; button.querySelector('small').textContent = known ? '✓' : '';
      button.classList.toggle('checked', known); button.classList.add('source-card');
      button.disabled = busy;
      button.title = text;
      button.setAttribute('aria-label', (index + 1) + '번 ' + text + (known ? ', 확인됨' : '') + (reverse ? ', 이름 찾기' : ', 결과 찾기'));
    });
  }
}
function setBusy(value) {
  busy = value; $('game').querySelectorAll('button').forEach(button => { button.disabled = value; });
  $('ladder-board').setAttribute('aria-busy', String(value)); $('game').classList.toggle('is-running', value);
  updateLabels();
  media.sync();
  if (!value && pendingResize) { pendingResize = false; resizeScene(); }
}
function scrollInfo() {
  if (!layout) return;
  const scroll = $('ladder-scroll'), overflow = scroll.scrollWidth > scroll.clientWidth + 2;
  $('scroll-hint').hidden = !overflow;
  $('scroll-position').textContent = overflow ? (Math.floor(scroll.scrollLeft / layout.column) + 1) + '–' + Math.min(names.length, Math.ceil((scroll.scrollLeft + scroll.clientWidth) / layout.column)) + ' / ' + names.length : '';
}
$('ladder-scroll').addEventListener('scroll', scrollInfo, { passive: true });
function renderGeometry() {
  const svg = $('ladder'); svg.replaceChildren();
  $('ladder-board').style.width = layout.width + 'px'; $('ladder-board').style.setProperty('--column', layout.column + 'px');
  svg.setAttribute('viewBox', '0 0 ' + layout.width + ' ' + layout.height); svg.setAttribute('width', layout.width); svg.setAttribute('height', layout.height);
  for (let i = 0; i < names.length; i++) svg.append(svgElement('path', { d: 'M' + ((i + .5) * layout.column) + ',0V' + layout.height, class: 'rail' }));
  for (const row of ladder.rows) for (const edge of row.edges) {
    const p = layout.point({x:(edge + .5) * COLUMN, y:row.y});
    svg.append(svgElement('path', { d:'M' + p.x + ',' + p.y + 'h' + layout.column, class:'rung' }));
  }
  if (lastRoute) {
    const points = layout.points(trace(ladder, lastRoute.index, lastRoute.reverse).points);
    svg.append(svgElement('path', {d:pathData(points),class:'active-path settled'}));
    const marker = makeMarker(), p = points.at(-1);
    marker.setAttribute('transform','translate(' + p.x + ' ' + p.y + ')'); svg.append(marker);
  }
}
function resizeScene() {
  if (!ladder || $('game').hidden || $('play-area').hidden) return;
  if (busy) { pendingResize = true; return; }
  const next = createLayout(ladder, rhythm, innerWidth, $('ladder-scroll').clientWidth);
  if (!layout || next.width !== layout.width || next.height !== layout.height) { layout = next; renderGeometry(); }
  scrollInfo();
}
new ResizeObserver(resizeScene).observe($('ladder-scroll'));
window.addEventListener('resize', resizeScene);
function showBoard() { $('play-area').hidden = false; $('summary').hidden = true; $('all').hidden = false; }
function draw(reset = true) {
  media.clear();
  if (reset) { revealed.clear(); lastRoute = null; }
  layout = null; showBoard(); $('summary-list').replaceChildren();
  for (const [id, labels, reverse] of [['top-labels', names, false], ['bottom-labels', results, true]]) {
    $(id).replaceChildren();
    labels.forEach((_, index) => {
      const button = document.createElement('button'), text = document.createElement('span'), small = document.createElement('small');
      small.setAttribute('aria-hidden', 'true'); button.append(text, small); button.onclick = () => run(index, reverse); $(id).append(button);
    });
  }
  $('announcement').textContent = '이름이나 결과를 눌러보세요!'; $('announcement').classList.remove('arrived');
  updateLabels(); resizeScene(); $('ladder-scroll').scrollLeft = 0;
}
function celebrate(button) {
  button.classList.add('landed');
  if (!reduced()) for (let i = 0; i < 8; i++) {
    const star = document.createElement('i'); star.className = 'confetti'; star.setAttribute('aria-hidden', 'true');
    const angle = i * Math.PI / 4; star.style.setProperty('--dx', Math.cos(angle) * 45 + 'px'); star.style.setProperty('--dy', Math.sin(angle) * 38 - 20 + 'px');
    star.style.setProperty('--rotation', i * 65 + 'deg'); button.append(star); setTimeout(() => star.remove(), 900);
  }
  setTimeout(() => button.classList.remove('landed'), 900);
}
async function run(index, reverse) {
  if (busy || prompting) return;
  media.clear();
  setBusy(true); if (sound) unlock('start');
  const route = trace(ladder, index, reverse), points = layout.points(route.points), svg = $('ladder');
  lastRoute = null; svg.querySelectorAll('.active-path, .path-head, .traveler').forEach(el => el.remove());
  $('game').querySelectorAll('.selected, .landed').forEach(el => el.classList.remove('selected', 'landed'));
  const source = $(reverse ? 'bottom-labels' : 'top-labels').children[index]; source.classList.add('selected');
  $('announcement').classList.remove('arrived'); $('announcement').textContent = (reverse ? results[index] : names[index]) + ' 출발! 두근두근…';
  const path = svgElement('path', { d:pathData(points),class:'active-path' }), head = svgElement('path',{d:pathData(points),class:'path-head'}), marker = makeMarker();
  path.style.visibility = head.style.visibility = 'hidden'; marker.setAttribute('transform','translate(' + points[0].x + ' ' + points[0].y + ')');
  svg.append(path,head,marker);
  const follow = makeFollower($('ladder-scroll'),svg,points[0],reduced());
  let lastTone = performance.now(), previousDirection = 0, tilt = 0;
  try {
    await animate(points,(point,progress,total,scale,segmentStart) => {
      const distance = total * progress;
      path.style.visibility = head.style.visibility = 'visible'; path.style.strokeDasharray = total; path.style.strokeDashoffset = total - distance;
      head.setAttribute('d',pathData([segmentStart,point]));
      marker.setAttribute('transform','translate(' + point.x + ' ' + point.y + ') rotate(' + tilt + ') scale(' + scale + ')'); follow(point);
    },(horizontal,dx) => {
      marker.querySelector('.mouth').setAttribute('d',horizontal ? 'M-6,3Q0,12 7,1' : 'M-6,5Q0,13 7,3');
      const now = performance.now(), direction = Math.sign(dx);
      tilt = reduced() ? 0 : horizontal ? direction * 8 : 0;
      if (horizontal && now-lastTone > 220) { tone(previousDirection && previousDirection !== direction ? 'turn' : 'swish',sound); lastTone = now; }
      if (horizontal) previousDirection = direction;
    },reduced());
    const start = reverse ? route.end : index, end = reverse ? index : route.end;
    revealed.set(start,end); lastRoute = {index,reverse}; updateLabels();
    const destination = $(reverse ? 'top-labels' : 'bottom-labels').children[route.end];
    destination.classList.add('selected'); celebrate(destination); marker.classList.add('hop'); path.classList.add('settled'); head.remove();
    const cheers = document.createElement('strong'), message = document.createElement('span');
    cheers.textContent = reverse ? '찾았다!' : '짜잔!'; message.textContent = (reverse ? results[end] + ' → ' + names[start] : names[start] + ' → ' + results[end]) + '!';
    $('announcement').replaceChildren(cheers,message); $('announcement').classList.add('arrived'); tone('finish',sound);
    media.set({ladder,rhythm,names,results,index,reverse});
    persist();
    destination.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced()?'instant':'smooth'});
  } catch { $('announcement').textContent = '잠깐 멈췄어요. 다시 눌러 출발해보세요.'; }
  finally { setBusy(false); source.focus({preventScroll:true}); }
}
function newLadder() {
  activeGame = createGame(names, inputs.state.results.map(s => s.trim()));
  ({ ladder, rhythm } = activeGame); results = slotLabels(activeGame); draw(); persist();
}
function focusStart() { $('top-labels').firstElementChild.focus({preventScroll:true}); }
$('create').onclick = () => {
  if (!validate()) return; if (sound) unlock();
  names = inputs.state.names.map(s => s.trim()); results = inputs.state.results.map(s => s.trim());
  $('setup').hidden = true; $('game').hidden = false; document.body.classList.add('playing');
  newLadder(); window.scrollTo({top:0,behavior:'instant'}); focusStart();
};
$('shuffle').onclick = async () => {
  if (busy || prompting) return;
  if (revealed.size) {
    prompting = true; const answer = await choose('다시 섞을까요?','다시 섞으면 연결 결과가 바뀌어요. 새로 섞을까요?',[{label:'다시 섞기',value:'shuffle'}]);
    prompting = false; if (answer !== 'shuffle') return;
  }
  newLadder(); window.scrollTo({top:0,behavior:'instant'}); focusStart();
};
$('all').onclick = () => {
  if (busy || prompting) return; $('summary-list').replaceChildren();
  names.forEach((name,start) => {
    const end = trace(ladder,start).end; revealed.set(start,end);
    const item = document.createElement('div'), person = document.createElement('span'), arrow = document.createElement('span'), result = document.createElement('strong');
    person.textContent = (start+1)+'. '+name; arrow.textContent = '→'; arrow.className = 'result-arrow'; result.textContent = results[end];
    item.append(person,arrow,result); $('summary-list').append(item);
  });
  updateLabels(); persist(); $('summary').hidden = false; $('play-area').hidden = true; $('all').hidden = true;
  $('announcement').textContent = '오늘의 주인공을 모두 찾았어요.'; $('announcement').classList.remove('arrived');
  $('summary-title').focus(); window.scrollTo({top:0,behavior:'instant'});
};
$('back').onclick = () => { showBoard(); resizeScene(); $('announcement').textContent = '같은 사다리에서 다시 출발해보세요.'; focusStart(); };
function edit() {
  if (busy || prompting) return;
  media.clear();
  activeGame = null;
  $('game').hidden = true; $('setup').hidden = false; document.body.classList.remove('playing'); validate(); inputs.focus();
}
$('edit').onclick = edit;
$('new').onclick = async () => {
  if (busy || prompting) return; prompting = true;
  const answer = await choose('새 게임을 시작할까요?','입력한 이름과 결과를 지우고 빈 2칸씩으로 시작해요.',[
    {label:'모두 지우고 새로 시작',value:'clear'}]);
  prompting = false;
  if (answer === 'clear') { inputs.clear(); edit(); }
};
setSoundEnabled(sound); syncSound();
const restored = restoreGame(cached.game, inputs.state.names.map(s => s.trim()), inputs.state.results.map(s => s.trim()));
if (restored) {
  activeGame = restored; ({ ladder, rhythm, names, lastRoute } = restored); results = slotLabels(restored);
  for (const [start, end] of restored.revealed) revealed.set(start, end);
  $('setup').hidden = true; $('game').hidden = false; document.body.classList.add('playing'); draw(false);
  if (lastRoute) {
    const { index, reverse } = lastRoute, end = trace(ladder, index, reverse).end;
    $('announcement').textContent = reverse ? '찾았다! ' + results[index] + ' → ' + names[end] + '!' : '짜잔! ' + names[index] + ' → ' + results[end] + '!';
    $('announcement').classList.add('arrived'); media.set({ladder,rhythm,names,results,index,reverse});
    $(reverse ? 'bottom-labels' : 'top-labels').children[index].classList.add('selected');
    $(reverse ? 'top-labels' : 'bottom-labels').children[end].classList.add('selected');
  }
}
validate();

