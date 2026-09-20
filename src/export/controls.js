import { snapshotResult, mediaFilename } from './model.js';
import { exportImage } from './image.js';
import { exportVideo } from './video.js';
import { videoSupported } from './support.js';
import { prepareAudio } from './audio.js';

export function createExportControls(getSound) {
  const $=id=>document.getElementById(id), root=$('export-controls');
  let snapshot=null, generating=false, url=null, aborter=null, revision=0, currentFile=null;
  function release() {
    $('export-video-preview').pause();$('export-video-preview').removeAttribute('src');$('export-video-preview').load();
    $('export-image-preview').removeAttribute('src');
    $('export-download').removeAttribute('href');$('export-open').removeAttribute('href');
    if(url) URL.revokeObjectURL(url);url=null;currentFile=null;
    $('export-ready').hidden=true;$('export-preview').open=false;
  }
  function sync() {root.hidden=!snapshot;$('export-image').disabled=$('export-video').disabled=generating;root.setAttribute('aria-busy',String(generating));}
  function clear() {revision++;aborter?.abort();aborter=null;snapshot=null;generating=false;release();$('export-status').textContent='';sync();}
  function deliver(blob,extension,kind,silentFallback) {
    release();url=URL.createObjectURL(blob);
    const filename=mediaFilename(extension), link=$('export-download');link.href=url;link.download=filename;
    $('export-open').href=url;$('export-ready').hidden=false;
    const video=kind==='video';$('export-video-preview').hidden=!video;$('export-image-preview').hidden=video;
    $(video?'export-video-preview':'export-image-preview').src=url;
    let share=false;
    try {currentFile=new File([blob],filename,{type:blob.type});share=!!navigator.canShare?.({files:[currentFile]}) && !!navigator.share;} catch {currentFile=null;}
    $('export-share').hidden=!share;
    $('export-status').textContent=(video?'영상을 만들었어요.':'이미지를 만들었어요.')+(silentFallback?' 이 브라우저에서는 소리 없이 만들었어요.':'')+' 저장이 안 되면 아래에서 다시 저장하거나 미리보기를 열어주세요.';
    if('download' in link) link.click();
    else {$('export-preview').open=true;$('export-status').textContent='파일이 준비됐어요. 미리보기 또는 공유 버튼에서 파일에 저장하세요.';}
  }
  async function save(kind) {
    if(generating || !snapshot) return;
    if(kind==='video' && !videoSupported()) {$('export-status').textContent='이 브라우저에서는 영상 저장을 지원하지 않아요. 결과 이미지는 저장할 수 있어요.';return;}
    generating=true;sync();const version=revision, captured=snapshot, sound=getSound();
    aborter=new AbortController();
    const audio=kind==='video'?prepareAudio(sound):null;
    $('export-status').textContent=kind==='video'?'영상 만드는 중… 잠시만 기다려주세요.':'이미지 만드는 중…';
    try {
      if(kind==='image') {const blob=await exportImage(captured);if(version===revision) deliver(blob,'png',kind,false);}
      else {const result=await exportVideo(captured,audio,aborter.signal);if(version===revision) deliver(result.blob,result.extension,kind,sound&&!result.withAudio);}
    } catch(error) {
      if(version===revision && error.name!=='AbortError') $('export-status').textContent=error.message==='background'?'화면을 열어 둔 채 다시 저장해주세요.':'저장하지 못했어요. 다시 시도해주세요. 결과 이미지는 따로 저장할 수 있어요.';
    } finally {if(version===revision){generating=false;aborter=null;sync();}}
  }
  $('export-image').onclick=()=>save('image');$('export-video').onclick=()=>save('video');
  $('export-share').onclick=async()=>{
    if(!currentFile) return;
    try {await navigator.share({files:[currentFile]});}
    catch(error){if(error.name!=='AbortError') $('export-status').textContent='공유하지 못했어요. 파일 저장 또는 미리보기를 이용해주세요.';}
  };
  $('export-dismiss').onclick=()=>{release();$('export-status').textContent='';};
  window.addEventListener('pagehide',clear);
  return { clear, set(data){clear();snapshot=snapshotResult(data);sync();}, sync };
}
