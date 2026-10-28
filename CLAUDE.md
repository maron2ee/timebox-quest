# CLAUDE.md — 하루 계획 (타임박스 플래너)

> Claude Code가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 설명서.

## 한 줄 소개
**하루 계획** — 초보 전업투자자를 위한 타임박스 플래너.
하루를 **PLAN(계획) / DONE(실행)** 두 열로 나란히 기록하고, 그 위에 **데일리 루틴 구간**(07:30~22:00,
2026-10-29 개정)을 얹어 시각에 따라 앱의 모드가 바뀐다(입력→계획→매매금지→관리→기록→저녁관찰→학습).
구간마다 **요일 제한**을 둘 수 있다(`phase.days`, 미지정=매일) — 설정에서 일~토 토글로 편집.
핵심 루프는 **계획 → 탭 판정(DONE)**과 **구간 알림/타이머**다. 매매 계획·집행·가드레일 기능은
2026-10 말 제거됨 — 매매일지는 전적으로 구글시트에서 관리한다 (아래 역할 분담 참고).
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
> 링크는 `settings.links[]` 한 곳에서만 관리한다 — 이름·주소·순서를 사용자가 바꾸므로
> 코드에 `"2층 시트"` 같은 **라벨을 하드코딩하지 말 것**. 기본 id 는 sheet·note·notes·rules·journal.
>
> 앱이 맡는 것은 **시트·노션이 구조적으로 못 하는 것**뿐이다:
> 시계(지금 어느 구간인지) · 타임박스 PLAN/판정 · **확정 시각 도장**(언제 썼는가) ·
> 용어 복습 · 링크 허브(아이콘 버튼, 주소는 화면에 노출하지 않음).
> 긴 글·표·누적손익을 앱에 들이면 중복 입력이 생기고, 그 순간 둘 다 안 쓰게 된다.
> 매매 계획·집행·가드레일은 전에 있었지만 걷어냈다 — "매매탭은 없애주고" (2026-10-27).
> 되살릴 땐 git log 의 trades.js 관련 커밋을 참고할 것, 다시 만들지 말고.

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
index.html          전체 화면 구조(6개 뷰: 하루·통계·회고·용어·리서치·설정 + 모달)
css/app.css         디자인 시스템 + 모든 컴포넌트 스타일
js/util.js          날짜·시간·DOM 헬퍼 (App.util, 보통 U로 참조)
js/store.js         데이터 모델·저장·마이그레이션·파생값 (App.store)
js/market.js        KRX 거래시간 정의/판정 (App.market)
js/ui.js            토스트·모달·카테고리 팔레트 (App.ui)
js/timeline.js      PLAN|DONE 타임라인 — 칠하기·블록편집·드롭 (App.timeline)
js/routine.js       데일리 루틴 구간 엔진 — 레일·모드배너·구간 체크리스트 (App.routine)
js/judge.js         오늘 판정 — 계획 블록을 탭으로 확정해 DONE 생성 (App.judge)
js/record.js        '오늘의 기록' 허브 — 확정 시각 도장 + 링크 버튼 (App.record)
js/notify.js        구간 알림 — 탭이 열려 있을 때만 (App.notify)
js/tasks.js         프로젝트 그룹별 오늘 할 일 (App.tasks)
js/pomodoro.js      집중 타이머 → 끝나면 DONE에 자동 기록 (App.pomo)
js/day.js           하루 뷰 총괄: 날짜네비·스탯·Goal·Big3·Review (App.day)
js/stats.js         주간/월간 통계 (App.stats)
js/archive.js       회고(K/P/T) 모아보기 (App.archive)
js/terms.js         경제용어 노트 (App.terms)
js/research.js      리서치 '링크 인덱스' — 2축 분류, 본문은 노션 (App.research)
js/settings.js      타임라인·장시간·루틴구간·링크·알림·카테고리·데이터 (App.settings)
js/sync.js          기기 간 동기화 — 본인 소유 Supabase 프로젝트로 PC↔모바일 (App.sync)
js/app.js           부트스트랩 + 탭 전환 (App.nav)
tests/logic.test.js 회귀 테스트 (util/store/market/judge/routine/sync, DOM 스텁)
sw.js, manifest.webmanifest, icon.svg   PWA
supabase.sql         동기화용 테이블 DDL — 사용자가 본인 프로젝트 SQL Editor에서 1회 실행
```

## 핵심 개념
- **데이터 모델(store.js)**
  ```
  settings { dayStartHour:7, dayEndHour:24, slotMin:10, market{show,sessions}, carryOver }
  categories[] { id, name, color, group }      // group = 대분류 id (store.CAT_GROUPS)
  CAT_GROUPS   invest(투자공부: 주식공부·리서치·시황체크·투자독서) exec(매매)
               growth(자기계발: 영어·일본어·독서) body(운동) | life(생활) rest(휴식)
                      // 앞의 4개가 productive:true → '생산 시간'에 합산
                      // 학습시간 카드 = invest 그룹만 (언어는 growth 로 분리해 숫자를 흐리지 않는다)
                      // 독서는 둘로 나뉜다: '투자독서'(invest) / '독서'(growth, 일반서)
  settings.seed  기본 카테고리·할일그룹 보강 버전 (store.SEED)
                      // 올리면 누락된 기본값을 1회만 추가하고, 이름·배치 정정도 여기서 한다
                      // 사용자가 지운 기본값은 되살리지 않고, 직접 고친 이름은 덮지 않는다
                      // ⚠️ migrate 는 seed 를 defaults 병합 '전에' 읽어야 한다
  projects[]   { id, name, tab:'study'|'plan', collapsed }   // 전역 그룹
  settings.routine { enabled, phases[] }       // 구간 정의(기본 10개)
  phases[].items[] { text, min }               // min = 배분 시간(분). 0이면 타이머 없음
                      // 장중(readonly) 구간은 전부 min:0 — 장중엔 타이머를 돌리지 않는다
                      // store.phaseBudget(p) → {alloc, len, over}
  days['YYYY-MM-DD'] {
    goal, big3[3],
    plan { 'HH:MM': {c:catId, t:'제목'} },      // 계획
    done { 'HH:MM': {c:catId, t:'제목'} },      // 실행
    tasks[] { id, projectId, text, done },      // 그날의 할 일
    checks{'phaseId:index'},         // 체크 시각(ms) — phaseStamp 가 읽는다
    links{ '<linkId>': url },        // daily:true 인 링크의 그날 주소만
    judged { '<블록시작슬롯>': 'done'|'skip'|'other' },
    review { k, p, t }, mtime
  }
  ddays[] / terms[] / pomo
  updatedAt    문서 전체가 마지막으로 save() 된 시각(ms) — day.mtime 과는 별개,
               동기화(sync.js)의 "이 기기 전체가 더 최신인가"를 가르는 유일한 기준
  settings.notify { enabled, lead(분), sound }
  settings.links[] { id, label, icon, url, daily, quick }
                      // 외부 기록 링크. 이름·아이콘·순서·개수 모두 사용자가 바꾼다
                      // daily:true → URL 을 day.links[id] 에 날짜별로 저장(그날의 데일리 노트)
                      // quick:true → 주소칸 없이 '바로가기' 아이콘 버튼으로만 표시 (daily 와 배타)
                      // store.linkUrl(ds,e) / setLinkUrl(ds,e,url) 로만 읽고 쓸 것
  research[] { id, ticker, name, kind, stance, sector, url, note, body?, date, updated }
               // (매매 계획과는 다른 기능 — 종목 리서치 '링크 인덱스'. 혼동 주의)
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
- **루틴 구간**(`routine.js`, store.js `PHASES` — 2026-10-29 개정). 8구간, 07:30~22:00:
  `pre1`뉴스·미국장(07:30-08:00) → `pre2`리포트·관심종목(08:00-08:30) → `pre3`매매계획확정(08:30-09:00,
  STAMP_PHASE, **09:00에 가설 잠금**) → `obs`관찰만(09:00-09:30, 가설 잠금과 바로 이어짐, 갭 없음) →
  *갭(09:30-14:50 — '집행·입력'·'보유종목관리' 구간은 2026-10-29에 제거, 자유 재량 구간으로 둠)* →
  `close`마감대응·종가배팅(14:50-15:30) → *갭(장마감15:30-15:40)* → `rec`기록·마감분석(15:40-16:40) →
  *갭(저녁식사 등 16:40-19:00)* → `evening1`종배후보관찰(19:00-20:00) → *갭* → `learn`리포트·독서(21:00-22:00).
  **갭은 의도적**이다 — 모든 시간을 메우려 하지 말 것. (exec/hold 를 되살리고 싶으면 git log 에서
  "2026-10-28 최종 시간표" 커밋을 참고 — 그 버전엔 09:30-14:50 이 집행·입력/보유종목관리로 채워져 있었다.)
  `mode` 가 앱 동작을 바꾼다: `input`/`plan`(장전) · `observe`(매매금지) · `manage`(관리) ·
  `record`(기록) · `watch`(저녁관찰) · `learn`(학습). (`exec`/`rest` 모드는 더 안 쓰지만 예전 저장본
  호환을 위해 MODE 테이블엔 남겨둠 — 지우지 말 것.)
  **장중 구간(observe/manage)의 체크리스트는 `readonly: true`** — 사용자 원칙이
  "장중에는 기록하지 않고 읽기만"이므로 체크박스를 주지 말 것. 그 구간은 문구만 읽고 넘어간다.
  지난 구간에 체크가 하나도 없으면 레일에 **누락** 배지가 남는다(사후 보정을 유도하지 않음).
  **`phase.note`**(선택) — 체크 항목이 아닌 한 줄 원칙/리마인드. 구간 상단에 그대로 보여준다
  (readonly 구간의 기본 문구 "장중에는 읽기만"을 대체하거나, 일반 구간에 budget 줄 위로 추가됨).
  종가배팅 4조건·중단 규칙(계획외매매 1건→종료, 연속3손절/하루-2%→종료)은 전부 이 note/items로만
  존재하는 **읽기용 리마인드**다 — 자동 판정 로직을 다시 만들지 말 것(2026-10-27에 걷어낸 가드레일).
  주간(금요일 집계)·월말 복기·사업보고서 정독 등은 **의도적으로 루틴에 넣지 않았다** — 이미
  노션(Study Archive·가설 DB·월말 복기 탭)에서 관리 중이다. 요일 단위로 넣고 싶어지면 바로 아래
  `phase.days` 를 쓰면 된다(엔진은 이미 지원한다).
  **`applyToTimeline`(🧭 루틴 적용)은 구간 경계를 `slotMin` 격자에 스냅한다** — 10분 격자에 안 맞는
  경계(예: 분이 5의 배수이되 10의 배수가 아닌 시각)를 스냅 없이 그대로 칠하면 그 구간이 조용히
  안 보이는 키에 적히고 이전 구간이 그 자리를 밀고 들어가 과대 점유한다. `phaseAt`/`phaseStamp`/
  배너의 "N분 남음" 등 **실제 시각 판정은 스냅 전 원래 분 단위를 그대로 쓴다** — 스냅은 타임라인
  페인팅에만 쓴다.
