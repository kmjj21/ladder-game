export const MIME_CANDIDATES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
export function supportedTypes(Recorder = globalThis.MediaRecorder) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return [];
  return MIME_CANDIDATES.filter(type => {try {return Recorder.isTypeSupported(type);} catch {return false;}});
}
export function extensionFor(type) {
  if (type?.toLowerCase().startsWith('video/mp4')) return 'mp4';
  if (type?.toLowerCase().startsWith('video/webm')) return 'webm';
  throw new Error('unsupported-format');
}
export function videoSupported() {
  return typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && supportedTypes().length > 0;
}
