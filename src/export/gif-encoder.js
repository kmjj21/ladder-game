import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc/gifenc.js';

// One stream, one palette, one incoming RGBA frame at a time. No frame archive.
export function createGifEncoder(width, height, samples) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 3000000) throw new Error('gif-size');
  let encoder = GIFEncoder(), palette = quantize(samples, 128), frames = 0;
  return {
    frame(rgba, delay) {
      if (!encoder || rgba.length !== width * height * 4 || delay < 10) throw new Error('gif-frame');
      const indexed = applyPalette(rgba, palette);
      encoder.writeFrame(indexed, width, height, { palette: frames++ ? undefined : palette, delay, repeat: 0, dispose: 1 });
    },
    finish() {
      if (!encoder || !frames) throw new Error('gif-empty');
      encoder.finish();const bytes = encoder.bytes();encoder = palette = null;return bytes;
    },
    dispose() { encoder = palette = null; }
  };
}
