export { parseList } from './input-state.js';
import { parseList } from './input-state.js';
export function createEditor(id, label, onChange) {
  const textarea = document.getElementById(id), root = document.getElementById(id + '-editor');
  const toolbar = document.createElement('div'); toolbar.className = 'editor-modes'; toolbar.setAttribute('role','group'); toolbar.setAttribute('aria-label',label+' 입력 방식');
  const bulkButton = document.createElement('button'), rowButton = document.createElement('button');
  bulkButton.textContent='한 번에 입력'; rowButton.textContent='하나씩 편집';
  bulkButton.setAttribute('aria-label',label+' 한 번에 입력'); rowButton.setAttribute('aria-label',label+' 하나씩 편집');
  toolbar.append(bulkButton,rowButton); root.insertBefore(toolbar,textarea);
  const rows=document.createElement('div'); rows.className='entry-rows'; root.append(rows);
  const add=document.createElement('button'); add.textContent='+ '+label+' 추가'; add.className='add-entry'; root.append(add);
  const notice=document.createElement('p'); notice.className='input-notice'; notice.setAttribute('role','status'); root.append(notice);
  let values=[], mode='rows', draft=null, locked=false;
  function renderRows() {
    rows.replaceChildren();
    values.forEach((value,index)=>{
      const row=document.createElement('div'); row.className='entry-row';
      const number=document.createElement('span'); number.textContent=index+1;
      const input=document.createElement('input'); input.type='text'; input.value=value; input.autocomplete='off'; input.placeholder=id==='names'?'이름을 입력하세요':'결과를 입력하세요'; input.setAttribute('aria-label',label+' '+(index+1));
      const submit=()=>{ const next=[...values]; next[index]=input.value; onChange(next,{kind:'edit',index}); };
      input.oninput=event=>{ if(!event.isComposing) submit(); }; input.oncompositionend=submit;
      input.onpaste=event=>{
        const text=event.clipboardData?.getData('text');
        if(!text || !/[\r\n,，]/.test(text)) return;
        event.preventDefault();
        const next=[...values]; next.splice(index,1,...parseList(text));
        // Preserve an over-limit multi-row paste in the editable bulk draft.
        if(next.length>20) { mode='bulk'; draft=next.join('\n'); textarea.value=draft; syncMode(); }
        onChange(next,{kind:'paste',index,raw:next.join('\n')});
      };
      const remove=document.createElement('button'); remove.textContent='×'; remove.setAttribute('aria-label',label+' '+(index+1)+' 삭제');
      remove.onclick=()=>{ const next=[...values]; next.splice(index,1); onChange(next,{kind:'delete',index}); };
      row.append(number,input,remove); rows.append(row);
    });
  }
  function syncMode(){
    textarea.hidden=mode!=='bulk'; rows.hidden=mode!=='rows'; add.hidden=mode!=='rows';
    bulkButton.setAttribute('aria-pressed',String(mode==='bulk')); rowButton.setAttribute('aria-pressed',String(mode==='rows'));
    rowButton.disabled=locked || draft!==null;
    bulkButton.disabled=locked; textarea.disabled=locked; rows.querySelectorAll('input,button').forEach(el=>el.disabled=locked);
    add.disabled=locked || draft!==null || values.length>=20;
  }
  function setMode(next) { mode=next; if(mode==='bulk' && draft===null) textarea.value=values.join('\n'); syncMode(); focus(); }
  function focus(index=0) { (mode==='bulk'?textarea:rows.querySelectorAll('input')[Math.min(index,values.length-1)]||add).focus(); }
  const submitBulk=()=>onChange(parseList(textarea.value),{kind:'bulk',raw:textarea.value});
  textarea.oninput=event=>{if(!event.isComposing) submitBulk();}; textarea.oncompositionend=submitBulk;
  bulkButton.onclick=()=>setMode('bulk'); rowButton.onclick=()=>setMode('rows');
  add.onclick=()=>onChange([...values,''],{kind:'add',index:values.length});
  return {
    set(next, options={}) {
      const previousHeight=rows.getBoundingClientRect().height;
      const previous=values.length; values=[...next]; draft=null; notice.textContent='';
      if(!options.keepFocus || mode!=='rows') renderRows();
      if(options.raw!==undefined && mode==='bulk') textarea.value=options.raw;
      else if(mode==='bulk') textarea.value=values.join('\n');
      if(options.showBlanks && values.length>previous) {mode='rows'; renderRows();}
      syncMode();
      if(options.flash) {
        const nextHeight=rows.getBoundingClientRect().height;
        if(values.length<previous && mode==='rows' && previousHeight>nextHeight && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          rows.animate([{height:previousHeight+'px'},{height:nextHeight+'px'}],{duration:180,easing:'ease-out'});
        }
        root.classList.remove('sync-changed'); void root.offsetWidth; root.classList.add('sync-changed');
        if(values.length>previous) [...rows.children].slice(previous).forEach(row=>row.classList.add('new-entry'));
      }
    },
    draft(raw,error){ draft=raw; mode='bulk'; textarea.value=raw; notice.textContent=error; syncMode(); },
    lock(value){locked=value;syncMode();},
    message(text){notice.textContent=text;},
    focus,
    clear(){mode='rows';draft=null;},
  };
}

