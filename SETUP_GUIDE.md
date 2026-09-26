# SPOTPLAN Supabase 설정 가이드 (처음 쓰는 분용)

이 가이드대로 하면 SPOTPLAN이 **시험 모드**에서 **실제 운영 모드**로 바뀝니다. 실제 운영 모드에서는 고객 요청서, 제안서, 사진, 첨부 파일이 모두 인터넷(Supabase)에 저장됩니다. 그래서 어느 기기에서든 같은 내용이 보이고, 고객에게 링크를 보낼 수 있습니다.

- 걸리는 시간: 처음이면 40분~1시간 (API 키 발급 포함)
- 비용: Supabase는 무료로 시작합니다. 돈이 드는 곳은 Claude API 사용량뿐입니다(11장).
- 화면의 메뉴 이름이나 위치는 Supabase가 가끔 바꿉니다. 이 가이드와 다르면 비슷한 이름을 찾거나, 화면을 캡처해서 Claude에게 보여 주세요.

---

## 0. 먼저 알아 두면 좋은 말

| 용어 | 뜻 |
|---|---|
| **Supabase** | 데이터 저장, 로그인, 파일 저장을 한곳에서 해 주는 인터넷 서비스. SPOTPLAN의 "창고"입니다. |
| **프로젝트** | Supabase 안에 만드는 창고 하나. SPOTPLAN용으로 1개를 만듭니다. |
| **SQL** | 창고 안에 표(요청서, 제안서 등)와 규칙을 만드는 명령문. 준비된 파일을 붙여넣고 실행만 하면 됩니다. |
| **Edge Function** | Supabase 안에서 돌아가는 작은 프로그램. SPOTPLAN은 2개를 씁니다(통화 정리, 사진 검색). |
| **Secret(비밀 값)** | Claude·사진 사이트의 API 키처럼 남에게 보이면 안 되는 값. Supabase 안에만 저장합니다. |
| **Publishable key** | 앱이 Supabase에 접속할 때 쓰는 공개용 키. `sb_publishable_`로 시작하고, 공개돼도 괜찮습니다. |
| **Secret key** | 모든 권한을 가진 관리자 키. `sb_secret_`로 시작합니다. **절대 앱이나 채팅에 붙여넣지 마세요.** |

---

## 1. 누구 명의로 만들지 먼저 정하기

SPOTPLAN은 스튜디오가 쓰는 앱입니다. 고객 개인정보의 주인도, 요금을 내는 사람도 스튜디오입니다. 그래서 **처음부터 스튜디오(운영자) 이메일로 가입하는 것**을 권장합니다.

- 스튜디오 공용 이메일(예: 구글 계정)이 있으면 그 계정으로 가입합니다.
- 재환 님 명의로 먼저 만들어도 됩니다. 나중에 운영자를 조직에 초대하고 소유자(Owner)로 넘길 수 있습니다(12장).

---

## 2. 가입하고 프로젝트 만들기 (약 5분)

1. https://supabase.com 에 들어가 오른쪽 위 **Start your project**(또는 Sign in)를 누릅니다.
2. **Continue with GitHub** 또는 이메일로 가입합니다.
   - 이메일로 가입했다면 받은 편지함의 확인 메일을 눌러야 합니다.
3. 처음이면 **조직(Organization)**을 만들라고 나옵니다.
   - Name: `스팟스튜디오` (영문 `spotstudio`도 괜찮습니다)
   - Type: 아무거나 골라도 됩니다(예: Company)
   - Plan: **Free**
   - **Create organization**을 누릅니다.
4. 이어서 **새 프로젝트(New project)** 화면이 나옵니다.

   | 칸 | 입력할 값 |
   |---|---|
   | Project name | `spotplan` |
   | Database Password | **Generate a password**를 눌러 자동 생성 → 옆의 복사 버튼으로 복사해서 **안전한 곳에 저장** (지금 가이드에서는 쓰지 않지만, 나중에 필요할 수 있습니다) |
   | Region | **Northeast Asia (Seoul)** — 나중에 바꿀 수 없으니 꼭 확인하세요 |

   - 아래에 **Security options**(보안 옵션) 같은 접힌 칸이 있으면 **기본값 그대로** 둡니다. (Data API는 켜진 상태여야 합니다. SQL 파일이 필요한 권한을 직접 설정하므로 다른 칸은 신경 쓰지 않아도 됩니다.)
