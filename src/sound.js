let context;
export function unlock() { try { context ||= new (window.AudioContext || window.webkitAudioContext)(); context.resume().catch(() => {}); } catch { /* 음향 미지원 환경에서도 게임은 동작합니다. */ } }
export function tone(kind, enabled) {
  if (!enabled || !context || context.state !== 'running') return;
  playTone(context, context.destination, kind);
}
export function playTone(context, destination, kind) {
  const notes = kind === 'finish' ? [392, 494, 587, 784] : kind === 'start' ? [440, 587] : [kind === 'swish' ? 440 : 554];
  notes.forEach((freq, i) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const time = context.currentTime + i * 0.09;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(freq, time);
    oscillator.frequency.exponentialRampToValueAtTime(freq * 1.3, time + 0.07);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(['swish','turn'].includes(kind) ? 0.015 : 0.024, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    oscillator.connect(gain); gain.connect(destination);
    oscillator.start(time); oscillator.stop(time + 0.14);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
