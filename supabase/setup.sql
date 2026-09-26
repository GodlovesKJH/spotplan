-- =====================================================================
-- SPOTPLAN · Supabase 설정 SQL
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전합니다(이미 있는 것은 건너뜀·덮어씀).
-- 맨 아래 "관리자 등록" 부분의 이메일을 꼭 바꿔서 실행하세요.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 스튜디오 직원 목록 (여기에 있는 이메일만 스튜디오 화면 사용 가능)
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  email      text primary key,
  name       text not null default '',
  role       text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
  );
$$;

create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('email', email, 'name', name, 'role', role)
       from public.staff
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'null'::jsonb);
$$;

-- ---------------------------------------------------------------------
-- 2. 프로젝트(요청 1건 = 프로젝트 1개)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id                   uuid primary key default gen_random_uuid(),
  token                text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  status               text not null default 'requested'
                       check (status in ('requested','consulting','proposing','confirmed','shooting','done','cancelled')),
  is_test              boolean not null default false,
  purpose              text not null default '',
  company              text not null default '',
  contact_name         text not null default '',
  phone                text not null default '',
  email                text not null default '',
  consent_at           timestamptz,
  intake               jsonb not null default '{}'::jsonb,   -- 고객이 요청서에 적은 선택 항목
  source               text not null default '',             -- 방문 경로
  request              jsonb not null default '{}'::jsonb,   -- 상담으로 완성한 요청서
  checks               jsonb not null default '[]'::jsonb,   -- 고객 확인 필요 목록
  request_shared       boolean not null default false,
  request_confirmed_at timestamptz,
  consult              jsonb not null default '{}'::jsonb,   -- 상담 모드 상태
  studio_memo          text not null default ''              -- 스튜디오 전용 메모
);

create table if not exists public.rounds (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  n             int  not null,
  status        text not null default 'draft' check (status in ('draft','sent','picked','final')),
  rev           int  not null default 1,
  studio_note   text not null default '',
  customer_note text not null default '',
  intent        text not null default '',
  counters      jsonb not null default '{}'::jsonb,
  edits         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  picked_at     timestamptz,
  unique (project_id, n)
);

