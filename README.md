# ladder-game v1.0

설치나 로그인 없이 PC와 스마트폰에서 즐기는 가볍고 재미있는 양방향 사다리 타기 게임입니다.

**배포 주소:** 추후 공개 URL을 여기에 추가합니다.

## 주요 기능

- 2~20명 지원, 참가자와 결과 개수 자동 동기화
- 개별 편집과 줄바꿈·쉼표로 한 번에 입력
- 무작위 사다리와 인원별 밀도, PC 전체 표시·모바일 가로 스크롤
- **사람 → 결과:** 이름을 누르면 이동 후 해당 결과만 공개
- **결과 → 사람:** 결과를 누르면 역방향으로 주인공 찾기
- 중복 결과 지원, 전체 결과 목록, 다시 섞기, 새 게임
- 캐릭터 애니메이션과 효과음 ON/OFF
- 이름·결과·빈칸·효과음 설정을 브라우저 localStorage에 자동 저장

저장값은 서버로 전송하지 않습니다. 새로고침하면 입력은 복구되지만 진행 중 게임은 초기화됩니다. 각 브라우저에서 독립적으로 진행하며 온라인 멀티플레이는 없습니다.

## 로컬 실행

Node.js 20 이상이 필요합니다. 프로젝트를 내려받아 압축을 푼 뒤 해당 폴더에서 실행하세요. 외부 패키지 의존성은 없습니다.

```sh
cd ladder-game
npm run dev
```

브라우저에서 http://127.0.0.1:5173/ 을 엽니다. Windows PowerShell에서 npm 실행이 제한되면 `npm.cmd`를 사용하세요.

### 스마트폰에서 로컬 테스트

PC와 휴대폰을 같은 Wi-Fi에 연결하고 실행합니다.

```sh
npm run dev:lan
```

출력된 ‘같은 Wi-Fi 스마트폰’ 주소를 휴대폰 브라우저에서 엽니다. PC와 서버를 켜 두어야 합니다. 공개 배포 후에는 링크만 누르면 PC·Android·iPhone 브라우저에서 사용할 수 있습니다.

## 검사와 빌드

```sh
npm run lint
npm test
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다. TypeScript를 사용하지 않아 별도 typecheck는 없습니다. 검증 내역은 [TEST-RESULTS.md](TEST-RESULTS.md)를 참고하세요.

## Vercel 배포

1. 독립된 GitHub `ladder-game` 저장소를 준비합니다.
2. Vercel에서 **Add New → Project**를 선택하고 해당 저장소를 **Import**합니다.
3. Framework는 **Other**, Build Command는 `npm run build`, Output Directory는 `dist`, Production Branch는 `main`으로 확인합니다.
4. **Deploy**를 누릅니다. 환경변수·DB 설정은 필요 없습니다.
5. 발급된 HTTPS 주소를 위 ‘배포 주소’에 추가합니다.

최소 설정은 `vercel.json`에 포함되어 있습니다. GitHub 연결 후 main에 push하면 자동 재배포할 수 있습니다. 자세한 연결 방법은 [Vercel 공식 안내](https://vercel.com/docs/git)를 참고하세요.
