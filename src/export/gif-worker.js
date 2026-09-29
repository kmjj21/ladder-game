import { createGifEncoder } from './gif-encoder.js';
let encoder;
self.onmessage = ({data}) => {
  try {
    if (data.type === 'init') encoder = createGifEncoder(data.width, data.height, new Uint8Array(data.buffer));
    else if (data.type === 'frame') encoder.frame(new Uint8Array(data.buffer), data.delay);
    else if (data.type === 'finish') {
      const bytes = encoder.finish();encoder = null;
      self.postMessage({buffer:bytes.buffer}, [bytes.buffer]);return;
    } else throw new Error('gif-message');
    self.postMessage({ok:true});
  } catch(error) {encoder?.dispose();encoder = null;self.postMessage({error:error.message});}
};
