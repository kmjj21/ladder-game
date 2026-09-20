import { playTone } from '../sound.js';

// Called synchronously by the save gesture; never requests microphone access.
export function prepareAudio(enabled) {
  let context, bus, destination, timer, finishReady, closed = false;
  const close = async () => {
    if (closed) return;
    closed = true; clearTimeout(timer); finishReady?.(false);
    destination?.stream.getTracks().forEach(track => track.stop());
    bus?.disconnect(); destination?.disconnect();
    if (context && context.state !== 'closed') await context.close().catch(()=>{});
  };
  try {
    if (!enabled) return { ready: Promise.resolve(false), close };
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return { ready: Promise.resolve(false), close };
    context = new Audio(); destination = context.createMediaStreamDestination(); bus = context.createGain();
    bus.connect(destination); bus.connect(context.destination);
    const ready = new Promise(resolve => {
      finishReady = value => { clearTimeout(timer); resolve(value); };
      timer = setTimeout(() => finishReady(false), 1500);
      context.resume().then(() => finishReady(!closed && context.state === 'running')).catch(() => finishReady(false));
    });
    return { ready, stream: destination.stream, play(kind){if(context.state==='running') playTone(context,bus,kind);}, close };
  } catch { return { ready: Promise.resolve(false), close }; }
}
