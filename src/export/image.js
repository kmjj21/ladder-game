import { createRenderer } from './render.js';
export async function exportImage(snapshot) {
  await document.fonts?.ready;
  const renderer = createRenderer(snapshot, 'image');
  try {
    renderer.draw();
    return await new Promise((resolve,reject)=>renderer.canvas.toBlob(blob=>blob?.size?resolve(blob):reject(new Error('image-empty')),'image/png'));
  } finally {renderer.dispose();}
}