create table if not exists public.samples (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  item_id      text not null,
  label        text not null,
  sort         int  not null default 0,
  kind         text not null default 'photo' check (kind in ('photo','ai','upload','link')),
  image_url    text not null default '',
  storage_path text,
  title        text not null default '',
  note         text not null default '',
  source       text not null default '',
  source_url   text not null default '',
  credit       text not null default '',
  from_label   text not null default '',
  state        text check (state in ('hold','cancel')),
  picked       boolean not null default false,
  pick_comment text not null default '',
  picked_by    text not null default '',
  picked_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.logs (
  id         bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  at         timestamptz not null default now(),
  who        text not null default '',
  text       text not null default ''
);

create index if not exists rounds_project_idx  on public.rounds(project_id);
create index if not exists samples_project_idx on public.samples(project_id);
create index if not exists samples_round_idx   on public.samples(round_id);
create index if not exists logs_project_idx    on public.logs(project_id);

-- updated_at 자동 갱신 (목록을 최근 변경순으로 보기 위함)
create or replace function public.touch_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'projects' then
    new.updated_at := now();
    return new;
  end if;
  update public.projects set updated_at = now()
   where id = coalesce(new.project_id, old.project_id);
  return coalesce(new, old);
end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_project();
drop trigger if exists rounds_touch on public.rounds;
create trigger rounds_touch after insert or update or delete on public.rounds
  for each row execute function public.touch_project();
drop trigger if exists samples_touch on public.samples;
create trigger samples_touch after insert or update or delete on public.samples
  for each row execute function public.touch_project();

-- ---------------------------------------------------------------------
-- 3. 권한(RLS): 테이블은 직원만. 고객은 아래 4개 함수로만 접근.
-- ---------------------------------------------------------------------
alter table public.staff    enable row level security;
alter table public.projects enable row level security;
alter table public.rounds   enable row level security;
alter table public.samples  enable row level security;
alter table public.logs     enable row level security;

drop policy if exists staff_read  on public.staff;
drop policy if exists staff_admin on public.staff;
create policy staff_read  on public.staff for select to authenticated using (public.is_staff());
create policy staff_admin on public.staff for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists projects_staff_select on public.projects;
drop policy if exists projects_staff_insert on public.projects;
drop policy if exists projects_staff_update on public.projects;
drop policy if exists projects_admin_delete on public.projects;
create policy projects_staff_select on public.projects for select to authenticated using (public.is_staff());
create policy projects_staff_insert on public.projects for insert to authenticated with check (public.is_staff());
create policy projects_staff_update on public.projects for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy projects_admin_delete on public.projects for delete to authenticated using (public.is_admin());

drop policy if exists rounds_staff  on public.rounds;
drop policy if exists samples_staff on public.samples;
drop policy if exists logs_staff    on public.logs;
create policy rounds_staff  on public.rounds  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy samples_staff on public.samples for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy logs_staff    on public.logs    for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 4. 고객용 함수 (로그인 없이 비밀 링크 token 으로만 접근)
-- ---------------------------------------------------------------------

-- 4-1. 최소 요청서 제출
create or replace function public.submit_request(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_purpose text := left(trim(coalesce(p->>'purpose','')), 40);
  v_name    text := left(trim(coalesce(p->>'contact_name','')), 100);
  v_phone   text := left(trim(coalesce(p->>'phone','')), 40);
  v_email   text := left(trim(coalesce(p->>'email','')), 200);
  v_intake  jsonb := coalesce(p->'intake', '{}'::jsonb);
  v_id      uuid;
begin
  if v_purpose not in ('detail','ad','sns','film','direction','rental') then
    raise exception 'invalid purpose';
  end if;
  if v_name = '' or v_phone = '' or v_email = '' then
    raise exception 'required fields missing';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'consent required';
  end if;
  if length(v_intake::text) > 6000 then
    raise exception 'too long';
  end if;
  -- 과도한 자동 제출 방지: 최근 10분 동안 60건 넘으면 거부
  if (select count(*) from public.projects where created_at > now() - interval '10 minutes') > 60 then
    raise exception 'too many requests';
  end if;

  insert into public.projects (purpose, company, contact_name, phone, email, consent_at, intake, source)
  values (v_purpose, left(trim(coalesce(p->>'company','')), 100), v_name, v_phone, v_email, now(),
          v_intake, left(coalesce(p->>'source',''), 60))
  returning id into v_id;

  insert into public.logs (project_id, who, text) values (v_id, '고객', '온라인 요청서 접수');
  return 'ok';
end $$;

-- 4-2. 고객 화면 데이터 (연락처·스튜디오 메모·보류/취소 샘플·작성 중 차수는 제외)
create or replace function public.get_proposal(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pr public.projects;
begin
  select * into pr from public.projects where token = p_token and length(p_token) >= 24;
  if not found then return null; end if;

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

-- 4-3. 고객 선택 제출
create or replace function public.submit_picks(p_token text, p_round uuid, p_picks jsonb, p_note text, p_intent text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pr public.projects;
  rd public.rounds;
  pk jsonb;
  cnt int := 0;
begin
  select * into pr from public.projects where token = p_token and length(p_token) >= 24;
  if not found then raise exception 'not found'; end if;
  select * into rd from public.rounds where id = p_round and project_id = pr.id;
  if not found then raise exception 'round not found'; end if;
  if rd.status not in ('sent','picked') then raise exception 'round closed'; end if;
  if jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 300 then raise exception 'bad picks'; end if;

  for pk in select * from jsonb_array_elements(p_picks) loop
    update public.samples
       set picked       = coalesce((pk->>'picked')::boolean, false),
           pick_comment = left(coalesce(pk->>'comment',''), 1000),
           picked_by    = case when coalesce((pk->>'picked')::boolean,false) then 'customer' else '' end,
           picked_at    = case when coalesce((pk->>'picked')::boolean,false) then now() else null end
     where id = (pk->>'id')::uuid and round_id = rd.id and state is null;
    if coalesce((pk->>'picked')::boolean, false) then cnt := cnt + 1; end if;
  end loop;

  update public.rounds
     set status = 'picked', picked_at = now(),
         customer_note = left(coalesce(p_note,''), 3000),
         intent = case when p_intent in ('next','confirm') then p_intent else '' end
   where id = rd.id;

  insert into public.logs (project_id, who, text)
  values (pr.id, '고객', rd.n || '차 선택 제출 (' || cnt || '안 선택'
          || case when p_intent = 'confirm' then ', 확정 희망' when p_intent = 'next' then ', 다음 제안 희망' else '' end || ')');
  return 'ok';
end $$;

-- 4-4. 고객이 요청서 내용을 "이대로 확인"
create or replace function public.confirm_request(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare
  pr public.projects;
begin
  select * into pr from public.projects where token = p_token and length(p_token) >= 24;
  if not found then raise exception 'not found'; end if;
  if not pr.request_shared then raise exception 'not shared'; end if;
  update public.projects set request_confirmed_at = now() where id = pr.id;
  insert into public.logs (project_id, who, text) values (pr.id, '고객', '요청서 내용 "이대로 확인"');
  return 'ok';
end $$;

revoke all on function public.submit_request(jsonb)                          from public;
revoke all on function public.get_proposal(text)                             from public;
revoke all on function public.submit_picks(text, uuid, jsonb, text, text)    from public;
revoke all on function public.confirm_request(text)                          from public;
grant execute on function public.submit_request(jsonb)                       to anon, authenticated;
grant execute on function public.get_proposal(text)                          to anon, authenticated;
grant execute on function public.submit_picks(text, uuid, jsonb, text, text) to anon, authenticated;
grant execute on function public.confirm_request(text)                       to anon, authenticated;
grant execute on function public.is_staff()  to authenticated;
grant execute on function public.is_admin()  to authenticated;
grant execute on function public.whoami()    to authenticated;

-- ---------------------------------------------------------------------
-- 5. 실시간 반영(스튜디오 목록용)과 사진 저장소
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.projects;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('samples', 'samples', true)
    on conflict (id) do nothing;

    drop policy if exists "spotplan staff upload" on storage.objects;
    drop policy if exists "spotplan staff update" on storage.objects;
    drop policy if exists "spotplan staff delete" on storage.objects;
    create policy "spotplan staff upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'samples' and public.is_staff());
    create policy "spotplan staff update" on storage.objects for update to authenticated
      using (bucket_id = 'samples' and public.is_staff());
    create policy "spotplan staff delete" on storage.objects for delete to authenticated
      using (bucket_id = 'samples' and public.is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. 관리자 등록 — 아래 이메일을 실장님 로그인 이메일로 바꿔서 실행하세요.
--    직원 추가도 같은 방식입니다(role 을 'staff' 로).
-- ---------------------------------------------------------------------
insert into public.staff (email, name, role)
values ('CHANGE_ME@example.com', '실장', 'admin')
on conflict (email) do update set name = excluded.name, role = excluded.role;
