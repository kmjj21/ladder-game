import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'favicon.svg', 'src']) await cp(file, `dist/${file}`, { recursive: true });
console.log('빌드 완료: dist (정적 호스팅용)');
