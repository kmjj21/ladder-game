import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAttempt, exportVideo } from '../src/export/video.js';
import { prepareAudio } from '../src/export/audio.js';
import { generateLadder } from '../src/ladder.js';
import { createRhythm } from '../src/layout.js';
import { snapshotResult } from '../src/export/model.js';

// Exercise asynchronous recorder events and ownership of the cloned tracks.
for (const outcome of ['success', 'error', 'abort', 'hidden', 'throttled', 'constructor']) {
  test(`export recorder ${outcome}: tracks, RAF and listeners released`, async t => {
    const doc = new EventTarget(), callbacks = new Map(), tracks = [], recorders = [];
    let next = 0;
    doc.hidden = false;
    const track = () => { const item = { stopped: false, stop() { this.stopped = true; } }; tracks.push(item); return item; };
    const stream = { items: [track()], getTracks() { return this.items; }, addTrack(item) { this.items.push(item); } };
    const originalAudio = { stopped: false, clone: track };
    const sounds = [];
    const audio = { stream: { getAudioTracks: () => [originalAudio] }, play: kind => sounds.push(kind) };
    class Recorder {
      constructor() { if (outcome === 'constructor') throw Error('unsupported codec'); this.state = 'inactive'; this.mimeType = 'video/webm'; recorders.push(this); }
      start() { this.state = 'recording'; queueMicrotask(() => this.onstart?.()); }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recorded'], { type: this.mimeType }) }); this.onstop?.(); }
    }
    t.mock.method(globalThis, 'setTimeout', () => 1);
    t.mock.method(globalThis, 'clearTimeout', () => {});
    const originals = Object.fromEntries(['document', 'MediaRecorder', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.assign(globalThis, { document: doc, MediaRecorder: Recorder,
      requestAnimationFrame: fn => { callbacks.set(++next, fn); return next; }, cancelAnimationFrame: id => callbacks.delete(id) });
    const controller = new AbortController();
    const renderer = { canvas: { captureStream: () => stream }, replay: { duration: 100, plan: { segments: [{ a: { x: 0 }, b: { x: 1 } }] } },
      draw: elapsed => ({ started: elapsed > 0, arrived: elapsed >= 100, index: 0, horizontal: true }) };
    try {
      const promise = recordAttempt(renderer, audio, 'video/webm', controller.signal);
      const rejected = outcome !== 'success' ? assert.rejects(promise) : null;
      await Promise.resolve();
      if (outcome === 'success') {
        for (const [id, fn] of callbacks) { callbacks.delete(id); fn(performance.now() + 200); }
        const result = await promise;
        assert.equal(result.extension, 'webm'); assert.ok(result.blob.size); assert.equal(result.withAudio, true);
        assert.ok(sounds.includes('finish'));
      } else if (outcome === 'abort') controller.abort();
      else if (outcome === 'throttled') { for (const [id, fn] of callbacks) { callbacks.delete(id); fn(performance.now() + 1000); } }
      else if (outcome === 'hidden') { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); }
      else if (outcome === 'error') recorders[0].onerror();
      if (rejected) await rejected;
      assert.ok(tracks.every(item => item.stopped)); assert.equal(originalAudio.stopped, false);
      assert.equal(callbacks.size, 0);
      for (const recorder of recorders) { assert.equal(recorder.state, 'inactive'); assert.equal(recorder.onstop, null); assert.equal(recorder.onstart, null); }
      controller.abort(); doc.dispatchEvent(new Event('visibilitychange'));
    } finally {
      for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
  });
}

test('export audio OFF creates no audio context; failed audio resumes silently', async () => {
  const previous = globalThis.window;
  let created = 0, stopped = 0, closed = 0;
  class Audio {
    constructor() { created++; this.state = 'suspended'; }
    createMediaStreamDestination() { return { stream: { getTracks: () => [{ stop: () => stopped++ }] }, disconnect() {} }; }
    createGain() { return { connect() {}, disconnect() {} }; }
    resume() { return Promise.reject(Error('unavailable')); }
    close() { closed++; this.state = 'closed'; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: Audio };
  try {
    const off = prepareAudio(false); assert.equal(await off.ready, false); await off.close(); assert.equal(created, 0);
    const failed = prepareAudio(true); assert.equal(await failed.ready, false); await failed.close(); await failed.close();
    assert.equal(created, 1); assert.equal(closed, 1); assert.ok(stopped >= 1);
  } finally { if (previous) globalThis.window = previous; else delete globalThis.window; }
});

test('runtime codec failure falls back to video only and disposes the canvas', async () => {
  const keys = ['document', 'MediaRecorder', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const attempts = [], tracks = [], canvases = [];
  const context = new Proxy({ measureText: text => ({ width: text.length * 12 }) }, { get: (obj, key) => obj[key] || (() => {}) });
  const track = () => { const item = { stopped: false, stop() { this.stopped = true; } }; tracks.push(item); return item; };
  const doc = new EventTarget();
  doc.createElement = () => {
    const canvas = { getContext: () => context, captureStream: () => ({ items: [track()], getTracks() { return this.items; }, addTrack(item) { this.items.push(item); } }) };
    canvases.push(canvas); return canvas;
  };
  class Recorder {
    static isTypeSupported(type) { return ['video/mp4', 'video/webm'].includes(type); }
    constructor(stream, options) {
      attempts.push({ type: options.mimeType, audio: stream.items.length > 1 });
      if (stream.items.length > 1 || options.mimeType === 'video/mp4') throw Error('runtime unsupported');
      this.mimeType = 'video/webm'; this.state = 'inactive';
    }
    start() { this.state = 'recording'; queueMicrotask(() => this.onstart?.()); }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['video']) }); this.onstop?.(); }
  }
  let closed = false;
  const audio = { ready: Promise.resolve(true), stream: { getAudioTracks: () => [{ clone: track }] }, close: async () => { closed = true; } };
  let clock = performance.now();
  Object.assign(globalThis, { document: doc, MediaRecorder: Recorder, requestAnimationFrame: fn => setTimeout(() => fn(clock += 100), 0), cancelAnimationFrame: clearTimeout });
  try {
    const ladder = generateLadder(2);
    const result = await exportVideo(snapshotResult({ ladder, rhythm: createRhythm(ladder), names: ['가', '나'], results: ['당번', '당번'], index: 1, reverse: true }), audio, new AbortController().signal);
    assert.equal(result.withAudio, false); assert.equal(result.extension, 'webm');
    assert.deepEqual(attempts, [{ type: 'video/mp4', audio: true }, { type: 'video/webm', audio: true }, { type: 'video/mp4', audio: false }, { type: 'video/webm', audio: false }]);
    assert.ok(closed); assert.ok(tracks.every(item => item.stopped)); assert.ok(canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
