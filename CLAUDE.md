# CLAUDE.md — 하루 계획 (타임박스 플래너)

> Claude Code가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 설명서.

## 한 줄 소개
**하루 계획** — 초보 전업투자자를 위한 타임박스 플래너.
하루를 **PLAN(계획) / DONE(실행)** 두 열로 나란히 기록해 "계획대로 살았는지"를 눈으로 확인하고,
공부시간·실천율을 추적한다. 국내 장 시간(정규장·애프터마켓)이 타임라인에 겹쳐 보인다.
경제용어 노트와 종목 리서치 메모를 함께 쌓는다.

> 2026-10 전면 재작성. 이전 버전(TamaBox: 다마고치 캐릭터 육성형)은 git 히스토리에 있음.
> 캐릭터·게임화 요소는 전부 제거됨.

## 기술 스택 / 원칙
- **순수 정적 웹앱, 빌드 없음.** Vanilla HTML/CSS/JS. 프레임워크·번들러 없음.
- JS는 **ES 모듈이 아니라 classic `<script src>`** 로 순서대로 로드하고 전역 `window.App` 네임스페이스를 공유한다.
  (file:// 더블클릭에서도 동작해야 함 — 새 모듈에 `import/export` 쓰지 말 것)
- 외부 의존성은 **Pretendard 폰트(CDN)** 뿐. 차트도 라이브러리 없이 CSS로 그린다.
- 데이터는 **오프라인 전용**: `localStorage` 키 `tbxPlanner.v1`. 서버·로그인 없음.
- 디자인은 **라이트 테마 / 클린**. 색은 `css/app.css` 상단 CSS 변수로만 관리.

## 실행 / 테스트 / 배포
```bash
python3 -m http.server 8000     # http://localhost:8000 (또는 index.html 더블클릭)
node tests/logic.test.js        # 통과 시 "N passed, 0 failed"
git add -A && git commit -m "..." && git push    # ~1분 뒤 GitHub Pages 반영
```
- **라이브**: https://maron2ee.github.io/timebox-quest/
- **저장소**: https://github.com/maron2ee/timebox-quest (main)

## 파일 구조
```
index.html          전체 화면 구조(6개 뷰 + 모달)
css/app.css         디자인 시스템 + 모든 컴포넌트 스타일
js/util.js          날짜·시간·DOM 헬퍼 (App.util, 보통 U로 참조)
js/store.js         데이터 모델·저장·마이그레이션·파생값 (App.store)
js/market.js        KRX 거래시간 정의/판정 (App.market)
js/ui.js            토스트·모달·카테고리 팔레트 (App.ui)
js/timeline.js      PLAN|DONE 타임라인 — 칠하기·블록편집·드롭 (App.timeline)
js/tasks.js         프로젝트 그룹별 오늘 할 일 (App.tasks)
js/pomodoro.js      집중 타이머 → 끝나면 DONE에 자동 기록 (App.pomo)
js/day.js           하루 뷰 총괄: 날짜네비·스탯·Goal·Big3·Review (App.day)
js/stats.js         주간/월간 통계 (App.stats)
js/archive.js       회고(K/P/T) 모아보기 (App.archive)
js/terms.js         경제용어 노트 (App.terms)
js/research.js      종목 리서치 메모 (App.research)
js/settings.js      타임라인·장시간·카테고리·데이터 (App.settings)
js/app.js           부트스트랩 + 탭 전환 (App.nav)
tests/logic.test.js 회귀 테스트 (util/store/market만, DOM 스텁)
sw.js, manifest.webmanifest, icon.svg   PWA
```

## 핵심 개념
- **데이터 모델(store.js)**
  ```
  settings { dayStartHour:7, dayEndHour:24, slotMin:10, market{show,sessions}, carryOver }
  categories[] { id, name, color, study }      // study:true 만 '학습시간'에 합산
  projects[]   { id, name, tab:'study'|'plan', collapsed }   // 전역 그룹
  days['YYYY-MM-DD'] {
    goal, big3[3],
    plan { 'HH:MM': {c:catId, t:'제목'} },      // 계획
    done { 'HH:MM': {c:catId, t:'제목'} },      // 실행
    tasks[] { id, projectId, text, done },      // 그날의 할 일
    review { k, p, t }, mtime
  }
  ddays[] / terms[] / research[] / pomo
  ```
  스키마 변경 시 `SCHEMA` 올리고 `migrate()`에 단계 추가 (현재 v1).
- **타임라인**: 한 행 = 1시간, 한 칸 = `slotMin`(기본 10분). 슬롯은 `plan`/`done` 맵에 `'HH:MM'` 키로 저장.
  **연속된 같은 (카테고리, 제목) 슬롯이 한 블록으로 병합**되어 렌더되고, 제목은 블록이 시작하는 칸에만 표시된다
  (다음 행으로 이어지면 라벨 없는 막대로 계속됨).
  드래그 중 좌표→슬롯 변환은 반드시 `hitSlot()`(포인터 X 기준)을 쓸 것. 엘리먼트 기준으로 하면 세그먼트 위에서 인덱스가 블록 시작으로 튄다.
- **장 시간**(`market.js`, 2026-09-14 개편 반영)
  장전 동시호가 08:30–09:00 / **정규장 09:00–15:30** / 시간외 종가 15:40–16:00 / **애프터마켓 16:00–20:00**.
  (옛 시간외단일가 16–18시는 폐지) 가운데 시각 열에 tone(`core`/`pre`/`after`)으로 음영 표시. 설정에서 수정 가능.
- **실천율(adherence)**: 계획한 슬롯 중 같은 슬롯이 실행에도 찍힌 비율.
- **뽀모도로**: 완료/중단 시 시작~현재 구간을 `timeline.applyMinutes(ds,'done',...)`로 기록.

## 작업 규칙
- 코드 수정 후 **`node tests/logic.test.js` 통과** 확인.
- HTML↔JS ID 정합성 확인(아래 한 줄로 검사 가능):
  ```bash
  node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const ids=new Set([...h.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));let bad=0;for(const f of fs.readdirSync("js")){for(const m of fs.readFileSync("js/"+f,"utf8").matchAll(/(?:byId|setText|setHTML|U\.on)\(\s*"([A-Za-z0-9_]+)"/g))if(!ids.has(m[1])){console.log(f,"→ #"+m[1]);bad=1}}process.exit(bad)'
  ```
- **배포할 때마다 `sw.js`의 `CACHE` 버전을 올릴 것**(`plan-v1`→`v2`). 안 그러면 PWA가 옛 캐시를 서빙함.
  (단 fetch 전략은 network-first라 보통은 바로 반영된다)
- 경로는 **상대경로 유지**(GitHub Pages `/timebox-quest/` 하위에서도 동작해야 함).
- 커밋 메시지: `feat:`/`fix:`/`docs:` 등 conventional.
  사용자 설정상 **자동 저작자(Co-authored-by) 표기 비활성 — 붙이지 말 것.**
