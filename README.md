# SPOTPLAN

스팟스튜디오의 **온라인 요청서 · 회차별 제안서** 웹앱입니다.

- **고객**
  - 30초짜리 최소 요청서를 작성합니다.
  - 상담 후 받은 **비밀 링크**(로그인 없음)에서 요청 내용을 확인합니다.
  - 차수별 샘플 중 마음에 드는 안을 골라 의견과 함께 보냅니다.
- **스튜디오(실장·직원)**
  - 요청 목록을 봅니다.
  - 통화 텍스트를 붙여넣어 **Claude로 요청서를 정리**합니다.
  - 무료 사진 검색(Unsplash·Pexels)이나 업로드로 샘플을 채웁니다.
  - 상담 모드에서 고객 화면에 실시간으로 반영합니다.
  - 다음 차수 만들기, 최종 확정, 데이터 삭제를 합니다.

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 전체 (GitHub Pages로 배포) |
| `supabase/setup.sql` | 데이터베이스·권한·고객용 함수·사진 저장소 설정 |
| `supabase/functions/extract-call/index.ts` | 통화 텍스트 → 요청서 정리 (Claude API) |
| `supabase/functions/photo-search/index.ts` | 무료 사진 검색 (Unsplash·Pexels) |

## 주소

| 화면 | 주소 |
|---|---|
| 고객 요청서 | `https://<계정>.github.io/spotplan/` |
| 인스타그램 등 경로별 요청서 | `https://<계정>.github.io/spotplan/?src=insta_cos` (방문 경로 자동 기록) |
| 스튜디오 | `https://<계정>.github.io/spotplan/#/studio` |
| 고객 제안서 | 스튜디오 화면의 **고객 링크 복사** 버튼 (`?p=…`) |

---

## 1. 시험 모드 (지금 바로 써 보기)

`index.html`의 `SUPABASE_URL`이 비어 있으면 **시험 모드**로 동작합니다.

- 데이터는 그 브라우저 안에만 저장되고, 다른 기기와 공유되지 않습니다.
- 스튜디오 로그인은 아무 이메일이나 입력하면 됩니다.
- 같은 브라우저에서 스튜디오 탭과 고객 링크 탭을 나란히 열면 실시간 반영을 시험해 볼 수 있습니다.
- "Claude로 정리"와 "사진 검색"은 흉내만 냅니다. 실제 동작은 Supabase를 연결한 뒤에 됩니다.

## 2. Supabase 연결 (실제 운영)

> 계정은 **앱을 운영할 사람(스튜디오) 명의**로 만드는 것을 권장합니다. 요금 결제와 고객 개인정보의 주인이 운영자이기 때문입니다.

### 2-1. 프로젝트 만들기

1. https://supabase.com 에서 가입하고 **New project**를 누릅니다.
   - Region: **Northeast Asia (Seoul)** — 나중에 바꿀 수 없습니다.
   - Plan: Free로 시작합니다. 실제 고객에게 링크를 보내기 시작할 때 Pro로 올립니다.
2. **SQL Editor → New query**를 엽니다.
   - `supabase/setup.sql` 전체를 붙여넣습니다.
   - 맨 아래 `CHANGE_ME@example.com`을 실장님 로그인 이메일로 바꿉니다.
   - **Run**을 누릅니다.
3. 직원 계정을 만듭니다.
   - **Authentication → Users → Add user → Create new user**를 누릅니다.
   - 이메일과 비밀번호를 입력하고 *Auto Confirm User*를 체크합니다.
   - 직원을 더 넣으려면 SQL Editor에서 아래를 실행합니다.
     `insert into staff (email, name, role) values ('직원@이메일', '이름', 'staff');`
4. **Authentication → Sign In / Providers**에서 *Allow new users to sign up*을 **끕니다**. 아무나 가입하지 못하게 하기 위해서입니다.
5. **Project Settings → API**에서 두 값을 복사해 둡니다.
   - Project URL
   - `anon` `public` key

### 2-2. Edge Function 2개 올리기

1. **Edge Functions → Deploy a new function → Via Editor**를 누릅니다.
2. 함수 이름을 `extract-call`로 하고, `supabase/functions/extract-call/index.ts` 내용을 붙여넣은 뒤 **Deploy**를 누릅니다.
3. 같은 방법으로 `photo-search` 함수를 올립니다.
4. **Edge Functions → Secrets**에 아래 값을 넣습니다.

| 이름 | 값 | 발급처 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API 키 | console.anthropic.com → API Keys (Settings → Limits에서 **월 한도 설정** 권장) |
| `UNSPLASH_ACCESS_KEY` | Access Key | unsplash.com/developers → New Application (시험용은 시간당 50회, 승인 후 1,000회) |
| `PEXELS_API_KEY` | API Key | pexels.com/api (시간당 200회, 월 2만 회) |
| `CLAUDE_MODEL` (선택) | 예: `claude-sonnet-4-5` | 비우면 기본값 |

