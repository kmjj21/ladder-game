import { createRenderer } from './render.js';
import { supportedTypes, extensionFor } from './support.js';

export function recordAttempt(renderer, audio, mimeType, signal) {
  return new Promise((resolve,reject)=>{
    let stream, recorder, raf, frameTimer, timeout, settled=false, chunks=[], started=false, finished=false, previous=-1, direction=0, lastTone=-Infinity;
    function cleanup() {
      cancelAnimationFrame(raf); clearTimeout(frameTimer); clearTimeout(timeout);
      signal?.removeEventListener('abort',abort);
      document.removeEventListener('visibilitychange',visibility);
      if(recorder) {recorder.ondataavailable=recorder.onstop=recorder.onerror=recorder.onstart=null;if(recorder.state!=='inactive') try {recorder.stop();} catch { /* already stopped */ }}
      stream?.getTracks().forEach(track=>track.stop());
    }
    function end(error, value) {
      if(settled) return;settled=true;cleanup();chunks=[];
      if(error) reject(error);else resolve(value);
    }
    function abort(){end(new DOMException('취소됨','AbortError'));}
    function visibility(){if(document.hidden) end(new Error('background'));}
    if(signal?.aborted) {abort();return;}
    try {
      renderer.draw(0);
      stream=renderer.canvas.captureStream(30);
      if(audio?.stream) for(const track of audio.stream.getAudioTracks()) stream.addTrack(track.clone());
      recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000});
      recorder.ondataavailable=event=>{if(event.data.size) chunks.push(event.data);};
      recorder.onerror=()=>end(new Error('recording'));
      recorder.onstop=()=>{
        try {
          const type=recorder.mimeType || chunks[0]?.type || mimeType;
          const extension=extensionFor(type), blob=new Blob(chunks,{type});
          if(!blob.size || !finished) throw new Error('empty-recording');
          end(null,{blob,extension,withAudio:!!audio});
        } catch(error){end(error);}
      };
      recorder.onstart=()=>{
        const origin=performance.now();
        let previousFrame=origin;
        function schedule() {
          // Keep the independent canvas moving when an occluded window pauses RAF.
          // Whichever clock fires first cancels the other, so frames never overlap.
          raf=requestAnimationFrame(now=>{clearTimeout(frameTimer);frame(now);});
          frameTimer=setTimeout(()=>{cancelAnimationFrame(raf);frame(performance.now());},1000/30);
        }
        function frame(now) {
          if(settled) return;
          try {
            // Occluded windows can throttle RAF without a visibility event.
            // Reject a truncated replay instead of saving a mostly still video.
            if(now-previousFrame>750) throw new Error('background');
            previousFrame=now;
            const elapsed=now-origin, sample=renderer.draw(elapsed);
            if(sample.started && !started) {started=true;audio?.play('start');lastTone=elapsed;}
            if(sample.started && !sample.arrived && sample.index!==previous) {
              const segment=renderer.replay.plan.segments[sample.index], nextDirection=Math.sign(segment.b.x-segment.a.x);
              if(sample.horizontal && elapsed-lastTone>220) {audio?.play(direction && direction!==nextDirection?'turn':'swish');lastTone=elapsed;}
              if(sample.horizontal) direction=nextDirection;
              previous=sample.index;
            }
            if(sample.arrived && !finished) {finished=true;audio?.play('finish');}
            if(elapsed>=renderer.replay.duration) recorder.stop();
            else schedule();
          } catch(error){end(error);}
        }
        schedule();
      };
      signal?.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
      timeout=setTimeout(()=>end(new Error('recording-timeout')),renderer.replay.duration+10000);
      recorder.start(250);
    } catch(error){end(error);}
  });
}

export async function exportVideo(snapshot, audio, signal) {
  let renderer;
  try {
    await document.fonts?.ready;
    if(signal?.aborted) throw new DOMException('취소됨','AbortError');
    renderer=createRenderer(snapshot,'video');
    const withAudio=await audio.ready;
    const types=supportedTypes();
    let lastError=new Error('unsupported');
    for(const useAudio of withAudio?[true,false]:[false]) {
      if(!useAudio) await audio.close();
      for(const type of types) {
        try {return await recordAttempt(renderer,useAudio?audio:null,type,signal);}
        catch(error) {
          if(error.name==='AbortError' || error.message==='background') throw error;
          lastError=error;
        }
      }
    }
    throw lastError;
  } finally {renderer?.dispose();await audio.close();}
}
