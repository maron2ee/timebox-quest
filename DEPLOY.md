# 🚀 TamaBox 무료 배포 가이드

정적 웹앱이라 **빌드 없이** 어떤 무료 정적 호스팅에도 그대로 올라갑니다.
배포하면 PWA 설치 · 오프라인 · 클라우드 동기화가 모두 동작해요.

---

## 옵션 1. Netlify Drop — 가장 빠름 (계정/CLI 불필요) ⭐

1. 브라우저에서 **https://app.netlify.com/drop** 열기 (이미 열어뒀어요)
2. 아래 중 하나를 **드롭존에 끌어다 놓기**:
   - 압축본 **`C:\Users\wisebirds\timebox-quest-deploy.zip`** (탐색기에서 선택해 뒀어요), 또는
   - `timebox-quest` **폴더 자체**
3. 몇 초 뒤 `https://무작위이름.netlify.app` 주소가 생기고 바로 접속 가능
4. 그 URL을 **계속 쓰고 재배포**하려면 무료 가입(로그인) → 사이트가 계정에 저장됨.
   이후 수정본은 같은 방식으로 다시 드롭하면 갱신돼요. (가입 안 하면 임시 URL)

> 폰에서 그 URL 접속 → 브라우저 메뉴 **"홈 화면에 추가/앱 설치"** 로 앱처럼 사용.

---

## 옵션 2. GitHub Pages — 영구 URL · 같은 주소 유지

로컬 git 저장소는 이미 만들어 커밋해 뒀어요(`git log` 확인 가능).

### 2-A. GitHub CLI 사용 (가장 자동)
```bash
# 1) gh 설치 (Windows)
winget install --id GitHub.cli -e
# 2) 새 터미널 열고 로그인 (브라우저 인증)
gh auth login
# 3) 저장소 생성 + 푸시 (timebox-quest 폴더에서)
cd C:\Users\wisebirds\timebox-quest
gh repo create timebox-quest --public --source=. --push
# 4) Pages 켜기 (main 브랜치 루트)
gh api -X POST repos/{owner}/timebox-quest/pages -f "source[branch]=main" -f "source[path]=/"
```
→ 약 1분 뒤 `https://<아이디>.github.io/timebox-quest/` 에서 접속.

### 2-B. 웹으로 (CLI 없이)
1. github.com 에서 `timebox-quest` 새 저장소(public) 생성
2. 안내된 remote 주소로 푸시:
   ```bash
   cd C:\Users\wisebirds\timebox-quest
   git branch -M main
   git remote add origin https://github.com/<아이디>/timebox-quest.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Source: `main` / `/ (root)`** 저장 → 1분 뒤 URL 발급

---

## 옵션 3. 그 외
- **Cloudflare Pages / Vercel**: 위 GitHub 저장소를 연결하면 푸시할 때마다 자동 배포.
- **Surge**: `npx surge C:\Users\wisebirds\timebox-quest` (가입 인라인, 빠름)

---

## 배포 후 체크리스트
- [ ] URL 접속 → 정상 표시(픽셀 네이비/노랑 테마)
- [ ] 폰에서 접속 → "홈 화면에 추가"로 설치 → 오프라인에서도 열리는지
- [ ] 클라우드 동기화: 설정 → Supabase URL/anon key 입력 → 이메일/비번 가입·로그인
      (비밀번호 로그인은 리다이렉트 설정 불필요. RLS로 본인 데이터만 접근)
- [ ] 수정 후 재배포: Netlify는 다시 드롭 / GitHub는 `git add -A && git commit -m "..." && git push`

## 재배포용 압축 만들기 (Netlify Drop)
PowerShell:
```powershell
Compress-Archive -Path "C:\Users\wisebirds\timebox-quest\*" -DestinationPath "C:\Users\wisebirds\timebox-quest-deploy.zip" -Force
```
