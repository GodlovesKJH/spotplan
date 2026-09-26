// SPOTPLAN · 무료 사진 검색 (Unsplash · Pexels)
// Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
// 함수 이름: photo-search  /  이 파일 전체를 붙여넣고 Deploy
// 배포 후 함수 설정에서 "Verify JWT with legacy secret"은 끕니다(직원 확인은 아래 코드가 직접 함)
// 필요한 Secrets: UNSPLASH_ACCESS_KEY, PEXELS_API_KEY (하나만 있어도 됨)
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 새 키 방식(publishable key)과 예전 방식(anon key) 모두 지원
function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const k = keys.default ?? Object.values(keys)[0];
    if (k) return String(k);
  } catch { /* 무시 */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

const UTM = "utm_source=spotplan&utm_medium=referral";

type Photo = {
  id: string; source: string; thumb: string; full: string;
  credit: string; source_url: string; download_location?: string; alt?: string;
};

async function unsplash(q: string, page: number, key: string): Promise<Photo[]> {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=15&page=${page}&content_filter=high`;
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  if (!r.ok) throw new Error(`Unsplash ${r.status}`);
  const d = await r.json();
  return (d.results ?? []).map((p: any) => ({
    id: `u_${p.id}`,
    source: "Unsplash",
    thumb: p.urls?.small,
    full: p.urls?.regular,
    credit: `${p.user?.name ?? ""}`,
    source_url: `${p.links?.html}?${UTM}`,
    download_location: p.links?.download_location,
    alt: p.alt_description ?? "",
  }));
}

async function pexels(q: string, page: number, key: string): Promise<Photo[]> {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&page=${page}`;
  const r = await fetch(u, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`Pexels ${r.status}`);
  const d = await r.json();
  return (d.photos ?? []).map((p: any) => ({
    id: `p_${p.id}`,
    source: "Pexels",
    thumb: p.src?.medium,
    full: p.src?.large2x ?? p.src?.large,
    credit: p.photographer ?? "",
    source_url: p.url,
    alt: p.alt ?? "",
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isStaff, error } = await sb.rpc("is_staff");
  if (error || isStaff !== true) return json({ error: "스튜디오 직원만 사용할 수 있습니다." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }

  const uKey = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";
  const pKey = Deno.env.get("PEXELS_API_KEY") ?? "";

  // Unsplash 가이드라인: 사진을 실제로 사용할 때 download 엔드포인트 호출
  if (body.action === "track") {
    const loc = String(body.download_location ?? "");
    if (uKey && loc.startsWith("https://api.unsplash.com/")) {
      await fetch(loc, { headers: { Authorization: `Client-ID ${uKey}` } }).catch(() => null);
    }
    return json({ ok: true });
  }

  const q = String(body.q ?? "").trim().slice(0, 100);
  if (!q) return json({ error: "검색어를 입력하세요." }, 400);
  const page = Math.max(1, Math.min(20, Number(body.page) || 1));
  const src = String(body.source ?? "all");

  const jobs: Promise<Photo[]>[] = [];
  const notes: string[] = [];
  if ((src === "all" || src === "unsplash")) {
    if (uKey) jobs.push(unsplash(q, page, uKey).catch((e) => { notes.push(String(e.message)); return []; }));
    else notes.push("Unsplash 키 없음");
  }
  if ((src === "all" || src === "pexels")) {
    if (pKey) jobs.push(pexels(q, page, pKey).catch((e) => { notes.push(String(e.message)); return []; }));
    else notes.push("Pexels 키 없음");
  }
  const lists = await Promise.all(jobs);
  // 두 사이트 결과를 번갈아 섞기
  const out: Photo[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return json({ photos: out, notes });
});