- **요일 제한**(`phase.days`, 2026-10-29 신설). `[0=일,1=월,...,6=토]` 의 부분집합. **생략(undefined)
  이면 매일 적용** — 기존 전 구간이 이 상태이므로 하위 호환은 자동이다.
  - `store.phases()` — 설정에 정의된 **전부**. 편집 화면(요일 무관하게 다 보여줘야 함)에서만 쓸 것.
  - `store.phasesOn(ds)` — 그 날짜의 요일에 **실제로 적용되는** 구간만. 레일(`renderRail`)과
    `applyToTimeline` 은 반드시 이걸 쓴다. `phases()` 를 직접 돌려 화면에 뿌리지 말 것.
  - `store.phaseAt(min, ds=오늘)` — 그 분·그 날짜 기준 구간. `ds` 생략 시 오늘 요일로 거른다.
  - `store.phaseById(id)` — 요일과 **무관하게** id 로 찾는다(수동 선택·phaseStamp 등 "이 구간 자체"를
    다룰 때 전용. 레일에 안 보이는 요일이어도 직접 선택했으면 찾아져야 한다).
  - `routine.viewPhase(ds)` — 수동 선택한 구간이 그 날짜엔 적용 안 되면(요일이 바뀌어 넘어간 경우)
    자동으로 선택을 버리고 null 로 돌아간다.
  - 설정 화면(`settings.js` `daysRow`)에 일~토 7개 토글 버튼. 전부 켜진 상태로 돌아가면 `days` 를
    `delete` 해서 다시 "매일"로 접는다(불필요하게 `[0,1,2,3,4,5,6]` 을 저장해두지 않는다).
