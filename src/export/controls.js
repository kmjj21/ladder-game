import { snapshotResult, mediaFilename } from './model.js';
import { exportImage } from './image.js';
import { exportVideo } from './video.js';
import { videoSupported } from './support.js';
import { prepareAudio } from './audio.js';
import { canShareFile, shareFile } from './share.js';

export function createExportControls(getSound, dependencies={}) {
  const $=id=>document.getElementById(id), root=$('export-controls');
  const image=dependencies.exportImage||exportImage, video=dependencies.exportVideo||exportVideo, supported=dependencies.videoSupported||videoSupported, audioFor=dependencies.prepareAudio||prepareAudio;
  const gif=dependencies.exportGif||((snapshot,signal)=>import('./gif.js').then(module=>module.exportGif(snapshot,signal)));
  let snapshot=null, generating=false, url=null, aborter=null, revision=0, currentFile=null, currentKind=null, sharing=false, focusShare=false;
  function release() {
    $('export-video-preview').pause();$('export-video-preview').removeAttribute('src');$('export-video-preview').load();
    $('export-image-preview').removeAttribute('src');
    $('export-download').removeAttribute('href');$('export-open').removeAttribute('href');
    if(url) URL.revokeObjectURL(url);url=null;currentFile=null;currentKind=null;
    $('export-ready').hidden=true;$('export-preview').open=false;
  }
  function sync() {root.hidden=!snapshot;for(const id of ['export-image','export-video','result-share','export-share','export-dismiss']) $(id).disabled=generating||sharing||!snapshot;root.setAttribute('aria-busy',String(generating||sharing));}
  function clear() {$('share-choice').close();focusShare=false;revision++;aborter?.abort();aborter=null;snapshot=null;generating=false;release();$('export-status').textContent='';sync();}
  async function deliver(blob,extension,kind,silentFallback,intent) {
    release();url=URL.createObjectURL(blob);currentKind=kind;
    const filename=mediaFilename(extension), link=$('export-download');link.href=url;link.download=filename;
    $('export-open').href=url;$('export-ready').hidden=false;
    link.textContent=kind==='gif'?'GIF 저장':'파일 다시 저장';
    $('export-open').textContent=kind==='gif'?'GIF 미리보기 열기':'미리보기 열기';
    const video=kind==='video';$('export-video-preview').hidden=!video;$('export-image-preview').hidden=video;
    $(video?'export-video-preview':'export-image-preview').src=url;
    let share=false;
    try {currentFile=new File([blob],filename,{type:blob.type});share=canShareFile(currentFile);} catch {currentFile=null;}
    $('export-share').hidden=!share;
    if(kind==='gif') {$('export-preview').open=true;$('export-image-preview').alt='움직이는 사다리 결과 GIF';}
    else $('export-image-preview').alt='생성된 사다리 결과 이미지';
    $('export-status').textContent=(kind==='gif'?'GIF를 만들었어요.':video?'영상을 만들었어요.':'이미지를 만들었어요.')+(silentFallback?' 이 브라우저에서는 소리 없이 만들었어요.':'')+' 저장이 안 되면 아래에서 다시 저장하거나 미리보기를 열어주세요.';
    if(intent==='share') {await sendShare(false);return;}
    if('download' in link) link.click();
    else {$('export-preview').open=true;$('export-status').textContent='파일이 준비됐어요. 미리보기 또는 공유 버튼에서 파일에 저장하세요.';}
  }
  async function save(kind,intent='save') {
    if(generating || sharing || !snapshot) return;
    if(kind==='video' && !supported()) {$('export-status').textContent='이 브라우저에서는 영상 저장을 지원하지 않아요. 결과 이미지는 저장할 수 있어요.';return;}
    generating=true;sync();const version=revision, captured=snapshot, sound=getSound();
    aborter=new AbortController();
    const audio=kind==='video'?audioFor(sound):null;
    $('export-status').textContent=kind==='gif'?'움직이는 결과 만드는 중…':intent==='share'?(kind==='video'?'공유 영상 만드는 중...':'공유 이미지 만드는 중...'):kind==='video'?'영상 만드는 중… 잠시만 기다려주세요.':'이미지 만드는 중…';
    try {
      if(kind==='gif') {const blob=await gif(captured,aborter.signal);if(version===revision) await deliver(blob,'gif',kind,false,intent);}
      else if(kind==='image') {const blob=await image(captured);if(version===revision) await deliver(blob,'png',kind,false,intent);}
      else {const result=await video(captured,audio,aborter.signal);if(version===revision) await deliver(result.blob,result.extension,kind,sound&&!result.withAudio,intent);}
    } catch(error) {
      if(version===revision && error.name!=='AbortError') $('export-status').textContent=error.message==='background'?'화면을 열어 둔 채 다시 저장해주세요.':'저장하지 못했어요. 다시 시도해주세요. 결과 이미지는 따로 저장할 수 있어요.';
    } finally {if(version===revision){generating=false;aborter=null;sync();if(focusShare){focusShare=false;$('export-share').focus();}}}
  }
  $('export-image').onclick=()=>save('image');$('export-video').onclick=()=>{$('share-choice').close();return save('video');};
  async function sendShare(gesture) {
    if(sharing) return;
    const version=revision;sharing=true;sync();
    try {
      const outcome=await shareFile(currentFile,{gesture});
      if(version!==revision) return;
      if(outcome==='unsupported') {
        $('export-download').click();
        $('export-status').textContent=currentKind==='gif'?'GIF가 준비됐어요. GIF 저장 또는 미리보기 열기를 이용해주세요.':'이 브라우저에서는 파일 저장으로 이어져요. 저장이 안 되면 아래에서 다시 저장해주세요.';
      } else if(outcome==='ready') {
        $('export-share').textContent='공유하기';
        $('export-status').textContent='파일이 준비됐어요. 아래 공유하기를 눌러주세요.';
        focusShare=true;
      } else if(outcome==='failed') $('export-status').textContent=currentKind==='gif'?'공유를 열지 못했어요. GIF 저장 또는 미리보기 열기를 이용해주세요.':'공유를 열지 못했어요. 파일 저장 또는 미리보기를 이용해주세요.';
      else $('export-status').textContent='파일이 준비됐어요.';
    } finally {sharing=false;sync();if(!generating&&focusShare){focusShare=false;$('export-share').focus();}}
  }
  $('result-share').onclick=()=>{if(!generating&&!sharing&&snapshot) $('share-choice').showModal();};
  for(const kind of ['gif','image']) $('share-'+kind).onclick=()=>{$('share-choice').close();return save(kind,'share');};
  $('share-close').onclick=()=>$('share-choice').close();
  $('export-share').onclick=()=>sendShare(true);
  $('export-dismiss').onclick=()=>{release();$('export-status').textContent='';};
  window.addEventListener('pagehide',clear);
  return { clear, set(data){clear();snapshot=snapshotResult(data);sync();}, sync };
}