5. **Create new project**를 누릅니다.
6. 1~2분 동안 준비 화면이 나옵니다. 끝나면 프로젝트 첫 화면(Project Overview)이 보입니다.

---

## 3. 데이터베이스 만들기 — SQL 붙여넣기 (약 5분)

SPOTPLAN이 쓸 표(요청서, 제안서, 샘플, 기록, 직원 목록)와 보안 규칙, 사진·첨부 파일 창고를 한 번에 만듭니다.

1. SQL 파일을 복사합니다.
   - https://github.com/GodlovesKJH/spotplan/blob/main/supabase/setup.sql 을 엽니다.
   - 파일 내용 오른쪽 위의 **복사 아이콘**(Copy raw file)을 누릅니다.
2. Supabase 왼쪽 메뉴에서 **SQL Editor**(`>_` 모양 아이콘)를 누릅니다.
3. **+ New query**(또는 빈 편집 화면)를 엽니다.
4. 편집 화면에 붙여넣습니다(Ctrl+V / Mac은 Cmd+V).
5. **맨 아래쪽**에서 이 줄을 찾습니다.

   ```sql
   values ('CHANGE_ME@example.com', '실장', 'admin')
   ```

   `CHANGE_ME@example.com`을 **실장님이 스튜디오 화면에 로그인할 이메일**로 바꿉니다. `'실장'`은 화면에 표시될 이름입니다.
   예: `values ('spotmail@naver.com', '실장', 'admin')`
6. 오른쪽 아래 **Run**을 누릅니다(Ctrl+Enter / Cmd+Enter).
   - "이 쿼리에는 위험한 작업이 있습니다(destructive operation)" 같은 확인 창이 뜨면 **Run this query**를 누르세요. 파일 안에 "있으면 지우고 다시 만들기" 명령이 있어서 뜨는 경고이고, 처음 실행에서는 지워지는 데이터가 없습니다.
7. 아래 결과 칸에 **Success. No rows returned**가 나오면 성공입니다.
   - 빨간 오류가 나오면 오류 문구를 그대로 복사해 Claude에게 보내 주세요.
8. 확인:
   - 왼쪽 **Table Editor**에 `staff`, `projects`, `rounds`, `samples`, `logs` 5개 표가 보이면 됩니다.
   - 왼쪽 **Storage**에 `samples`(Public), `attachments`(Private) 2개 버킷이 보이면 됩니다.

> 이 SQL은 여러 번 실행해도 안전합니다. 나중에 앱이 업데이트되어 SQL이 바뀌면 같은 방법으로 다시 실행하면 됩니다. (단, 맨 아래 이메일은 매번 실제 이메일로 바꿔서 실행하세요.)

---

## 4. 스튜디오 로그인 계정 만들기 (약 3분)

3장에서 적은 이메일로 로그인 계정을 만듭니다.

1. 왼쪽 메뉴 **Authentication**(사람 모양 아이콘) → **Users**를 누릅니다.
2. 오른쪽 위 **Add user** → **Create new user**를 누릅니다.
3. 입력합니다.
   - Email: 3장에서 적은 이메일과 **완전히 같게**
   - Password: 실장님이 쓸 비밀번호
   - **Auto Confirm User** 체크 (확인 메일 없이 바로 쓸 수 있게)
4. **Create user**를 누릅니다.

**직원을 더 추가하려면** 두 가지를 모두 해야 합니다.

- ① 위와 같은 방법으로 로그인 계정 만들기
- ② SQL Editor에서 아래 명령 실행 (이메일과 이름만 바꿔서)

  ```sql
  insert into staff (email, name, role) values ('직원이메일@example.com', '직원이름', 'staff');
  ```

  - `staff`: 제안서 작성·상담 가능, 프로젝트 삭제는 불가
  - `admin`: 모든 기능 + 데이터 관리(삭제) 가능

---

## 5. 아무나 가입하지 못하게 막기 (1분)

SPOTPLAN의 스튜디오 화면은 직원만 쓰는 곳입니다. 모르는 사람이 계정을 만들지 못하게 막습니다. (막지 않아도 직원 목록에 없으면 아무것도 볼 수 없지만, 막아 두는 편이 깔끔합니다.)

1. **Authentication** → **Sign In / Providers**(또는 Settings)로 갑니다.
2. **Allow new users to sign up**을 **끕니다**.
3. **Save**를 누릅니다.

> 고객은 로그인하지 않고 비밀 링크로 들어오므로, 이 설정을 꺼도 고객 이용에는 영향이 없습니다.

---

