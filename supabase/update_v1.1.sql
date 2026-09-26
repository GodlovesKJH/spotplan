-- =====================================================================
-- SPOTPLAN v1.1 추가 설정 — 촬영팀 계정 · 촬영팀 인계 · 촬영 결과 납품 · 결제 기록
-- 이미 setup.sql 을 실행한 Supabase 프로젝트에서
-- SQL Editor → New query 에 이 파일 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다. 새로 설치할 때도 setup.sql 을 먼저 실행한 다음 이 파일을 실행합니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7-1. 촬영팀 계정 (여기에 있는 이메일은 "촬영팀 화면"만 사용 가능)
-- ---------------------------------------------------------------------
create table if not exists public.crew (
  email      text primary key,
  name       text not null default '',
  phone      text not null default '',
  part       text not null default '사진',      -- 사진 · 영상 · 스타일리스트 · 보조 등
  active     boolean not null default true,     -- false 면 로그인해도 일감이 안 보임
  memo       text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_crew() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew where lower(email) = public.my_email() and active);
$$;

-- 직원이 먼저, 아니면 촬영팀(role = 'crew')
create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('email', email, 'name', name, 'role', role)
       from public.staff where lower(email) = public.my_email()),
    (select jsonb_build_object('email', email, 'name', name, 'role', 'crew', 'part', part)
       from public.crew where lower(email) = public.my_email() and active),
    'null'::jsonb);
$$;

-- ---------------------------------------------------------------------
-- 7-2. 프로젝트에 납품·결제 칸 추가
--   delivery: {shared, shared_at, message, original_link, customer_ack_at, customer_note}
--   payments: {deposit:{amount,paid_at,memo}, middle:{...}, balance:{...}, total}
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists delivery jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists payments jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 7-3. 촬영팀 인계 (프로젝트당 1건, 다시 인계하면 덮어씀)
-- ---------------------------------------------------------------------
create table if not exists public.handoffs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null unique references public.projects(id) on delete cascade,
  round_id    uuid references public.rounds(id) on delete set null,
  crew_emails text[] not null default '{}',
  shoot_date  date,
  shoot_time  text not null default '',
  location    text not null default '',
  note        text not null default '',                 -- 실장 → 촬영팀 전달 사항
  info        jsonb not null default '{}'::jsonb,       -- 업체·브랜드·톤·아이템 요약 (고객 연락처 제외)
  shotlist    jsonb not null default '[]'::jsonb,       -- 확정 촬영 목록 스냅샷
  status      text not null default 'handed' check (status in ('handed','received','shooting','uploaded','delivered')),
  crew_note   text not null default '',                 -- 촬영팀 → 실장 메모
  handed_at   timestamptz not null default now(),
  handed_by   text not null default '',
  received_at timestamptz,
  uploaded_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7-4. 촬영 결과 사진
