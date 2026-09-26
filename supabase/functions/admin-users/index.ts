// SPOTPLAN · 계정 관리 (실장 화면에서 직원·촬영팀 로그인 계정 만들기)  — v1.2
// Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
// 함수 이름: admin-users  /  이 파일 전체를 붙여넣고 Deploy
// 배포 후 함수 설정에서 "Verify JWT with legacy secret"은 끕니다(관리자 확인은 아래 코드가 직접 함)
// 따로 넣을 Secrets 없음 (SUPABASE_URL, 서비스 키는 Supabase가 자동으로 넣어 줌)
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 새 키 방식(publishable/secret key)과 예전 방식(anon/service_role key) 모두 지원
function envKey(jsonName: string, legacyName: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(jsonName) ?? "{}");
    const k = keys.default ?? Object.values(keys)[0];
    if (k) return String(k);
  } catch { /* 무시 */ }
  return Deno.env.get(legacyName) ?? "";
}

type Kind = "admin" | "staff" | "crew";
const KINDS: Kind[] = ["admin", "staff", "crew"];
const BAN = "876000h"; // 사실상 영구 사용 중지 (약 100년)
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const URL = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "서비스 키를 찾을 수 없습니다." }, 500);

  // 1) 요청한 사람이 관리자(실장)인지 확인
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(URL, envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
  });
  const { data: who } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const me = low(who?.user?.email);
  if (!me) return json({ error: "로그인이 필요합니다." }, 401);
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "관리자(실장)만 사용할 수 있습니다." }, 403);

  const admin = createClient(URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---------- 도우미 ----------
  async function allUsers() {
    const out: any[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Fail("로그인 계정 목록을 불러오지 못했습니다: " + error.message, 500);
      out.push(...data.users);
      if (data.users.length < 1000) break;
    }
    return out;
  }
  async function findUser(email: string) { return (await allUsers()).find((u) => low(u.email) === email) ?? null; }
  async function rows() {
    const s = await admin.from("staff").select("*");
    if (s.error) throw new Fail("staff 표를 읽지 못했습니다: " + s.error.message, 500);
    const c = await admin.from("crew").select("*");
    if (c.error) throw new Fail("crew 표를 읽지 못했습니다(update_v1.1.sql 실행 여부 확인): " + c.error.message, 500);
    return { staff: s.data as any[], crew: c.data as any[] };
  }
  async function kindOf(email: string): Promise<Kind | null> {
    const { staff, crew } = await rows();
    const s = staff.find((r) => low(r.email) === email);
    if (s) return s.role === "admin" ? "admin" : "staff";
    return crew.some((r) => low(r.email) === email) ? "crew" : null;
  }
  async function adminCount() {
    const { count } = await admin.from("staff").select("email", { count: "exact", head: true }).eq("role", "admin");
    return count ?? 0;
  }
  const must = (r: { error: any }, what: string) => { if (r.error) throw new Fail(`${what} 실패: ${r.error.message}`, 500); };

  // 명단(staff/crew)에 권한 반영. 다른 표에 있던 줄은 지움
  async function setKind(email: string, kind: Kind, f: { name?: string; part?: string; phone?: string; active?: boolean }) {
    const { staff, crew } = await rows();
    const oldS = staff.find((r) => low(r.email) === email);
    const oldC = crew.find((r) => low(r.email) === email);
    const name = f.name ?? oldS?.name ?? oldC?.name ?? "";
    if (kind === "crew") {
      must(await admin.from("crew").upsert({
        email: oldC?.email ?? email, name, part: f.part ?? oldC?.part ?? "사진", phone: f.phone ?? oldC?.phone ?? "",
        active: f.active ?? oldC?.active ?? true,
      }), "촬영팀 명단 저장");
      if (oldS) must(await admin.from("staff").delete().eq("email", oldS.email), "직원 명단 정리");
    } else {
      must(await admin.from("staff").upsert({ email: oldS?.email ?? email, name, role: kind }), "직원 명단 저장");
      if (oldC) must(await admin.from("crew").delete().eq("email", oldC.email), "촬영팀 명단 정리");
    }
  }
  async function setActive(email: string, active: boolean) {
    const u = await findUser(email);
    if (u) {
      const { error } = await admin.auth.admin.updateUserById(u.id, { ban_duration: active ? "none" : BAN } as any);
      if (error) throw new Fail("사용 여부 변경 실패: " + error.message, 500);
    }
    const { crew } = await rows();
    for (const r of crew.filter((r) => low(r.email) === email)) must(await admin.from("crew").update({ active }).eq("email", r.email), "촬영팀 사용 여부 저장");
  }
  function checkPw(pw: unknown) {
    const p = String(pw ?? "");
    if (p.length < 8) throw new Fail("비밀번호는 8자 이상으로 정해 주세요.");
    if (p.length > 72) throw new Fail("비밀번호가 너무 깁니다(72자 이하).");
    return p;
  }

  // ---------- 요청 처리 ----------
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "list") {
      const [users, { staff, crew }] = await Promise.all([allUsers(), rows()]);
      const map = new Map<string, any>();
      const get = (e: string) => {
        if (!map.has(e)) map.set(e, { email: e, name: "", kind: null, part: "", phone: "", has_login: false, active: true, last_sign_in_at: null, created_at: null });
        return map.get(e);
      };
      for (const r of staff) Object.assign(get(low(r.email)), { name: r.name, kind: r.role === "admin" ? "admin" : "staff", created_at: r.created_at });
      for (const r of crew) Object.assign(get(low(r.email)), { name: r.name, kind: "crew", part: r.part, phone: r.phone, active: r.active, created_at: r.created_at });
      for (const u of users) {
        if (!u.email) continue;
        const a = get(low(u.email));
        const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
        Object.assign(a, { has_login: true, last_sign_in_at: u.last_sign_in_at ?? null, active: a.active && !banned, created_at: a.created_at ?? u.created_at });
      }
      const order: Record<string, number> = { admin: 0, staff: 1, crew: 2 };
      const list = [...map.values()].sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3) || String(a.created_at).localeCompare(String(b.created_at)));
      return json({ me, list });
    }

    const email = low(body.email);
    if (!okEmail(email)) throw new Fail("이메일 형식을 확인하세요.");

    if (action === "create") {
      const kind = body.kind as Kind;
      if (!KINDS.includes(kind)) throw new Fail("권한을 골라 주세요.");
      const pw = checkPw(body.password);
      const name = String(body.name ?? "").trim().slice(0, 40);
      if (email === me && kind !== "admin") throw new Fail("자기 자신의 관리자 권한은 뺄 수 없습니다.");
      if (kind !== "admin" && (await kindOf(email)) === "admin" && (await adminCount()) <= 1) throw new Fail("관리자가 최소 1명은 있어야 합니다.");
      let u = await findUser(email);
      const existed = !!u;
      if (u) {
        // 이미 로그인 계정이 있으면 비밀번호만 새로 정하고 다시 사용 가능하게
        const { error } = await admin.auth.admin.updateUserById(u.id, { password: pw, ban_duration: "none", email_confirm: true } as any);
        if (error) throw new Fail("기존 계정 갱신 실패: " + error.message, 500);
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { name } });
        if (error) throw new Fail("계정 만들기 실패: " + error.message, 500);
        u = data.user;
      }
      await setKind(email, kind, { name, part: String(body.part ?? "").trim() || undefined, phone: String(body.phone ?? "").trim(), active: true });
      return json({ ok: true, existed });
    }

    if (action === "update") {
      const cur = await kindOf(email);
      const kind = (body.kind ?? cur) as Kind;
      if (!KINDS.includes(kind)) throw new Fail("권한을 골라 주세요.");
      if (email === me && kind !== "admin") throw new Fail("자기 자신의 관리자 권한은 뺄 수 없습니다.");
      if (email === me && body.active === false) throw new Fail("자기 자신은 사용 중지할 수 없습니다.");
      if (cur === "admin" && kind !== "admin" && (await adminCount()) <= 1) throw new Fail("관리자가 최소 1명은 있어야 합니다.");
      const f: any = {};
      for (const k of ["name", "part", "phone"]) if (body[k] != null) f[k] = String(body[k]).trim().slice(0, 60);
      await setKind(email, kind, f);
      if (typeof body.active === "boolean") await setActive(email, body.active);
      return json({ ok: true });
    }

    if (action === "password") {
      const pw = checkPw(body.password);
      const u = await findUser(email);
      if (!u) throw new Fail("로그인 계정이 없습니다. 먼저 계정을 만드세요.", 404);
      const { error } = await admin.auth.admin.updateUserById(u.id, { password: pw });
      if (error) throw new Fail("비밀번호 변경 실패: " + error.message, 500);
      return json({ ok: true });
    }

    if (action === "delete") {
      if (email === me) throw new Fail("자기 자신은 삭제할 수 없습니다.");
      if ((await kindOf(email)) === "admin" && (await adminCount()) <= 1) throw new Fail("관리자가 최소 1명은 있어야 합니다.");
      const { staff, crew } = await rows();
      for (const r of staff.filter((r) => low(r.email) === email)) must(await admin.from("staff").delete().eq("email", r.email), "직원 명단 삭제");
      for (const r of crew.filter((r) => low(r.email) === email)) must(await admin.from("crew").delete().eq("email", r.email), "촬영팀 명단 삭제");
      const u = await findUser(email);
      if (u) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) throw new Fail("로그인 계정 삭제 실패: " + error.message, 500);
      }
      return json({ ok: true });
    }

    throw new Fail("알 수 없는 요청입니다.");
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    return json({ error: "처리 중 오류가 났습니다.", detail: String(e) }, 500);
  }
});
