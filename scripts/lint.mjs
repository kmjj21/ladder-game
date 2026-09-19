import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const dir of ['src', 'scripts', 'test']) for (const name of readdirSync(dir)) {
  if (/\.m?js$/.test(name)) execFileSync(process.execPath, ['--check', `${dir}/${name}`], { stdio: 'inherit' });
}
console.log('모든 앱·스크립트·테스트 문법 검사 통과');
