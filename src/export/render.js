import { replayPlan, replayFrame } from './model.js';

const FONT = "'Apple SD Gothic Neo','Malgun Gothic',sans-serif";
export function wrapText(ctx, text, width) {
  const lines = []; let line = '';
  for (const char of Array.from(text)) {
    if (char === '\n') { lines.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
    line += char;
  }
  lines.push(line); return lines;
}
function box(ctx, x, y, w, h, fill, stroke = '#e3dcec') {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.arcTo(x + w, y, x + w, y + h, 12);
  ctx.arcTo(x + w, y + h, x, y + h, 12); ctx.arcTo(x, y + h, x, y, 12);
  ctx.arcTo(x, y, x + w, y, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function line(ctx, points, color, width) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke();
}
function face(ctx, x, y, rotation, scale) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fillStyle = '#f4bd4f'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#49324c';
  for (const eye of [-6, 6]) { ctx.beginPath(); ctx.arc(eye, -2, 2, 0, Math.PI * 2); ctx.fill(); }
  line(ctx, [{x:-9,y:-7},{x:-4,y:-9}], '#49324c', 1.8);
  line(ctx, [{x:4,y:-9},{x:9,y:-7}], '#49324c', 1.8);
  ctx.fillStyle = '#eb8873'; for(const cheek of [-11,11]) {ctx.beginPath();ctx.ellipse(cheek,4,3,1.7,0,0,Math.PI*2);ctx.fill();}
  ctx.beginPath(); ctx.moveTo(-6, 5); ctx.quadraticCurveTo(0, 13, 7, 3); ctx.strokeStyle = '#49324c'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}

export function createRenderer(snapshot, kind = 'image') {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const width = Math.max(1280, snapshot.boardWidth + 64), cardWidth = snapshot.column - 8;
  ctx.font = `14px ${FONT}`;
  const nameLines = snapshot.names.map(text => wrapText(ctx, text, cardWidth - 14));
  const resultLines = snapshot.results.map(text => wrapText(ctx, text, cardWidth - 14));
  const topHeight = Math.max(66, ...nameLines.map(lines => lines.length * 18 + 28));
  const bottomHeight = Math.max(66, ...resultLines.map(lines => lines.length * 18 + 28));
  ctx.font = `bold 24px ${FONT}`;
  const messageLines = wrapText(ctx, snapshot.message, width - 120);
  const boardY = 116 + topHeight, bottomY = boardY + snapshot.boardHeight;
  const footerY = bottomY + bottomHeight + 26;
  const height = Math.max(720, footerY + messageLines.length * 32 + 76);
  if (height > 4000) throw new Error('text-too-long');
  const scale = kind === 'image' ? Math.min(2, 4096 / width, 4096 / height, Math.sqrt(6000000 / (width * height))) : Math.min(1, 1920 / width, 1080 / height);
  canvas.width = Math.floor(width * scale / 2) * 2; canvas.height = Math.floor(height * scale / 2) * 2;
  const xOffset = (width - snapshot.boardWidth) / 2;
  const replay = replayPlan(snapshot);
  function draw(elapsed = replay.duration) {
    const frame = replayFrame(replay, elapsed);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.fillStyle = '#f8f7fc'; ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#302c44'; ctx.font = `bold 30px ${FONT}`;
    ctx.fillText('오늘은 누가 걸릴까?', width / 2, 42);
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#847196'; ctx.fillText(snapshot.reverse ? '결과 → 사람' : '사람 → 결과', width / 2, 79);
    function cards(texts, lines, y, h, selected, destination) {
      texts.forEach((text, i) => {
        const active = i === selected, pop = active && destination && frame.arrived && frame.arrivalTime < 600 ? Math.sin(frame.arrivalTime / 600 * Math.PI) * 0.04 : 0;
        const cx = xOffset + (i + 0.5) * snapshot.column;
        ctx.save(); ctx.translate(cx, y + h / 2); ctx.scale(1 + pop, 1 + pop);
        box(ctx, -cardWidth / 2, -h / 2, cardWidth, h, active ? destination && frame.arrived ? '#fff1cc' : '#eee8fa' : '#fff', active ? '#a18ac4' : '#e3dcec');
        ctx.fillStyle = '#8b8199'; ctx.font = `10px ${FONT}`; ctx.fillText(String(i + 1), 0, -h / 2 + 12);
        ctx.font = `14px ${FONT}`; ctx.fillStyle = active ? '#573b79' : '#514863';
        // The recorded forward reveal happens at arrival; all slots remain in frame.
        const displayed = destination && !frame.arrived && !snapshot.reverse ? ['?'] : lines[i];
        displayed.forEach((part, j) => ctx.fillText(part, 0, 7 + (j - (displayed.length - 1) / 2) * 18)); ctx.restore();
      });
    }
    cards(snapshot.names, nameLines, 110, topHeight, snapshot.start, snapshot.reverse);
    cards(snapshot.results, resultLines, bottomY + 6, bottomHeight, snapshot.end, !snapshot.reverse);
    ctx.save(); ctx.translate(xOffset, boardY);
    for (let i = 0; i < snapshot.count; i++) line(ctx, [{x:(i+.5)*snapshot.column,y:0},{x:(i+.5)*snapshot.column,y:snapshot.boardHeight}], '#c7c3ce', 2);
    for (const row of snapshot.rows) for (const edge of row.edges) line(ctx, [{x:(edge+.5)*snapshot.column,y:row.y},{x:(edge+1.5)*snapshot.column,y:row.y}], '#c7c3ce', 2);
    const segment = replay.plan.segments[frame.index];
    const traveled = [...snapshot.points.slice(0, frame.index + 1), frame.point];
    line(ctx, traveled, frame.arrived ? '#916ab9' : '#ad96c9', frame.arrived ? 4 : 3.5);
    if (!frame.arrived && frame.started) line(ctx, [segment.a, frame.point], '#652cb5', 6);
    const jump = frame.arrived && frame.arrivalTime < 550 ? Math.sin(frame.arrivalTime / 550 * Math.PI) * 9 : 0;
    const bounce = frame.started && !frame.arrived ? 1 + Math.sin(frame.t * Math.PI) * (frame.horizontal ? .12 : .04) : 1;
    face(ctx, frame.point.x, frame.point.y - jump, frame.horizontal && !frame.arrived ? Math.sign(segment.b.x-segment.a.x)*.14 : 0, bounce);
    if (frame.arrived && frame.arrivalTime < 900) {
      const t=frame.arrivalTime/900;
      for(let i=0;i<8;i++) {ctx.fillStyle=i%2?'#eab952':'#c49be9';ctx.globalAlpha=1-t;ctx.fillRect(frame.point.x+Math.cos(i*Math.PI/4)*t*48,frame.point.y+Math.sin(i*Math.PI/4)*t*32-t*20,4,7);}
      ctx.globalAlpha=1;
    }
    ctx.restore();
    box(ctx, 32, footerY, width - 64, height - footerY - 24, frame.arrived ? '#fff7de' : '#f0ebfa');
    ctx.fillStyle = frame.arrived ? '#83591a' : '#746184'; ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(frame.arrived ? snapshot.reverse ? '찾았다!' : '짜잔!' : '두근두근, 출발!', width / 2, footerY + 25);
    ctx.font = `bold 24px ${FONT}`;
    if (frame.arrived) messageLines.forEach((part,i)=>ctx.fillText(part,width/2,footerY+58+i*32));
    return frame;
  }
  return { canvas, draw, replay, dispose(){canvas.width=canvas.height=1;} };
}
