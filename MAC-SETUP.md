# 🍎 맥에서 TamaBox 개발 이어가기 — 왕초보 가이드

> 명령어는 **한 줄씩 복사 → 터미널에 붙여넣기(⌘V) → Enter** 하면 돼요.
> 비밀번호를 물으면 맥 로그인 암호를 입력(화면에 안 보여도 정상) 후 Enter.

## 0. 큰 그림
- 코드는 GitHub(`maron2ee/timebox-quest`)에 있어요. 맥으로 **내려받아(clone)** → 고친 뒤 → **올리면(push)** 약 1분 뒤 사이트가 자동 갱신돼요.
- **직접 코드 안 짜도 됩니다.** 맥에 Claude Code를 깔고 "○○ 해줘"라고 말하면 Claude가 수정·배포까지 해줘요.

---

## 1. 터미널 열기
- `⌘(Command) + Space` → **Terminal** 입력 → Enter.
- 창이 하나 뜨면 거기에 아래 명령들을 붙여넣어요.

## 2. 개발 도구 설치

### 2-1. Homebrew (맥 프로그램 설치 도구)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
- 설치 끝에 **"Next steps"** 로 나오는 `eval "$(...)"` 2줄이 있으면, 그것도 복사해서 실행하세요(애플 실리콘 맥에서 PATH 등록용).
- 확인: `brew --version` → 버전 숫자가 나오면 성공.

### 2-2. git · gh · node 설치
```bash
brew install git gh node
```
- 확인: `git --version` / `gh --version` / `node -v` 각각 버전이 나오면 OK.

## 3. 코드 내려받기 (clone)
```bash
mkdir -p ~/Developer
cd ~/Developer
git clone https://github.com/maron2ee/timebox-quest.git
cd timebox-quest
```
- `ls` 입력 → `index.html`, `js`, `css` 등이 보이면 성공.

## 4. GitHub 로그인 (푸시용, 한 번만)
```bash
gh auth login
```
화살표 키/숫자로 다음을 고르세요:
1. **GitHub.com**
2. **HTTPS**
3. *Authenticate Git with your GitHub credentials?* → **Yes**
4. **Login with a web browser** → 화면의 코드(예: `ABCD-1234`) 복사 → 열리는 브라우저(또는 https://github.com/login/device)에 붙여넣고 **승인**
- 확인: `gh auth status` → "Logged in to github.com" 나오면 성공.
- (이전 PC에서 쓰던 옛 토큰은 GitHub → Settings → Developer settings → Personal access tokens 에서 삭제하세요.)

## 5. 로컬에서 미리보기 (선택)
```bash
npx serve .
```
- 표시되는 `http://localhost:3000` 주소를 브라우저에서 열면 앱이 떠요. (끄려면 터미널에서 `Ctrl + C`)
- `python3 -m http.server 8000` (→ http://localhost:8000) 도 됩니다.

---

## 6. ⭐ Claude Code로 개발 (추천 — 코드 안 짜도 됨)

### 설치
```bash
npm install -g @anthropic-ai/claude-code
```
- 권한 오류(`EACCES`)가 나면: `sudo npm install -g @anthropic-ai/claude-code` 후 맥 암호 입력.

### 실행
```bash
cd ~/Developer/timebox-quest
claude
```
- 처음엔 Anthropic 계정 로그인 안내가 떠요 → 브라우저로 로그인(지금 PC에서 쓰던 계정과 동일).
- 그 다음부터는 한국어로 그냥 말하면 됩니다:
  - "TamaBox에 ○○ 기능 추가해줘"
  - "이 색 바꿔줘 / 이 버튼 위치 옮겨줘"
  - "배포해줘" (→ git push까지 해서 사이트 자동 갱신)
- Claude가 저장소의 `CLAUDE.md`를 읽고 프로젝트 구조·배포 방법을 자동으로 파악해요.

---

## 7. (직접 고치고 싶을 때) 수정 → 배포
1. 편집기 설치(선택): `brew install --cask visual-studio-code` → 폴더에서 `code .`
2. 파일 수정 후 저장
3. 올리기:
```bash
git add -A
git commit -m "무엇을 바꿨는지 한 줄"
git push
```
→ 약 1분 뒤 **https://maron2ee.github.io/timebox-quest/** 에 자동 반영.
- **작업 시작 전엔 항상** `git pull` 로 최신화하세요.

## 8. 앱 데이터(동기화) 복원
맥 브라우저에서 사이트 열고 → **⚙️ 설정 → ☁️ 클라우드 동기화**:
- Supabase URL: `https://chxmhnpvqwlquioutzef.supabase.co`
- publishable key: Supabase 대시보드 → **Connect** 또는 **API Keys** 에서 복사
- **같은 이메일/비밀번호로 로그인** → 기존 계획·펫·기록이 복원됩니다.

## 9. 자주 나는 오류
| 증상 | 해결 |
|------|------|
| `command not found: brew/gh/node/claude` | 설치가 안 됐거나 터미널을 새로 열어야 함. 애플 실리콘은 Homebrew PATH 등록(2-1) 확인 |
| `git push` 인증 실패 | `gh auth login` 다시 |
| `npm ... EACCES` 권한 오류 | 앞에 `sudo ` 붙여 재시도 |
| 포트 사용 중 | 다른 포트로: `python3 -m http.server 8080` |

## 🗒️ 매일 쓰는 치트시트
```bash
cd ~/Developer/timebox-quest
git pull          # 최신 받기
claude            # Claude Code로 작업 (또는 직접 수정)
# 직접 수정했다면:
git add -A && git commit -m "변경 내용" && git push
```
