import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
function check(dir) {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    const path=`${dir}/${entry.name}`;
    if(entry.isDirectory()) check(path);
    else if (/\.m?js$/.test(entry.name)) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  }
}
for(const dir of ['src','scripts','test']) check(dir);
console.log('모든 앱·스크립트·테스트 문법 검사 통과');
