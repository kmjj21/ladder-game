// Call only from a real user gesture. This does not request microphone access.
export function resumeAudioContext(context) {
  let source;
  const release = () => { try { source?.disconnect(); } catch { /* Already released. */ } };
  try {
    const session = globalThis.navigator?.audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch { /* Optional Audio Session API; normal Web Audio remains available. */ }
  if (context.state === 'running') return Promise.resolve(true);
  try {
    // Starting a silent buffer synchronously also unlocks older iOS audio sessions.
    if (context.createBufferSource && context.createBuffer) {
      source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination); source.onended = release; source.start(0);
    }
    const resumed = context.resume();
    return new Promise(resolve => {
      const timer = setTimeout(() => { release(); resolve(false); }, 1500);
      Promise.resolve(resumed).then(() => { clearTimeout(timer); if (context.state !== 'running') release(); resolve(context.state === 'running'); }, () => { clearTimeout(timer); release(); resolve(false); });
    });
  } catch { release(); return Promise.resolve(false); }
}

export function createAudioEngine(environment = () => window) {
  let context, enabled = true, generation = 0;
  const engine = {
    setEnabled(value) { enabled = value; generation++; },
    unlock(kind) {
      if (!enabled) return Promise.resolve(false);
      const current = generation;
      try {
        if (!context || context.state === 'closed') {
          const env = environment(), Audio = env.AudioContext || env.webkitAudioContext;
          context = new Audio();
        }
        return resumeAudioContext(context).then(ready => {
          if (ready && enabled && current === generation && kind) engine.tone(kind, true);
          return ready;
        });
      } catch { return Promise.resolve(false); }
    },
    tone(kind, requested = true) {
      if (!enabled || !requested || !context || context.state !== 'running') return;
      try { playTone(context, context.destination, kind); } catch { /* An audio failure must not stop the game. */ }
    }
  };
  return engine;
}
const engine = createAudioEngine();
export const unlock = kind => engine.unlock(kind);
export const tone = (kind, enabled) => engine.tone(kind, enabled);
export const setSoundEnabled = enabled => engine.setEnabled(enabled);
export function playTone(context, destination, kind) {
  const notes = kind === 'finish' ? [392, 494, 587, 784] : kind === 'start' ? [440, 587] : [kind === 'tap' ? 440 : kind === 'swish' ? 440 : 554];
  notes.forEach((freq, i) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const time = context.currentTime + i * 0.09;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(freq, time);
    oscillator.frequency.exponentialRampToValueAtTime(freq * 1.3, time + 0.07);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(kind === 'tap' ? 0.012 : ['swish','turn'].includes(kind) ? 0.015 : 0.024, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    oscillator.connect(gain); gain.connect(destination);
    oscillator.start(time); oscillator.stop(time + 0.14);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
