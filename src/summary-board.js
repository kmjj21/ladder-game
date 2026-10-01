import { trace, pathData } from './ladder.js';
// Presentation only: use the same route and coordinate mapping as live animation.
export function renderSummaryBoard({ source, layout, ladder, names, results }, root, doc = document) {
  root.replaceChildren();root.style.width=layout.width+'px';root.style.setProperty('--column',layout.column+'px');
  const routes=names.map((_,index)=>trace(ladder,index)), inverse=[];
  routes.forEach((route,index)=>{inverse[route.end]=index;});
  const paths=[],cards=[];let selected=null;
  const color=index=>'hsl('+Math.round((index*137.508+260)%360)+' 48% 43%)';
  function highlight(index){
    selected=selected===index?null:index;
    paths.forEach((path,i)=>{path.setAttribute('opacity',selected===null?'.78':selected===i?'1':'.14');path.setAttribute('stroke-width',selected===i?'5':names.length>12?'2.2':'3');});
    cards.forEach(({card,index:i})=>{card.setAttribute('aria-pressed',String(selected===i));card.classList.toggle('route-muted',selected!==null&&selected!==i);});
    if(selected!==null)svg.append(paths[selected]);
  }
  const labels=(values,reverse)=>{
    const row=doc.createElement('div');row.className='labels summary-labels';
    values.forEach((value,slot)=>{
      const index=reverse?inverse[slot]:slot,card=doc.createElement('button');card.type='button';card.className='summary-label';card.textContent=value;
      card.setAttribute('data-route-number',String(index+1));card.setAttribute('data-route-index',String(index));card.setAttribute('data-slot-index',String(slot));
      card.setAttribute('aria-label',(index+1)+'번 경로 강조: '+value);card.setAttribute('aria-pressed','false');card.style.setProperty('--route-color',color(index));
      card.onclick=()=>highlight(index);cards.push({card,index});row.append(card);
    });return row;
  };
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 '+layout.width+' '+layout.height,width:layout.width,height:layout.height,role:'img','aria-label':'전체 참가자의 실제 이동 경로. 카드를 눌러 경로를 강조하세요.'}))svg.setAttribute(key,value);
  for(const line of source.querySelectorAll('.rail,.rung')){
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class',line.getAttribute('class'));path.setAttribute('d',line.getAttribute('d'));svg.append(path);
  }
  routes.forEach((route,index)=>{
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');
    for(const [key,value] of Object.entries({class:'summary-route',d:pathData(layout.points(route.points)),fill:'none',stroke:color(index),'stroke-width':names.length>12?'2.2':'3','stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':'7 3','stroke-dashoffset':index*2.7,opacity:'.78','data-start':index,'data-end':route.end}))path.setAttribute(key,value);
    paths.push(path);svg.append(path);
  });
  svg.onclick=()=>highlight(null);
  root.append(labels(names,false),svg,labels(results,true));
}