- **확정 시각 도장**(`store.phaseStamp` + `record.js`): 시트가 못 하는 유일한 것 — *언제* 확정했는가.
  `day.checks` 에 체크 시각(ms)이 들어 있으므로, `매매 계획 확정`(pre3) 구간의 **가장 늦은 체크 시각**을
  그날의 확정 시각으로 쓴다. 구간 종료(09:00)를 넘겨 체크했으면 `late` → "장 시작 후" 로 빨갛게 표시.
  사용자 원칙: *"순서가 반대가 되면 가설이 아니라 사후 합리화"*.
  통계의 **루틴 준수** 카드(3칸)가 제시간 확정 비율·구간 체크율·누락 구간을 집계한다.
  가설 **내용**은 받지 않는다 (시트 `O`·`P`·`R`).
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
- **카테고리 대분류**(`store.CAT_GROUPS`): 카테고리마다 `group` 을 달아 통계를 대분류로 묶는다.
  `minutesByGroup` / `groupMin` / `productiveMin` 으로 집계하고, 통계의 **생산 시간** 카드가
  `productive:true` 그룹 합계를 보여준다(생활·휴식 제외).
  `studyMin` 은 **invest 그룹만** — 예전 `study` boolean 은 migrate 에서 group 으로 올린다.
  카테고리를 고치면 **반드시 `App.timeline.refreshPalette()`** 도 부를 것 —
  팔레트는 init 때 한 번만 그려지므로 안 부르면 새로고침 전까지 반영되지 않는다.
