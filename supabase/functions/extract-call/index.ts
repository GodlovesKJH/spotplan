// SPOTPLAN · 통화 텍스트 → 요청서 정리 (Claude API)
// Supabase 대시보드 → Edge Functions → Deploy a new function → Via Editor
// 함수 이름: extract-call  /  이 파일 전체를 붙여넣고 Deploy
// 필요한 Secrets: ANTHROPIC_API_KEY (선택: CLAUDE_MODEL)
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `당신은 제품촬영 스튜디오 '스팟스튜디오'의 상담 기록 정리 담당입니다.
실장과 고객의 통화 내용(메모 또는 녹음 받아쓰기)을 읽고 촬영 요청서 칸에 나눠 정리합니다.

규칙
- 통화에 실제로 나온 내용만 적습니다. 추측하거나 지어내지 않습니다.
- 나오지 않았거나 애매한 항목은 빈 문자열("")로 두고, 고객에게 확인할 점을 checks에 한 줄씩 적습니다.
  예: "예산 범위 언급 없음", "앰플 컷수가 3컷인지 4컷인지 불분명".
- 아이템(제품)별 컷수는 숫자로. 컷수가 불분명하면 cuts를 null로 두고 checks에 적습니다.
- 받아쓰기 오류로 보이는 단어는 문맥상 명백할 때만 고칩니다.
- 모든 값은 한국어로, 짧고 명확하게 씁니다. 고객 이름·전화번호 같은 연락처는 옮기지 않습니다.
- search_keywords는 무료 사진 사이트(Unsplash·Pexels) 검색용 영어 검색어 3~6개입니다(예: "serum bottle water splash").
- next_questions는 다음 통화 때 물어보면 좋은 질문 2~5개입니다.`;

const TOOL = {
  name: "fill_request",
  description: "통화 내용을 촬영 요청서 칸에 정리한다.",
  input_schema: {
    type: "object",
    properties: {
      usage: { type: "string", description: "촬영 목적·활용처 (상세페이지, 광고 소재, SNS 등)" },
      brand: { type: "string", description: "브랜드명" },
      industry: { type: "string", description: "업종·제품군" },
      items: {
        type: "array",
        description: "촬영할 제품(아이템)별 요청",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            cuts: { type: ["integer", "null"] },
            desc: { type: "string", description: "원하는 연출·구도·요청 사항" },
          },
          required: ["name", "cuts", "desc"],
        },
      },
      schedule: { type: "string", description: "희망 촬영일·납품일" },
      budget: { type: "string", description: "예산 범위" },
      tone: { type: "string", description: "톤·무드·색감" },
      references: { type: "string", description: "레퍼런스(링크, 참고 브랜드 등)" },
      notes: { type: "string", description: "기타 요청 사항 (모델, 스타일링, 소품, 영상 등)" },
      checks: { type: "array", items: { type: "string" }, description: "고객 확인 필요 사항" },
      next_questions: { type: "array", items: { type: "string" } },
      search_keywords: { type: "array", items: { type: "string" } },
    },
    required: ["usage", "brand", "industry", "items", "schedule", "budget", "tone", "references", "notes", "checks", "next_questions", "search_keywords"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // 스튜디오 직원만 사용 가능
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: isStaff, error: staffErr } = await sb.rpc("is_staff");
  if (staffErr || isStaff !== true) return json({ error: "스튜디오 직원만 사용할 수 있습니다." }, 403);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }, 500);

  let body: { text?: string; current?: unknown };
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }
  const text = String(body.text ?? "").trim();
  if (text.length < 10) return json({ error: "통화 내용이 너무 짧습니다." }, 400);
  if (text.length > 30000) return json({ error: "통화 내용이 너무 깁니다(3만 자 이하)." }, 400);

  const current = body.current ? JSON.stringify(body.current).slice(0, 6000) : "";
  const userMsg =
    (current ? `현재 요청서에 이미 적힌 내용(참고용, 통화에서 바뀐 부분만 반영):\n${current}\n\n` : "") +
    `통화 내용:\n"""\n${text}\n"""`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-5",
      max_tokens: 3000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "fill_request" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `Claude API 오류 (${res.status})`, detail: detail.slice(0, 500) }, 502);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!block) return json({ error: "정리 결과를 받지 못했습니다." }, 502);
  return json({ result: block.input, usage: data.usage ?? null, model: data.model });
});