## 6. Edge Function 2개 올리기 (약 10분)

### 6-1. 통화 정리 함수 (`extract-call`)

1. 코드를 복사합니다.
   - https://github.com/GodlovesKJH/spotplan/blob/main/supabase/functions/extract-call/index.ts
   - 오른쪽 위 복사 아이콘을 누릅니다.
2. Supabase 왼쪽 메뉴 **Edge Functions**를 누릅니다.
3. **Deploy a new function** → **Via Editor**를 누릅니다.
4. 편집기에 들어 있는 예시 코드를 **모두 지우고**(Ctrl+A → Delete) 복사한 코드를 붙여넣습니다.
5. 함수 이름을 **`extract-call`**로 정확히 입력합니다.
   - 이름 칸은 보통 편집기 아래쪽(Deploy 버튼 옆)이나 위쪽에 있습니다.
   - 한 글자라도 다르면 앱이 함수를 찾지 못합니다.
6. **Deploy function**을 누릅니다. 1분 안에 끝납니다.

### 6-2. 사진 검색 함수 (`photo-search`)

같은 방법으로 올립니다.

- 코드: https://github.com/GodlovesKJH/spotplan/blob/main/supabase/functions/photo-search/index.ts
- 이름: **`photo-search`**

### 6-3. JWT 확인 설정 끄기 (중요)

새로 만든 Supabase 프로젝트는 로그인 방식이 바뀌어서, 함수의 기본 설정("Verify JWT with legacy secret")이 켜져 있으면 **직원이 로그인한 상태여도 함수 호출이 거절(401 오류)**될 수 있습니다. SPOTPLAN 함수는 코드 안에서 "등록된 직원인지"를 직접 확인하므로 이 설정을 꺼도 안전합니다.

1. **Edge Functions** 목록에서 `extract-call`을 누릅니다.
2. **Details**(또는 Settings) 탭에서 **Verify JWT with legacy secret**(또는 Enforce JWT Verification)을 **끕니다**.
3. **Save changes**를 누릅니다.
4. `photo-search`도 똑같이 합니다.

> 함수 코드를 다시 올리면(Deploy) 이 설정이 저절로 다시 켜지는 경우가 있습니다. 함수를 다시 올린 뒤에는 이 설정이 꺼져 있는지 한 번 확인하세요.

---

## 7. API 키 발급하고 Supabase에 넣기 (약 15~20분)

### 7-1. 키 발급

**① Claude API 키** (통화 내용 정리용 — 유료)

1. https://console.anthropic.com 에 들어가 가입합니다(운영자 명의 권장). 주소가 platform.claude.com으로 바뀌어 열릴 수도 있습니다.
2. **Billing**(결제)에서 카드를 등록하고 크레딧을 충전합니다. 처음에는 5~10달러면 충분합니다.
3. **API Keys** → **Create Key** → 이름 `spotplan` → 생성된 키(`sk-ant-`로 시작)를 복사합니다.
   - **이 화면을 닫으면 키를 다시 볼 수 없습니다.** 바로 7-2 단계로 가서 넣거나, 메모장에 잠깐 붙여 두세요.
4. **Settings → Limits**에서 월 사용 한도를 정해 두면 안심입니다(예: 월 20달러).

**② Unsplash 키** (무료 사진 검색)

1. https://unsplash.com/developers 에 들어가 가입(또는 로그인)합니다.
2. **Your apps** → **New Application**을 누릅니다.
3. 약관 체크 항목을 모두 체크하고, 이름(`SPOTPLAN`)과 설명(`스튜디오 제안서용 참고 사진 검색`)을 적고 만듭니다.
4. 앱 화면의 **Access Key**를 복사합니다. (Secret Key가 아니라 **Access Key**입니다)
   - 처음에는 "Demo" 상태라 시간당 50회까지 검색됩니다. 부족하면 앱 화면에서 Production 신청을 하면 시간당 1,000회로 늘어납니다.

**③ Pexels 키** (무료 사진 검색)

1. https://www.pexels.com/api/ 에 들어가 가입(또는 로그인)합니다.
2. API 키 요청 화면에서 사용 목적(`스튜디오 제안서용 참고 사진 검색`)을 적고 제출합니다.
3. 발급된 API Key를 복사합니다.

> Unsplash와 Pexels는 둘 중 하나만 있어도 사진 검색이 됩니다. 둘 다 넣으면 결과가 섞여서 나옵니다.

### 7-2. Supabase에 넣기

