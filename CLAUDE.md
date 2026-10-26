# CLAUDE.md — 하루 계획 (타임박스 플래너)

> Claude Code가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 설명서.

## 한 줄 소개
**하루 계획** — 초보 전업투자자를 위한 타임박스 플래너 + 매매 프로세스 러너.
하루를 **PLAN(계획) / DONE(실행)** 두 열로 나란히 기록하고, 그 위에 **데일리 루틴 구간**을 얹어
시각에 따라 앱의 모드가 바뀐다(입력→계획→매매금지→집행→휴식→관리→기록→학습).
핵심 루프는 **아침 가설 → 장 마감 판정**과 **매매 계획 → 집행 → 계획외 카운터**다.
국내 장 시간(정규장·애프터마켓)이 타임라인에 겹쳐 보인다.

> **역할 분담(가장 중요). 앱은 허브이지 저장소가 아니다.**
> 사용자에게는 이미 완성된 3층 기록 시스템이 있다 (노션 `Stock Analysis` 참고):
>
> | 층 | 무엇 | 어디 |
> |---|---|---|
> | 1층 | 매매 운영 규칙 (고정, 월 1회만 수정) | 노션 |
> | 2층 | **숫자** — 지수·금리·환율·수급·거래대금, **그리고 가설(`O`·`P`·`R`)과 판정(`AK`~`AN`)** | 구글시트 (1행=하루) |
> | 3층 | **서술** — 데일리 노트 4블록, 리포트·종목 분석 | 노션 `Daily Market Log` (1페이지=하루) |
> | — | **상세 매매일지** | 구글시트 |
>
> **가설·적중률을 앱에 다시 만들지 말 것.** 시트에 `AL`/`AM` 수식과 월말 집계
> (`=COUNTIF(AL:AL,"O")/COUNTA(AL2:AL)`)가 이미 있고, 틀린 날만 빨강으로 필터하는 복기 흐름까지 있다.
>
> 앱이 맡는 것은 **시트·노션이 구조적으로 못 하는 것**뿐이다:
> 시계(지금 어느 구간인지) · 타임박스 PLAN/판정 · 장중 가드레일(계획외 카운터·손익비 게이트) ·
> **확정 시각 도장**(언제 썼는가) · 용어 복습 · 링크 허브.
> 긴 글·표·누적손익을 앱에 들이면 중복 입력이 생기고, 그 순간 둘 다 안 쓰게 된다.

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
index.html          전체 화면 구조(7개 뷰: 하루·매매·통계·회고·용어·리서치·설정 + 모달)
css/app.css         디자인 시스템 + 모든 컴포넌트 스타일
js/util.js          날짜·시간·DOM 헬퍼 (App.util, 보통 U로 참조)
js/store.js         데이터 모델·저장·마이그레이션·파생값 (App.store)
js/market.js        KRX 거래시간 정의/판정 (App.market)
js/ui.js            토스트·모달·카테고리 팔레트 (App.ui)
js/timeline.js      PLAN|DONE 타임라인 — 칠하기·블록편집·드롭 (App.timeline)
js/routine.js       데일리 루틴 구간 엔진 — 레일·모드배너·구간 체크리스트 (App.routine)
js/trades.js        매매 계획·집행 체크·계획외 카운터·관찰목록 (App.trades)
js/judge.js         오늘 판정 — 계획 블록을 탭으로 확정해 DONE 생성 (App.judge)
js/record.js        '오늘의 기록' 허브 — 확정 시각 도장 + 시트·노션 링크 (App.record)
js/notify.js        구간 알림 — 탭이 열려 있을 때만 (App.notify)
js/tasks.js         프로젝트 그룹별 오늘 할 일 (App.tasks)
js/pomodoro.js      집중 타이머 → 끝나면 DONE에 자동 기록 (App.pomo)
js/day.js           하루 뷰 총괄: 날짜네비·스탯·Goal·Big3·Review (App.day)
js/stats.js         주간/월간 통계 (App.stats)
js/archive.js       회고(K/P/T) 모아보기 (App.archive)
js/terms.js         경제용어 노트 (App.terms)
js/research.js      리서치 '링크 인덱스' — 2축 분류, 본문은 노션 (App.research)
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
  settings.routine { enabled, phases[] }       // 구간 정의(기본 10개)
  settings.hypothesisPolicy  free | mark | lock
  settings.guard { planViolation: off|warn|block, maxTrades, maxLossPct }
  days['YYYY-MM-DD'] {
    goal, big3[3],
    plan { 'HH:MM': {c:catId, t:'제목'} },      // 계획
    done { 'HH:MM': {c:catId, t:'제목'} },      // 실행
    tasks[] { id, projectId, text, done },      // 그날의 할 일
    hypothesis { bias, reason, sectors[], savedAt,
                 openSnapshot, editedAfterOpen, lateFirstWrite,
                 verdict{hit, sectorHit, note} },
    plans[] { id, ticker, name, entry, stop, target, qty, reason },
    trades[] { id, planId|null, ticker, at, entry, pnl },
    noTradeIf, checks{'phaseId:index'}, links{am,pm,journal},
    judged { '<블록시작슬롯>': 'done'|'skip'|'other' },
    watch { today[], tomorrow[] },
    review { k, p, t }, mtime
  }
  ddays[] / terms[] / pomo
  settings.notify { enabled, lead(분), sound }
  research[] { id, ticker, name, kind, stance, sector, url, note, body?, date, updated }
               // 2축 — kind: stock|theme|macro|report|event
               //       stance: watch|cand|hold|pause|drop  (store.RS_KINDS / RS_STANCES)
               // 목록은 스탠스 우선순위(후보→보유→관심→보류→폐기) 다음 최근 수정순
               // body 는 예전 앱 내 메모 — migrate 에서 보존만 한다
  ```
  스키마 변경 시 `SCHEMA` 올리고 `migrate()`에 단계 추가 (현재 v1).
- **타임라인**: 한 행 = 1시간, 한 칸 = `slotMin`(기본 10분). 슬롯은 `plan`/`done` 맵에 `'HH:MM'` 키로 저장.
  **연속된 같은 (카테고리, 제목) 슬롯이 한 블록으로 병합**되어 렌더되고, 제목은 블록이 시작하는 칸에만 표시된다
  (다음 행으로 이어지면 라벨 없는 막대로 계속됨).
  드래그 중 좌표→슬롯 변환은 반드시 `hitSlot()`(포인터 X 기준)을 쓸 것. 엘리먼트 기준으로 하면 세그먼트 위에서 인덱스가 블록 시작으로 튄다.
- **장 시간**(`market.js`, 2026-09-14 개편 반영)
  장전 동시호가 08:30–09:00 / **정규장 09:00–15:30** / 시간외 종가 15:40–16:00 / **애프터마켓 16:00–20:00**.
  (옛 시간외단일가 16–18시는 폐지) 가운데 시각 열에 tone(`core`/`pre`/`after`)으로 음영 표시. 설정에서 수정 가능.
- **루틴 구간**(`routine.js`): 기본 10구간. `mode` 가 앱 동작을 바꾼다 —
  `input`/`plan`(장전 입력) · `observe`(매매금지) · `exec`(집행) · `rest`(강제휴식) ·
  `manage`(관리) · `record`(기록) · `learn`(학습).
  **장중 구간(observe/exec/manage)의 체크리스트는 `readonly: true`** — 사용자 원칙이
  "장중에는 기록하지 않고 읽기만"이므로 체크박스를 주지 말 것. 대신 계획외 매매 건수를 라이브로 보여준다.
  지난 구간에 체크가 하나도 없으면 레일에 **누락** 배지가 남는다(사후 보정을 유도하지 않음).
- **확정 시각 도장**(`store.phaseStamp` + `record.js`): 시트가 못 하는 유일한 것 — *언제* 확정했는가.
  `day.checks` 에 체크 시각(ms)이 들어 있으므로, `매매 계획 확정`(pre3) 구간의 **가장 늦은 체크 시각**을
  그날의 확정 시각으로 쓴다. 구간 종료(09:00)를 넘겨 체크했으면 `late` → "장 시작 후" 로 빨갛게 표시.
  사용자 원칙: *"순서가 반대가 되면 가설이 아니라 사후 합리화"*.
  통계의 **루틴 준수** 카드가 제시간 확정 비율·구간 체크율·누락 구간·계획외 매매를 집계한다.
  가설 **내용**은 받지 않는다 (시트 `O`·`P`·`R`).
- **매매 가드레일**(`trades.js` + `store.guardState`): 계획외 매매 1건이라도 생기면 경고.
  `settings.guard.planViolation` 이 `block` 이면 집행 버튼이 비활성된다. 매매 횟수 상한·손실 한도도 같은 함수에서 판정.
  **손익비(`store.riskReward`)가 1:2 미만이면 계획 카드가 빨갛게 '후보 제외'** 로 표시된다.
- **DONE은 그리는 게 아니라 판정한다**(`judge.js`). 사용자 원칙이 "장중엔 기록 안 함 + 사후 추정 금지"라
  DONE을 두 번째 그리드로 칠하게 하면 둘 다 어기게 된다. 그래서 15:30 기록 구간에
  **계획 블록 목록을 띄우고 `했음 / 안 함 / 다른 걸 함`을 탭**하면 DONE 슬롯이 생성된다.
  - `전부 계획대로` 버튼은 **미판정 블록만** 처리한다(이미 판정한 걸 덮어쓰지 말 것).
  - DONE 직접 칠하기는 남겨둔다 — 계획에 없던 활동을 기록하는 유일한 수단이고,
    판정 목록 하단의 '계획에 없던 활동' 섹션이 그걸 보여준다.
- **구간 알림**(`notify.js`): 구간이 바뀔 때 + N분 전 미리 알림. 20초마다 틱.
  **서버 푸시가 없어 탭이 열려 있을 때만 동작한다** — 설정 화면에 이 한계를 그대로 써 둘 것.
  OS 알림 권한이 없거나 거부돼도 **인앱 토스트는 항상** 뜬다. 주말(비거래일)엔 조용하다.
  앱을 켠 직후 첫 틱은 기준만 잡고 알리지 않는다(새로고침마다 울리는 것 방지).
- **실천율 지표는 두 개이고 기본은 카테고리 분 기준**이다.
  - `adherence(ds)` — **Σ min(계획분, 실제분) / Σ 계획분** (카테고리별). 시간이 밀려도 한 건 인정.
  - `onTimeRate(ds)` — 계획한 슬롯 '그 시간에' 실행된 비율. 밀리면 떨어진다. 보조 지표로만 표시.
  - 왜: 계획대로 다 했는데 1시간 밀린 날이 슬롯 기준으로는 47%로 찍혔다. 시간 밀림을 '안 함'과
    똑같이 처벌하면 안 된다. 통계·타임라인 푸터 모두 `adherence` 를 주 지표로 쓴다.
- **뽀모도로**: 완료/중단 시 시작~현재 구간을 `timeline.applyMinutes(ds,'done',...)`로 기록.
- **D-day**(`day.js`): `state.ddays[]` 에 **사용자가 직접 입력**한다. 실적·공시 일정을 외부에서
  가져오지 않는다(DART 등은 브라우저 CORS 때문에 중계 서버가 필요). 하루 탭의 D-day 카드를 누르면
  모달에서 이름·날짜를 즉시 수정·삭제할 수 있다.

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