- **실천율 지표는 두 개이고 기본은 카테고리 분 기준**이다.
  - `adherence(ds)` — **Σ min(계획분, 실제분) / Σ 계획분** (카테고리별). 시간이 밀려도 한 건 인정.
  - `onTimeRate(ds)` — 계획한 슬롯 '그 시간에' 실행된 비율. 밀리면 떨어진다. 보조 지표로만 표시.
  - 왜: 계획대로 다 했는데 1시간 밀린 날이 슬롯 기준으로는 47%로 찍혔다. 시간 밀림을 '안 함'과
    똑같이 처벌하면 안 된다. 통계·타임라인 푸터 모두 `adherence` 를 주 지표로 쓴다.
- **집중 타이머**(`pomodoro.js`) 두 갈래. 어느 쪽이든 끝나거나 중단하면 경과분을 DONE에 기록한다.
  - **자유 집중**(헤더 🍅) — `pomo.focusMin`(25분). 학습 구간처럼 깊게 파는 시간용.
  - **구간 항목 타이머**(체크리스트 ▶) — `pomo.toggleItem(key, min, catId, text)`.
    항목에 배분된 분만큼 돈다. 같은 항목을 다시 누르면 중단.
  - 돌고 있는 동안 `paint()` 가 `[data-pomo-key]`·`[data-pomo-btn]` 를 직접 갱신한다 —
    **전체 리렌더를 돌리지 말 것**(입력 포커스가 날아간다).
  - 왜 포모도로를 장중에 쓰지 않나: 시장은 반응해야 하는 시간이라 25분 터널이 위험하고,
    사용자 원칙도 "장중엔 읽기만"이다. 장전·기록 구간은 포모도로가 아니라
    **항목별 배분 시간 카운트다운**이 맞다(뉴스를 무한정 읽다 09시를 넘기는 걸 막는 게 목적).
- **구간 남은 시간**: 모드 배너에 `13분 남음`. 15분 이하 `soon`(주황), 5분 이하 `urgent`(빨강).
  지금 구간을 보고 있을 때만 표시하고, 20초마다 갱신한다.
- **D-day**(`day.js`): `state.ddays[]` 에 **사용자가 직접 입력**한다. 실적·공시 일정을 외부에서
  가져오지 않는다(DART 등은 브라우저 CORS 때문에 중계 서버가 필요). 하루 탭의 D-day 카드를 누르면
  모달에서 이름·날짜를 즉시 수정·삭제할 수 있다.
- **링크 버튼은 주소를 화면에 노출하지 않는다**(`record.js`). 모든 `settings.links[]` 항목이
  아이콘+이름 버튼 하나로 렌더된다 — daily/quick 구분 없이 전부 버튼형. 주소가 있으면 클릭 시
  새 탭으로 열고, 없으면 `window.prompt()` 로 입력받아 저장 후 연다. 버튼 옆 작은 `✎` 로 언제든
  재설정. **URL을 input 으로 노출하는 코드를 다시 넣지 말 것** — "링크는 안 보이게 버튼형으로"
  가 명시적 요구사항이다. 설정 화면(`settings.js` 의 `renderLinks`)은 예외로, 거기선 편집을 위해
  주소 input 을 그대로 보여준다(전역 항목만; daily 항목은 거기서도 비활성).