-- ---------------------------------------------------------------------
create table if not exists public.results (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  label        text not null default '',     -- 촬영 목록 번호(A-1 등) 또는 '추가'
  storage_path text,
  url          text not null default '',
  title        text not null default '',
  note         text not null default '',
  hidden       boolean not null default false,   -- 실장이 고객 화면에서 숨김
  sort         int  not null default 0,
  uploaded_by  text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists results_project_idx on public.results(project_id);

drop trigger if exists handoffs_touch on public.handoffs;
create trigger handoffs_touch after insert or update or delete on public.handoffs
  for each row execute function public.touch_project();
drop trigger if exists results_touch on public.results;
create trigger results_touch after insert or update or delete on public.results
  for each row execute function public.touch_project();

revoke all on public.crew, public.handoffs, public.results from anon;
grant select, insert, update, delete on public.crew, public.handoffs, public.results to authenticated, service_role;

alter table public.crew     enable row level security;
alter table public.handoffs enable row level security;
alter table public.results  enable row level security;

-- 촬영팀 명단: 직원은 보기, 관리자는 관리, 촬영팀은 자기 줄만 보기
drop policy if exists crew_read  on public.crew;
drop policy if exists crew_admin on public.crew;
create policy crew_read  on public.crew for select to authenticated using (public.is_staff() or lower(email) = public.my_email());
create policy crew_admin on public.crew for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- 인계: 직원은 전부, 촬영팀은 자기가 배정된 건만 보기 (상태 변경은 crew_set_status 함수로)
drop policy if exists handoffs_staff on public.handoffs;
drop policy if exists handoffs_crew  on public.handoffs;
create policy handoffs_staff on public.handoffs for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy handoffs_crew  on public.handoffs for select to authenticated using (public.is_crew() and public.my_email() = any(crew_emails));

-- 결과 사진: 직원은 전부, 촬영팀은 배정된 프로젝트만 보기·올리기, 자기가 올린 것만 고치기·지우기
drop policy if exists results_staff       on public.results;
drop policy if exists results_crew_select on public.results;
drop policy if exists results_crew_insert on public.results;
drop policy if exists results_crew_update on public.results;
drop policy if exists results_crew_delete on public.results;
create policy results_staff on public.results for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy results_crew_select on public.results for select to authenticated using (
  public.is_crew() and exists (select 1 from public.handoffs h where h.project_id = results.project_id and public.my_email() = any(h.crew_emails)));
create policy results_crew_insert on public.results for insert to authenticated with check (
  public.is_crew() and uploaded_by = public.my_email()
  and exists (select 1 from public.handoffs h where h.project_id = results.project_id and public.my_email() = any(h.crew_emails)));
create policy results_crew_update on public.results for update to authenticated
  using (public.is_crew() and uploaded_by = public.my_email()) with check (public.is_crew() and uploaded_by = public.my_email());
create policy results_crew_delete on public.results for delete to authenticated
  using (public.is_crew() and uploaded_by = public.my_email());

-- ---------------------------------------------------------------------
-- 7-5. 촬영팀 상태 변경 (인계 확인 → 촬영 중 → 업로드 완료)
-- ---------------------------------------------------------------------
create or replace function public.crew_set_status(p_handoff uuid, p_status text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  h public.handoffs;
  v_name text;
  v_cnt int;
begin
  select * into h from public.handoffs where id = p_handoff;
  if not found then raise exception 'not found'; end if;
  if not (public.is_staff() or (public.is_crew() and public.my_email() = any(h.crew_emails))) then
    raise exception 'not allowed';
  end if;
  -- p_status 가 null 이면 상태는 그대로 두고 메모만 저장
  if p_status is not null and p_status not in ('received','shooting','uploaded') then raise exception 'bad status'; end if;
  select coalesce(nullif(name,''), email) into v_name from public.crew where lower(email) = public.my_email();
  v_name := coalesce(v_name, '촬영팀');
  select count(*) into v_cnt from public.results where project_id = h.project_id;

  update public.handoffs
     set status      = coalesce(p_status, status),
         received_at = case when p_status = 'received' then now() else received_at end,
         uploaded_at = case when p_status = 'uploaded' then now() else uploaded_at end,
         crew_note   = case when p_note is null then crew_note else left(p_note, 3000) end
   where id = h.id;

  insert into public.logs (project_id, who, text)
  values (h.project_id, v_name,
          case when p_status is null then '촬영팀 메모: ' || left(coalesce(p_note,''), 200)
               when p_status = 'received' then '촬영팀 인계 내용 확인'
               when p_status = 'shooting' then '촬영 시작'
               else '촬영 결과 업로드 완료 (' || v_cnt || '장)' end);
  return 'ok';
end $$;

-- ---------------------------------------------------------------------
-- 7-6. 고객 화면 데이터에 촬영 일정·납품 결과 추가 (4-2 함수 교체)
-- ---------------------------------------------------------------------
create or replace function public.get_proposal(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pr public.projects;
  h  public.handoffs;
  v_shared boolean;
begin
  select * into pr from public.projects where token = p_token and length(p_token) >= 24;
  if not found then return null; end if;
  select * into h from public.handoffs where project_id = pr.id;
  v_shared := coalesce((pr.delivery->>'shared')::boolean, false);

  return jsonb_build_object(
    'id', pr.id,
    'company', pr.company,
    'contact_name', pr.contact_name,
    'purpose', pr.purpose,
    'status', pr.status,
    'created_at', pr.created_at,
    'updated_at', pr.updated_at,
    'consult', pr.consult,
    'request_shared', pr.request_shared,
    'request_confirmed_at', pr.request_confirmed_at,
    'request', case when pr.request_shared then pr.request
                    else jsonb_build_object('items', coalesce(pr.request->'items','[]'::jsonb)) end,
    'checks', case when pr.request_shared then pr.checks else '[]'::jsonb end,
    'handoff', case when h.id is null then null
                    else jsonb_build_object('shoot_date', h.shoot_date, 'shoot_time', h.shoot_time, 'status', h.status) end,
    'delivery', case when not v_shared then null else jsonb_build_object(
        'shared_at', pr.delivery->>'shared_at',
        'message', coalesce(pr.delivery->>'message',''),
        'original_link', coalesce(pr.delivery->>'original_link',''),
        'customer_ack_at', pr.delivery->>'customer_ack_at',
        'customer_note', coalesce(pr.delivery->>'customer_note',''),
        'results', coalesce((
          select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.label, 'url', x.url, 'title', x.title, 'note', x.note)
                           order by x.label, x.sort, x.created_at)
          from public.results x where x.project_id = pr.id and not x.hidden), '[]'::jsonb)
      ) end,
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'n', r.n, 'status', r.status, 'rev', r.rev,
        'studio_note', r.studio_note, 'customer_note', r.customer_note, 'intent', r.intent,
        'sent_at', r.sent_at, 'picked_at', r.picked_at, 'edits', r.edits,
        'samples', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'item_id', s.item_id, 'label', s.label, 'sort', s.sort, 'kind', s.kind,
            'image_url', s.image_url, 'title', s.title, 'note', s.note, 'source', s.source,
            'source_url', s.source_url, 'credit', s.credit, 'from_label', s.from_label,
            'picked', s.picked, 'pick_comment', s.pick_comment, 'picked_by', s.picked_by
          ) order by s.item_id, s.sort, s.created_at)
          from public.samples s where s.round_id = r.id and s.state is null), '[]'::jsonb)
      ) order by r.n)
      from public.rounds r where r.project_id = pr.id and r.status <> 'draft'), '[]'::jsonb)
  );
