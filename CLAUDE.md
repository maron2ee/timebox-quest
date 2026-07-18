# CLAUDE.md — TamaBox 프로젝트 가이드

> 이 파일은 Claude Code가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 설명서입니다.
> (어느 기기/세션에서든 맥락을 빠르게 잡기 위한 용도)

## 한 줄 소개
**TamaBox (타마박스)** — "하루를 키우는 타임박스". 전업투자자 타겟. 타임박스로 하루를 카테고리(운동·언어·주식공부 등)별로 계획하고, 계획을 얼마나 지켰는지 일/주/월로 추적하며, 다마고치 친구(기본 **머니몽키🐵**, 고양이·강아지도 선택 가능)를 키우는 귀여운 웹앱. 뽀모도로 집중 타이머로 실천을 타임박스에 자동 반영.

## 기술 스택 / 원칙
- **순수 정적 웹앱, 빌드 없음.** Vanilla HTML/CSS/JS. 프레임워크·번들러 없음.
- JS는 **ES 모듈이 아니라 classic `<script src>`** 로 순서대로 로드하고 전역 `window.App` 네임스페이스를 공유한다. (file:// 더블클릭에서도 동작하게 하기 위함 — 새 모듈 추가 시 `import/export` 쓰지 말 것)
- 외부 의존성은 전부 **CDN**: Pretendard·Galmuri·Press Start 2P 폰트, Supabase JS(지연 로드).
- 데이터는 **오프라인 우선**: `localStorage` 키 `timeboxQuest.v1`. 클라우드 동기화는 선택(Supabase).

## 실행 / 테스트 / 배포
```bash
# 로컬 실행
python3 -m http.server 8000      # http://localhost:8000  (또는 index.html 더블클릭)
# 회귀 테스트 (DOM 스텁 기반 순수 로직)
node tests/logic.test.js         # 통과 시 "N passed, 0 failed"
# 배포 (GitHub Pages 자동)
git add -A && git commit -m "..." && git push   # ~1분 뒤 라이브 반영
```
- **라이브**: https://maron2ee.github.io/timebox-quest/ (GitHub Pages, push 시 자동배포)
- **저장소**: https://github.com/maron2ee/timebox-quest (main 브랜치)
- 보조: Netlify https://zesty-phoenix-543300.netlify.app

## 파일 구조
```
index.html              화면 구조(HUD·탭·플래너·성과·도감·설정·모달)
css/theme.css           전체 스타일 (모던 라이트 기본 + body.pixel 레트로 스킨)
js/state.js             데이터 모델·저장·마이그레이션·날짜유틸·통계 derive
js/charts.js            픽셀 차트(막대/카테고리/히트맵)
js/gamify.js            XP/레벨/업적/토스트/8비트효과음/색종이
js/character.js         캐릭터 육성(SVG·진화·종[머니몽키/고양이/강아지]·밥주기·도감·테마·여러마리)
js/planner.js           타임박스 그리드(칠하기/인셀 체크박스/키보드/복사·템플릿) + reflectRange(뽀모도로 반영)
js/pomodoro.js          뽀모도로 집중 타이머(집중 완료 시 해당 시간대 칸 자동 완료 반영)
js/todos.js              오늘 할 일 목록(day.todos[], ☆로 TOP3 메달 지정), 타임박스로 드래그&드롭
js/analytics.js         성과 탭(일/주/월)+인사이트+CSV+집중시간추이(카테고리별 일별 시간, 기본 주식공부)
js/calendar.js           달력 탭: 월간 그리드로 일별 달성률 시각화, 날짜 클릭 시 플래너로 이동
js/sync.js              Supabase 동기화(일 단위 병합)
js/app.js               부트스트랩·탭·HUD·설정·모달·Undo·알림
manifest.webmanifest, sw.js, icon.svg   PWA(설치형/오프라인)
tests/logic.test.js     회귀 테스트
supabase.sql            동기화용 테이블 + RLS
DEPLOY.md               배포 가이드
```

## 핵심 개념
- **데이터 모델(state.js)**: `settings`, `categories[]`, `days{ 'YYYY-MM-DD': { blocks: { 'HH:MM': {categoryId, note, done, actual} }, mtime } }`, `templates{요일:맵}`, `game{ xp, theme, pets[], activePet }`. 스키마 변경 시 `SCHEMA_VERSION` 올리고 `migrate()`에 단계 추가(현재 v5).
- **테마/색**: 기본 테마 `navy`(딥 네이비 배경 + 노랑 액센트). 테마는 `character.js`의 `THEMES`+`ACCENTS`가 정의, 적용은 `applyThemeNow()`가 CSS 변수 `--app-bg`/`--primary` 등을 세팅. 카테고리 색 팔레트는 `state.js` `PALETTE`(레트로).
- **레트로 픽셀 모드**: `settings.pixel`(기본 ON) → `<body class="pixel">` → `css/theme.css`의 `body.pixel` 블록이 Press Start 2P/Galmuri·베벨 패널·CRT 스캔라인·각진 모서리로 스킨. 끄면 모던 라이트룩.
- **UI 스킨**: `settings.skin`(default|soft|glass|pastel|editorial) → `<body class="skin-X">`(픽셀 모드 끈 상태에서만 적용, `:not(.pixel)`로 스코프). `css/theme.css`의 `MODERN SKIN VARIANTS` 섹션이 `--surface/--ink/--primary/--shadow/--r/--display` 등 CSS 변수를 재정의하는 방식이라 대부분 컴포넌트가 자동으로 스킨을 따라감. 새 스킨 추가 시 이 패턴을 따를 것.
- **플래너 모드리스**: 빈 칸 탭=계획, 칠한 칸 탭=완료체크(칸 안 체크박스), 마우스 드래그=범위칠하기, 키보드(화살표/Enter/Del/E)도 지원.
- **동기화**: 사용자별 JSON 1문서. `day.mtime` 기준 **날짜 단위 병합**(`sync.js` `mergeStates`). Supabase는 **publishable key**(client-safe) 사용, RLS로 본인 데이터만.

## 작업 규칙
- 코드 수정 후 **`node tests/logic.test.js` 통과** + (HTML↔JS) `getElementById` ID가 index.html에 다 있는지 확인.
- **배포할 때마다 `sw.js`의 `CACHE` 버전을 올릴 것**(예: `tbq-v3`→`v4`). 안 그러면 PWA가 옛 캐시를 서빙함.
- 경로는 **상대경로 유지**(GitHub Pages `/timebox-quest/` 하위에서도 동작해야 함).
- 커밋 메시지: `feat:`/`fix:`/`docs:` 등 conventional. 사용자 설정상 **자동 저작자(Co-authored-by) 표기 비활성** — 붙이지 말 것.
- 기능 추가 흐름: 구현 → 테스트 → 커밋+푸시(SW 버전업) → "새로고침하세요" 안내.