1. Supabase 왼쪽 메뉴 **Edge Functions** → **Secrets**(Edge Function Secrets)로 갑니다.
2. 아래 이름과 값을 넣습니다. **이름은 대문자·밑줄까지 정확히** 똑같아야 합니다.

   | Name (이름) | Value (값) |
   |---|---|
   | `ANTHROPIC_API_KEY` | ① Claude API 키 (`sk-ant-…`) |
   | `UNSPLASH_ACCESS_KEY` | ② Unsplash Access Key |
   | `PEXELS_API_KEY` | ③ Pexels API Key |

3. **Save**를 누릅니다.

> 값은 저장한 뒤에는 다시 보이지 않습니다. 잘못 넣었으면 같은 이름으로 다시 저장하면 덮어씌워집니다.

---

## 8. 앱에 Supabase 연결하기 (약 5분)

### 8-1. 두 값 복사하기

1. Supabase 프로젝트 첫 화면 위쪽의 **Connect** 버튼을 누릅니다. (또는 **Project Settings** → **API Keys**)
2. 두 값을 복사합니다.
   - **Project URL**: `https://영문숫자.supabase.co` 모양
   - **Publishable key**: `sb_publishable_`로 시작
   - (`sb_secret_`로 시작하는 **Secret key는 복사하지 마세요**)

### 8-2. config.js에 넣기

설정값은 `config.js`라는 작은 파일에 따로 모아 두었습니다.

**방법 A — Claude에게 맡기기 (가장 쉬움)**
두 값을 채팅에 붙여 주시면 제가 config.js를 고쳐서 GitHub에 올리겠습니다. 둘 다 공개돼도 되는 값이라 채팅에 붙여도 괜찮습니다.

**방법 B — GitHub에서 직접 고치기**

1. https://github.com/GodlovesKJH/spotplan/blob/main/config.js 를 엽니다.
2. 오른쪽 위 **연필 아이콘**(Edit this file)을 누릅니다.
3. 아래 두 줄을 찾아, 따옴표 안에 값을 넣습니다.

   ```js
   SUPABASE_URL: 'https://abcdefgh.supabase.co',
   SUPABASE_KEY: 'sb_publishable_xxxxxxxx',
   ```

4. 오른쪽 위 **Commit changes…** → 다시 **Commit changes**를 누릅니다.
5. 1~2분 뒤 사이트에 반영됩니다.

### 8-3. GitHub Pages가 아직 꺼져 있다면

1. https://github.com/GodlovesKJH/spotplan/settings/pages 를 엽니다.
2. **Source**: Deploy from a branch, **Branch**: `main` / `(root)` → **Save**를 누릅니다.
3. 1~2분 뒤 `https://godloveskjh.github.io/spotplan/` 이 열립니다.

---

## 9. 잘 되는지 확인하기 (약 10분)

순서대로 해 보시고, 막히는 번호를 알려 주세요.

- [ ] 1. `https://godloveskjh.github.io/spotplan/` 오른쪽 위에 **"시험 모드" 표시가 없어야** 합니다. (보이면 config.js의 두 값이 비어 있거나 틀린 것)
- [ ] 2. 요청서를 하나 작성합니다(사진 1장 첨부). "요청이 접수되었습니다"가 나오면 성공입니다.
- [ ] 3. `…/spotplan/#/studio` 에서 4장의 이메일·비밀번호로 로그인합니다.
- [ ] 4. 요청 목록에 방금 요청이 보이고, 들어가서 첨부 파일을 **받기**로 열 수 있어야 합니다.
- [ ] 5. **통화 내용 정리** 칸에 아무 통화 메모나 적고 **Claude로 정리**를 누릅니다. 10~30초 뒤 결과 창이 나오면 성공입니다.
- [ ] 6. 요청서에 아이템을 넣고 **제안서** 탭 → **1차 제안 만들기** → **+ 사진 검색**에서 `serum bottle` 검색 → 사진을 눌러 추가합니다.
- [ ] 7. **고객에게 공개** → **고객 링크 복사** → 휴대폰이나 시크릿 창에서 링크를 열어 안을 고르고 **선택 결과 보내기**를 누릅니다.
- [ ] 8. 스튜디오 화면에 고객 선택이 나타나면 모든 연결이 끝난 것입니다.
- [ ] 9. 시험한 프로젝트는 **⋯ → 테스트로 표시** 후 **데이터 관리**에서 지웁니다.

---

## 10. 문제가 생겼을 때