### 2-3. 앱에 연결하고 배포

1. `index.html` 윗부분의 `SPOTPLAN_CONFIG`를 채웁니다.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 넣습니다.
   - 필요하면 `RENTAL_URL`, `CONTACT_PROMISE`, `PRIVACY_RETENTION`도 바꿉니다.
   - anon key는 공개되어도 되는 값입니다. 데이터는 `setup.sql`의 권한 설정(RLS)이 보호합니다.
2. GitHub 저장소의 **Settings → Pages**에서 Source를 *Deploy from a branch*로 하고, `main` / `(root)`를 고릅니다.
   - 무료 계정은 **공개 저장소**에서만 Pages를 쓸 수 있습니다.
   - 코드에는 비밀 값이 없습니다. Claude·사진 API 키는 Supabase Secrets에만 있습니다.
3. 1~2분 뒤 `https://<계정>.github.io/spotplan/#/studio`에서 로그인합니다.

## 3. 운영 전에 확인할 것

- [ ] 개인정보 동의 문구의 **보관 기간**(`PRIVACY_RETENTION`, 현재 초안값)과 문구 전체를 법인 기준으로 확정
- [ ] 제출 완료 화면의 **연락 약속 시간**(`CONTACT_PROMISE`) 확정
- [ ] 아워플레이스 예약 페이지 주소(`RENTAL_URL`)
- [ ] 통화 녹음을 쓸 경우 고객에게 녹음 사실을 알리는 방식
- [ ] Anthropic 콘솔에서 월 사용 한도 설정
- [ ] 실제 고객 링크 발송을 시작할 때 Supabase **Pro**로 전환 (무료는 1주일 미사용 시 일시 정지, 자동 백업 없음)

## 4. 직원용 사용 순서

1. **요청 목록**
   - 새 요청은 "신규 요청"으로 표시됩니다.
   - "상세 n개" 표시는 고객이 선택 항목까지 적었다는 뜻입니다. 이런 요청을 먼저 연락하면 좋습니다.
2. **전화 상담**
   - 통화 메모나 녹음 받아쓰기 텍스트를 **통화 내용 정리** 칸에 붙여넣고 **Claude로 정리**를 누릅니다.
   - 결과 화면에서 반영할 항목을 고릅니다. 통화에 없던 내용은 "고객 확인 필요"로 모입니다.
3. **요청서 공개**
   - 내용을 확인하고 *고객 화면에 요청서 공개*를 켭니다.
   - **고객 링크 복사**로 링크를 카톡이나 문자로 보냅니다.
   - 고객이 **이대로 확인**을 누르면 확정됩니다. 공개 후 요청서를 고치면 확인이 해제되어 다시 받아야 합니다.
4. **제안서 → 1차 제안 만들기**
   - 아이템마다 **사진 검색**, **사진 올리기**, **AI 이미지 올리기**로 요청 컷수의 2~3배수를 채웁니다. 2배수 미만이면 빨간색으로 표시됩니다.
   - 카드의 **수정**에서 고객에게 보일 제목과 설명을 씁니다.
   - **고객에게 공개**를 누릅니다.
5. **상담 모드** (선택)
   - **상담 시작**을 누르면 고객 화면에 "상담 중" 배너가 뜹니다.
   - 요청서 입력, **대신 선택**, **화면 이동**이 고객 화면에 바로 반영되고 "상담 중 실장 입력"으로 기록됩니다.
   - 끝나면 **상담 종료**를 누릅니다.
6. **고객 선택 후**
   - **선택안으로 다음 차수 만들기**를 누르면 고른 안이 "1차 A-2 발전안"처럼 복사되고, 고객 의견도 함께 들어갑니다. 발전안을 더해 다시 공개합니다.
7. **최종 확정**
   - 확정하면 **확정 촬영 목록**이 고정됩니다.
   - 목록은 텍스트로 복사할 수 있습니다.
8. **정리**
   - 차수별 **데이터 정리**에서 선택 안 된 샘플, 보류·취소 샘플, 차수 전체를 지울 수 있습니다.
   - 테스트·취소 프로젝트는 **데이터 관리**(관리자만)에서 한꺼번에 지웁니다.
   - 모든 삭제는 두 번 눌러야 실행됩니다.

## 5. 알려진 한계

- 고객 요청서에서 파일 첨부는 받지 않습니다. 사진이 필요하면 카톡이나 이메일로 받습니다.
- 같은 칸을 두 사람이 동시에 고치면 마지막 저장이 남습니다.
- 고객 링크를 아는 사람은 누구나 제안서를 볼 수 있습니다. 유출이 의심되면 **⋯ → 고객 링크 재발급**을 누르세요.
- 사진 검색 결과는 Unsplash·Pexels 주소를 그대로 씁니다(각 사이트 규정). 업로드한 사진만 Supabase 저장소에 저장됩니다.
- 촬영 결과물(고해상도 원본·RAW)은 이 앱에 넣지 않습니다.