- **기기 간 동기화**(`sync.js`, 2026-10-28 신설). localStorage 는 기기별이라 PC·폰이 저절로 맞춰지지
  않는다는 질문에서 시작 — 사용자가 "③ 진짜 동기화"를 골라서 만들었다.
  - **앱이 백엔드를 소유하지 않는다.** 사용자가 본인 명의 무료 Supabase 프로젝트를 직접 만들고
    (`supabase.sql` 을 그 프로젝트 SQL Editor에서 1회 실행), Project URL + **anon(publishable) key**
    만 설정 화면에 붙여넣는다. 이 key 는 RLS 로 보호되는 클라이언트 공개용이라 노출돼도 안전하다
    (서비스 role key 를 요구하지 않는다 — 절대 쓰지 말 것).
    URL/key 는 메인 데이터와 분리된 `localStorage['tbxPlanner.sync.v1']` 에 저장 — "전체 초기화"에
    영향받지 않는다(의도적 분리).
  - **로그인은 비밀번호 없이 이메일 매직링크만** 쓴다(`signInWithOtp`). 계정 생성·비밀번호 관리
    부담을 없애려는 선택 — 다시 비밀번호 로그인으로 바꾸지 말 것.
  - **SDK는 CDN에서 지연 로드**한다(`@supabase/supabase-js@2` UMD, jsdelivr) — 동기화를 안 쓰는
    사용자는 그 스크립트를 아예 받지 않는다.
  - **저장 모델**: `user_state(user_id pk, data jsonb, updated_at)` 1행 = 사용자의 전체 state 스냅샷.
  - **병합 전략(v1, 의도적 단순화)** — `App.sync.mergeStates(local, remote)`:
    - `days{}` **밖**(settings·categories·projects·ddays·terms·research·pomo 등)은 **문서 전체
      `updatedAt` 이 더 큰 쪽을 통째로** 쓴다.
    - `days{}` **안**은 **날짜마다** `day.mtime` 이 더 큰 쪽을 고른다(한쪽에만 있는 날짜는 그대로 살림).
    - 기기 수에는 제한이 없다 — `user_state` 가 사용자당(이메일당) 1행이라, 같은 이메일로 로그인한
      기기는 맥북·아이패드·아이폰 몇 대든 전부 같은 행을 두고 pull/merge/push 한다.
    - ⚠️ 알려진 한계: 같은 동기화 구간 안에 두 대 이상이 `days` **밖**의 서로 다른 설정(예: 맥북에서
      루틴 구간 수정, 아이폰에서 링크 수정)을 동시에 고치면 뒤처진 쪽 변경이 버려질 수 있다. 1인
      다기기(동시 편집은 드묾) 기준으로 감내 가능하다고 보고 단순화했다 — 늘리려면(CRDT/필드별 병합
      등) 먼저 사용자와 상의할 것.
    - 순수 함수라 `tests/logic.test.js` 에서 DOM 없이 바로 검증한다.
  - **`App.store.save()`** 가 모든 로컬 변경의 유일한 공통 경로다(`touch()`도 내부에서 `save()` 호출) —
    그래서 `save()` 안에서 `state.updatedAt = Date.now()` 를 찍고 `App.sync.pushSoon()` 을 부르는
    것만으로 앱 전체의 모든 수정이 자동으로 업로드 대상이 된다. **새 저장 경로를 추가할 때도 반드시
    `save()`/`touch()` 를 거칠 것** — localStorage 를 직접 건드리면 동기화에서 빠진다.
  - **`App.store.replaceState(next)`** 는 병합 결과를 되돌려 쓸 때만 쓴다. `save()` 와 달리
    `updatedAt` 을 다시 찍지 않고(병합이 이미 결정했으므로) 자동으로 푸시하지도 않는다 — 풀 직후
    "로컬에만 있던 날짜를 되돌려 올리기" 푸시는 `pullAndMerge()` 가 **명시적으로 한 번** 부른다.
  - 풀은 로그인 직후, 수동 버튼, 그리고 **탭이 다시 보일 때마다**(`visibilitychange`/`focus`) 조용히
    일어난다. 서버 푸시가 없는 `notify.js` 와 같은 한계 — 탭을 안 열어두면 그 기기는 안 받는다.
  - 설정 화면 카드는 상태 점(꺼짐/로그인 필요/연결됨/동기화 중)과 수동 가져오기·올리기·로그아웃·
    연결 끊기 버튼을 둔다 — 자동 동기화를 믿지 못할 상황(오프라인 작업 후 등)의 탈출구.

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