end $$;

-- 7-7. 고객이 촬영 결과를 "잘 받았습니다"로 확인
create or replace function public.confirm_delivery(p_token text, p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare
  pr public.projects;
begin
  select * into pr from public.projects where token = p_token and length(p_token) >= 24;
  if not found then raise exception 'not found'; end if;
  if not coalesce((pr.delivery->>'shared')::boolean, false) then raise exception 'not shared'; end if;
  update public.projects
     set delivery = delivery || jsonb_build_object('customer_ack_at', now(), 'customer_note', left(coalesce(p_note,''), 3000)),
         status   = case when status in ('confirmed','shooting') then 'done' else status end
   where id = pr.id;
  insert into public.logs (project_id, who, text) values (pr.id, '고객', '촬영 결과 수령 확인');
  return 'ok';
end $$;

revoke all on function public.confirm_delivery(text, text)             from public;
revoke all on function public.crew_set_status(uuid, text, text)       from public;
grant execute on function public.confirm_delivery(text, text)          to anon, authenticated;
grant execute on function public.crew_set_status(uuid, text, text)    to authenticated;
grant execute on function public.is_crew()  to authenticated;
grant execute on function public.my_email() to authenticated;
grant execute on function public.whoami()   to authenticated;

-- ---------------------------------------------------------------------
-- 7-8. 촬영 결과 사진 저장소 (공개 버킷, 주소에 추측 불가능한 번호 사용, 파일당 15MB)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('results', 'results', true, 15728640)
    on conflict (id) do update set public = true, file_size_limit = 15728640;

    drop policy if exists "spotplan results select" on storage.objects;
    drop policy if exists "spotplan staff samples select" on storage.objects;
    drop policy if exists "spotplan results upload" on storage.objects;
    drop policy if exists "spotplan results update" on storage.objects;
    drop policy if exists "spotplan results delete" on storage.objects;
    -- 파일 지우기·덮어쓰기는 목록을 볼 수 있어야 동작하므로 보기 권한도 줌 (공개 주소 보기와는 별개)
    create policy "spotplan results select" on storage.objects for select to authenticated
      using (bucket_id = 'results' and (public.is_staff() or public.is_crew()));
    create policy "spotplan staff samples select" on storage.objects for select to authenticated
      using (bucket_id = 'samples' and public.is_staff());
    create policy "spotplan results upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'results' and (public.is_staff() or public.is_crew()));
    -- 고치기·지우기: 직원은 전부, 촬영팀은 자기가 올린 파일만
    create policy "spotplan results update" on storage.objects for update to authenticated
      using (bucket_id = 'results' and (public.is_staff() or (public.is_crew() and owner_id = auth.uid()::text)));
    create policy "spotplan results delete" on storage.objects for delete to authenticated
      using (bucket_id = 'results' and (public.is_staff() or (public.is_crew() and owner_id = auth.uid()::text)));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7-9. 촬영팀 등록 예시 — 필요하면 이메일·이름을 바꿔 주석(--)을 지우고 실행하세요.
--      (앱의 "촬영팀" 메뉴에서도 관리자가 추가할 수 있습니다)
--      로그인용 계정은 Authentication → Users → Add user 로 같은 이메일을 만들어야 합니다.
-- ---------------------------------------------------------------------
-- insert into public.crew (email, name, part) values ('photo1@example.com', '촬영팀 1', '사진')
-- on conflict (email) do update set name = excluded.name, part = excluded.part;