| 증상 | 원인과 해결 |
|---|---|
| 오른쪽 위에 계속 "시험 모드"가 보임 | config.js의 `SUPABASE_URL`이나 `SUPABASE_KEY`가 비어 있음. 고친 뒤 1~2분 기다렸다가 새로고침(Ctrl+Shift+R) |
| 요청서 제출 시 "Failed to fetch" | Project URL 오타, 또는 프로젝트가 일시 정지됨(아래 참고) |
| 로그인 시 "이메일 또는 비밀번호가 맞지 않습니다" | 4장의 계정 비밀번호 확인. Authentication → Users에서 해당 사용자 → 비밀번호 재설정 |
| 로그인은 되는데 "등록된 직원이 아닙니다" | `staff` 표에 그 이메일이 없음. 3장 5번 또는 4장의 insert 명령 실행 (대소문자·공백 확인) |
| Claude로 정리 → "스튜디오 직원만 사용할 수 있습니다" | `staff` 표 이메일 확인. 로그아웃 후 다시 로그인 |
| Claude로 정리 → 401 또는 "Invalid JWT" | 6-3의 **Verify JWT with legacy secret**이 켜져 있음 → 끄기 |
| "ANTHROPIC_API_KEY 가 설정되지 않았습니다" | 7-2의 Secret 이름 오타 확인 |
| "Claude API 오류 (400)" 또는 (401) | 크레딧 부족(400)이나 키 오류(401). Anthropic 콘솔의 Billing·API Keys 확인 |
| 사진 검색 시 "Unsplash 키 없음", "Pexels 키 없음" | 7-2의 Secret 이름·값 확인 (둘 중 하나만 넣었다면 정상 안내) |
| 사진 검색 시 "Unsplash 403" | 시간당 50회 한도 초과. 1시간 뒤 다시 하거나 Production 신청 |
| 함수 호출 시 404 | 함수 이름이 `extract-call`, `photo-search`와 정확히 같은지 확인 |
| 1주일 안 썼더니 전체가 안 됨 | 무료 요금제는 7일 동안 사용이 없으면 **일시 정지**됩니다. Supabase 대시보드에서 프로젝트를 열고 **Restore project**를 누르면 몇 분 뒤 돌아옵니다. 실제 고객에게 링크를 보내기 시작하면 Pro로 올리세요. |

오류가 해결되지 않으면 **오류 문구와 화면 캡처**를 Claude에게 보내 주세요. 브라우저에서 F12 → Console 탭의 빨간 글씨도 도움이 됩니다.

---

## 11. 비용 정리

| 항목 | 비용 | 비고 |
|---|---|---|
| Supabase Free | 0원 | 데이터 500MB, 파일 1GB. 7일 미사용 시 일시 정지, 자동 백업 없음 |
| Supabase Pro | 월 25달러 | 실제 고객 운영 시작 시 권장. 파일 100GB, 매일 백업, 일시 정지 없음. **Organization → Billing**에서 변경 (같은 프로젝트 그대로 유지) |
| Claude API | 사용한 만큼 | 통화 1건 정리에 대략 수십 원 예상 (실측 필요). 월 한도 설정 권장 |
| Unsplash / Pexels | 0원 | 사진 작가 표기는 앱이 자동으로 붙임 |
| GitHub Pages | 0원 | |

- 고객 첨부 파일은 파일당 최대 20MB라서, 무료 요금제(파일 1GB)에서는 사진이 많이 쌓이면 금방 찰 수 있습니다. **Storage** 메뉴에서 사용량을 가끔 확인하세요.

---

## 12. 나중에 운영자에게 넘기기 (재환 님 명의로 만든 경우)

1. Supabase 왼쪽 위 조직 이름 → **Organization settings** → **Team**(Members) → **Invite**로 운영자 이메일을 초대하고 역할을 **Owner**로 줍니다.
2. 운영자가 초대를 수락하면, **Billing**의 결제 카드를 운영자 카드로 바꿉니다.
3. 필요하면 재환 님 계정을 조직에서 빼거나 Developer 역할로 낮춥니다.
4. Claude·Unsplash·Pexels 키도 운영자 명의로 새로 발급해 7-2와 같은 이름으로 다시 저장하면 교체됩니다.
5. GitHub 레포는 **Settings → General → Danger Zone → Transfer ownership**으로 운영자 계정에 넘길 수 있습니다. (넘기면 주소가 `운영자계정.github.io/spotplan`으로 바뀌므로, 고객에게 알린 요청서 주소도 바뀝니다.)
