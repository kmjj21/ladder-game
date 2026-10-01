import { createSavedGamesStore, MAX_SAVE_NAME } from './saved-games.js';
import { choose } from './dialog.js';
export function createSavedGamesUI({ capture, restore, available }) {
  const $=id=>document.getElementById(id), store=createSavedGamesStore();
  let sourceId=null, mode=null;
  const status=message=>{$('saved-status').textContent=message;};
  function nameDialog(title, name, onSave) {
    $('save-title').textContent=title;$('save-name').value=name;$('save-name').maxLength=MAX_SAVE_NAME;
    $('save-error').textContent='';mode=onSave;$('save-confirm').disabled=!name.trim();$('save-dialog').showModal();$('save-name').focus();
  }
  $('save-name').oninput=()=>{$('save-confirm').disabled=!$('save-name').value.trim();$('save-error').textContent='';};
  $('save-cancel').onclick=()=>$('save-dialog').close();
  $('save-form').onsubmit=event=>{
    event.preventDefault();
    try { mode?.($('save-name').value);$('save-dialog').close(); }
    catch(error) { $('save-error').textContent=error.message; }
  };
  function renderList() {
    const list=$('saved-list');list.replaceChildren();$('saved-error').textContent='';
    try {
      const games=store.list();
      if(!games.length) {const empty=document.createElement('p');empty.textContent='아직 저장된 게임이 없어요.';list.append(empty);}
      for(const record of games) {
        const item=document.createElement('article'), title=document.createElement('strong'), detail=document.createElement('p'), actions=document.createElement('div');
        item.className='saved-item';title.textContent=record.name;
        detail.textContent=record.snapshot.game.names.length+'명 · '+new Date(record.updatedAt).toLocaleString('ko-KR')+' · '+record.id.slice(-6);
        actions.className='saved-actions';
        function button(label, action) {const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{try{await action();}catch(e){$('saved-error').textContent=e.message;}};actions.append(b);}
        button('불러오기',async()=>{
          if(!available())return;
          const answer=await choose('저장된 게임을 불러올까요?','현재 입력 대신 “'+record.name+'” 게임을 열어요.',[{label:'불러오기',value:'load'}]);
          if(answer!=='load')return;
          const loaded=store.load(record.id);restore(loaded.snapshot.game);sourceId=loaded.id;$('saved-dialog').close();status('“'+loaded.name+'” 게임을 불러왔어요.');
        });
        button('이름 변경',()=>nameDialog('저장 이름 변경',record.name,name=>{store.rename(record.id,name);renderList();}));
        button('삭제',async()=>{
          const answer=await choose('저장된 게임을 삭제할까요?','“'+record.name+'”을 삭제하면 되돌릴 수 없어요.',[{label:'삭제',value:'delete'}]);
          if(answer==='delete'){store.remove(record.id);if(sourceId===record.id)sourceId=null;renderList();}
        });
        item.append(title,detail,actions);list.append(item);
      }
    } catch(error) { $('saved-error').textContent=error.message; }
  }
  $('saved-open-game').onclick=$('saved-open').onclick=()=>{if(!available())return;renderList();$('saved-dialog').showModal();};
  $('saved-close').onclick=()=>$('saved-dialog').close();
  $('game-save').onclick=async()=>{
    if(!available())return;
    try {
      const game=capture();if(!game)return;
      let source=null;
      if(sourceId){source=store.list().find(g=>g.id===sourceId);if(!source)sourceId=null;}
      if(source) {
        const answer=await choose('게임 저장하기','이 게임은 “'+source.name+'”에서 불러왔어요.',[{label:'현재 저장본 업데이트',value:'update'},{label:'새 이름으로 저장',value:'new'}]);
        if(!answer)return;
        if(answer==='update'){store.save(source.name,game,source.id);status('“'+source.name+'” 저장본을 업데이트했어요.');return;}
      }
      nameDialog('게임 저장하기','',name=>{const record=store.save(name,game);sourceId=record.id;status('“'+record.name+'” 게임을 저장했어요.');});
    }catch(error){status(error.message);}
  };
  return { clearSource(){sourceId=null;status('');} };
}
