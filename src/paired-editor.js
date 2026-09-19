import { createEditor } from './editor.js';
import { migrateInputs, planChange, inputProblem } from './input-state.js';
export function createPairedEditors(saved, onChange, choose, makeEditor = createEditor) {
  let state=migrateInputs(saved), pending=false;
  const drafts={names:null,results:null};
  const editors={};
  const labels={names:'참가자',results:'결과'};
  async function change(side, values, detail) {
    if(pending) return;
    const other=side==='names'?'results':'names';
    const plan=planChange(state,side,values,detail.kind);
    if(plan.error) {
      if(detail.raw!==undefined) { drafts[side]=detail.raw; editors[side].draft(detail.raw,plan.error); }
      else editors[side].message(plan.error);
      onChange(); return;
    }
    if(plan.needsConfirm) {
      pending=true; editors.names.lock(true); editors.results.lock(true); onChange();
      const description=plan.removed.length===1
        ? labels[side]+'를 줄이면 마지막 '+labels[other]+' “'+plan.removed[0]+'”도 함께 삭제돼요. 계속할까요?'
        : labels[side]+'를 '+state[side].length+'개 → '+plan.state[side].length+'개로 줄이면 '+labels[other]+' '+plan.removed.length+'개도 함께 삭제돼요.';
      const answer=await choose('함께 삭제할까요?',description,[{label:'삭제',value:'delete'}]);
      pending=false; editors.names.lock(false); editors.results.lock(false);
      if(answer!=='delete') {
        // Neither committed list nor storage changed while the confirmation was open.
        drafts[side]=null; editors[side].set(state[side]); onChange(); editors[side].focus(detail.index||0); return;
      }
    }
    const changedCount=state[side].length!==plan.state[side].length;
    state=plan.state; drafts[side]=null;
    editors[side].set(state[side],{keepFocus:detail.kind==='edit',raw:detail.raw,flash:changedCount});
    // Do not overwrite an unrelated over-limit draft: it remains editable until fixed.
    if(drafts[other]===null) editors[other].set(state[other],{showBlanks:changedCount,flash:changedCount});
    onChange();
    if(['delete','add','paste'].includes(detail.kind)) editors[side].focus(detail.index||0);
  }
  for(const side of ['names','results']) {
    editors[side]=makeEditor(side,labels[side],(values,detail)=>change(side,values,detail));
    editors[side].set(state[side]);
    const draft=saved.inputDrafts?.[side];
    if(typeof draft==='string') {drafts[side]=draft;editors[side].draft(draft,'최대 20명까지 사용할 수 있어요. 입력 내용을 수정해주세요.');}
  }
  return {
    get state(){return state;},
    problem(){return pending?'삭제 여부를 선택해주세요.':Object.values(drafts).some(d=>d!==null)?'최대 20명까지 사용할 수 있어요. 입력 내용을 수정해주세요.':inputProblem(state);},
    serialize(){return {inputVersion:2,names:[...state.names],results:[...state.results],inputDrafts:{...drafts}};},
    focus(){editors.names.focus();},
    clear(){state={names:['',''],results:['','']};for(const side of ['names','results']){drafts[side]=null;editors[side].clear();editors[side].set(state[side]);}onChange();},
  };
}

