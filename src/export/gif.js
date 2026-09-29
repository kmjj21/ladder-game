import { createRenderer } from './render.js';

const abortError = () => new DOMException('취소됨', 'AbortError');
export function gifFrames(replay) {
  // GIF delays use centiseconds: alternate 80/90ms to average 12fps.
  const frames = [], end = Math.round(replay.duration / 10) * 10;
  for (let i = 0, time = 0; time < end; i++) {
    let next = Math.min(end, Math.round((i + 1) * 100 / 12) * 10);
    if (end - next > 0 && end - next < 70) next = end;
    frames.push({time, delay:next - time});time = next;
  }
  return frames;
}

export function workerClient(worker, signal, timeoutMs = 30000) {
  let pending, timer, closed = false;
  function settle(error, value) {
    clearTimeout(timer);const request = pending;pending = null;
    if (error) request?.reject(error);else request?.resolve(value);
  }
  function dispose(error = abortError()) {
    if (closed) return;closed = true;settle(error);
    signal?.removeEventListener('abort', abort);
    worker.onmessage = worker.onerror = worker.onmessageerror = null;worker.terminate();
  }
  function abort() { dispose(); }
  worker.onmessage = ({data}) => data.error ? dispose(new Error(data.error)) : settle(null, data);
  worker.onerror = worker.onmessageerror = () => dispose(new Error('gif-worker'));
  signal?.addEventListener('abort', abort, {once:true});
  return {
    request(data) {
      if (closed || signal?.aborted) {dispose();return Promise.reject(abortError());}
      if (pending) return Promise.reject(new Error('gif-busy'));
      return new Promise((resolve, reject) => {
        pending = {resolve,reject};timer = setTimeout(() => dispose(new Error('gif-timeout')), timeoutMs);
        try {worker.postMessage(data, data.buffer ? [data.buffer] : []);} catch(error) {dispose(error);}
      });
    }, dispose
  };
}

// Sample both the starting card and arrival card for a stable global palette.
function paletteSamples(renderer) {
  const {canvas,replay} = renderer, ctx = canvas.getContext('2d');
  const stride = Math.max(1, Math.ceil(Math.sqrt(canvas.width * canvas.height / 100000)));
  const samples = new Uint8Array(Math.ceil(canvas.width / stride) * Math.ceil(canvas.height / stride) * 8);
  let offset = 0;
  for (const time of [0, replay.duration]) {
    renderer.draw(time);const rgba = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    for (let y=0;y<canvas.height;y+=stride) for (let x=0;x<canvas.width;x+=stride) {
      const i=(y*canvas.width+x)*4;samples.set(rgba.subarray(i,i+4),offset);offset+=4;
    }
  }
  return samples;
}

export async function exportGif(snapshot, signal, dependencies = {}) {
  let renderer, client, fallback;
  const check = () => {if (signal?.aborted) throw abortError();};
  try {
    check();await document.fonts?.ready;check();
    renderer = (dependencies.createRenderer || createRenderer)(snapshot, 'gif');
    const {canvas,replay} = renderer, ctx = canvas.getContext('2d'), samples = paletteSamples(renderer);
    const makeWorker = dependencies.makeWorker || (() => new Worker(new URL('./gif-worker.js',import.meta.url),{type:'module'}));
    try {
      client = workerClient(makeWorker(),signal);
      // Transfer a copy: samples remains available if module workers cannot start.
      const buffer = samples.slice().buffer;
      await client.request({type:'init',width:canvas.width,height:canvas.height,buffer});
    } catch(error) {
      client?.dispose();client = null;check();
      // Older browsers still yield between frames. Normal Safari uses the worker.
      const {createGifEncoder} = await import('./gif-encoder.js');check();
      fallback = createGifEncoder(canvas.width,canvas.height,samples);
    }
    for (const {time,delay} of gifFrames(replay)) {
      check();renderer.draw(time);
      const rgba = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      if (client) await client.request({type:'frame',buffer:rgba.buffer,delay});
      else {fallback.frame(rgba,delay);await new Promise(resolve=>setTimeout(resolve,0));}
    }
    check();const bytes = client ? new Uint8Array((await client.request({type:'finish'})).buffer) : fallback.finish();
    if (bytes.length < 14 || new TextDecoder().decode(bytes.subarray(0,6)) !== 'GIF89a' || bytes.at(-1) !== 0x3b) throw new Error('gif-invalid');
    return new Blob([bytes],{type:'image/gif'});
  } finally {client?.dispose();fallback?.dispose();renderer?.dispose();}
}
