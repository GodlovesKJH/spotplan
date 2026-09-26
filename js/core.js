/* SPOTPLAN — 공통 도구 · 고정 목록 · 데이터 계층 1 (Supabase 운영 모드) */
/* =====================================================================
   공통 도구
   ===================================================================== */
const CFG = window.SPOTPLAN_CONFIG;
const SB_KEY = CFG.SUPABASE_KEY || CFG.SUPABASE_ANON_KEY || '';
const DEMO = !CFG.SUPABASE_URL || !SB_KEY;
const BRAND = CFG.BRAND_NAME || 'SpotStudio';
const APP_VERSION = CFG.APP_VERSION || 'v1.1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowIso = () => new Date().toISOString();
const rid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
const extOf = name => { const m = String(name || '').match(/\.([A-Za-z0-9]{1,8})$/); return m ? m[1].toLowerCase() : 'bin'; };
const isImageAtt = a => /^image\//.test(a.type || '') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(a.name || '');
/* 새 창에서 파일 열기 (팝업 차단을 피하려고 창을 먼저 연 뒤 주소를 넣음) */
async function openFile(getUrl, name) {
  const w = window.open('', '_blank');
  try {
    const url = await getUrl();
    if (url.startsWith('data:')) { if (w) w.close(); const a = document.createElement('a'); a.href = url; a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove(); return; }
    if (w) w.location = url; else location.href = url;
  } catch (e) { if (w) w.close(); fail(e); }
}
const fmt = (iso, withTime = true) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}` + (withTime ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : '');
};
const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  return fmt(iso, false);
};
function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); return fn(...a); }; return d; }
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function fail(e) { console.error(e); toast('오류: ' + (e && e.message ? e.message : e), 4200); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
  toast('복사했습니다');
}
/* 두 번 눌러야 실행되는 삭제 버튼 */
function twoClick(btn, action, armedText = '한 번 더 누르면 삭제') {
  if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.disabled = true; Promise.resolve(action()).catch(fail).finally(() => { btn.disabled = false; }); return; }
  const orig = btn.textContent; btn.dataset.armed = '1'; btn.textContent = armedText; btn.classList.add('warn-armed');
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = orig; btn.classList.remove('warn-armed'); } }, 3500);
}
function logoSvg(size = 22) {
  let c = '';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) c += `<circle cx="${2 + x * 4}" cy="${2 + y * 4}" r="1.35" fill="${(x + y) % 3 === 0 ? 'var(--strong)' : 'var(--dot)'}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${c}</svg>`;
}
/* 사진 축소: 긴 변 1600px JPEG */
function resizeImage(file, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('이미지 변환 실패')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다')); };
    img.src = url;
  });
}
function blobToDataUrl(blob) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }

/* =====================================================================
   고정 목록
   ===================================================================== */
const PURPOSES = [
  { k: 'detail', t: '상세페이지', d: '쇼핑몰·스마트스토어 상세페이지' },
  { k: 'ad', t: '광고 소재', d: 'SNS·검색 광고, 배너' },
  { k: 'sns', t: 'SNS 콘텐츠', d: '인스타그램 피드·릴스' },
  { k: 'film', t: '브랜드 영상', d: '제품 영상·브랜드 필름·GIF' },
  { k: 'direction', t: '아직 모르겠어요', d: '방향부터 함께 잡고 싶어요' },
  { k: 'rental', t: '스튜디오 렌탈', d: '공간만 빌리고 싶어요' },
];
const purposeName = k => (PURPOSES.find(p => p.k === k) || { t: k || '-' }).t;
const STATUS = {
  requested: '신규 요청', consulting: '상담 중', proposing: '제안 중', confirmed: '확정',
  shooting: '촬영', done: '완료', cancelled: '취소',
};
const STAGES = ['요청', '상담', '제안', '확정', '촬영', '납품'];
const HANDOFF_STATUS = { handed: '인계됨 · 촬영팀 확인 전', received: '촬영팀 확인', shooting: '촬영 중', uploaded: '결과 업로드 완료', delivered: '고객에게 공개' };
const PAY_ROWS = [['deposit', '계약금'], ['middle', '중도금'], ['balance', '잔금']];
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
/* 공개 저장소 사진을 파일로 받는 주소 (Supabase 공개 버킷은 ?download= 를 붙이면 내려받기) */
const dlUrl = (url, name) => url.startsWith('data:') ? url : url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(name || 'photo.jpg');
const stageIndex = s => ({ requested: 0, consulting: 1, proposing: 2, confirmed: 3, shooting: 4, done: 5 }[s] ?? 0);
const ROUND_STATUS = { draft: '작성 중 (고객 비공개)', sent: '고객 공개', picked: '고객 선택 완료', final: '최종 확정' };
const REQ_FIELDS = [
  ['usage', '목적·활용처'], ['brand', '브랜드'], ['industry', '업종·제품군'], ['schedule', '희망 일정'],
  ['budget', '예산 범위'], ['tone', '톤·무드'], ['references', '레퍼런스'], ['notes', '기타 요청'],
];
const SOURCES = ['네이버 검색', '인스타그램', '크몽', '스페이스클라우드·아워플레이스', '지인 소개', '기존 고객 재방문', '기타'];
const INTAKE_LABELS = { product: '제품·수량', schedule: '희망 일정', reference: '레퍼런스', contact_pref: '상담 방식', call_time: '통화 가능 시간', memo: '남긴 말' };

function dotsHtml(status) {
  const cur = stageIndex(status);
  return `<div class="dots">${STAGES.map((s, i) => `${i ? '<span class="bar"></span>' : ''}<span class="st ${i < cur ? 'done' : i === cur ? 'cur' : ''}"><span class="d"></span>${s}</span>`).join('')}</div>`;
}
/* =====================================================================
   데이터 계층 1: Supabase (운영 모드)
   ===================================================================== */
function makeSupabaseDB() {
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, SB_KEY);
  const T = t => sb.from(t);
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  /* 사진 파일은 다른 차수의 발전안이 같은 파일을 쓸 수 있으므로, 행을 지운 뒤 아무도 쓰지 않는 파일만 지움 */
  async function removeFiles(rows) {
    let paths = [...new Set((rows || []).map(r => r.storage_path).filter(Boolean))];
    if (!paths.length) return;
    const still = chk(await T('samples').select('storage_path').in('storage_path', paths));
    const keep = new Set(still.map(x => x.storage_path));
    paths = paths.filter(x => !keep.has(x));
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await sb.storage.from('samples').remove(paths.slice(i, i + 100));
      if (error) console.warn('사진 파일 삭제 실패', error);
    }
  }
  return {
    mode: 'supabase',
    async submitRequest(p) { chk(await sb.rpc('submit_request', { p })); },
    async getProposal(token) { return chk(await sb.rpc('get_proposal', { p_token: token })); },
    async submitPicks(token, roundId, picks, note, intent) { chk(await sb.rpc('submit_picks', { p_token: token, p_round: roundId, p_picks: picks, p_note: note, p_intent: intent })); },
    async confirmRequest(token) { chk(await sb.rpc('confirm_request', { p_token: token })); },

    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(email, pw) { const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw new Error(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않습니다.' : error.message); },
    async signOut() { await sb.auth.signOut(); },
    async whoami() { return chk(await sb.rpc('whoami')); },

    async listProjects() { return chk(await T('projects').select('*').order('updated_at', { ascending: false }).limit(500)); },
    async getProject(id) { return chk(await T('projects').select('*').eq('id', id).single()); },
    async createProject(o) { return chk(await T('projects').insert(o).select().single()); },
    async updateProject(id, patch) { return chk(await T('projects').update(patch).eq('id', id).select().single()); },
    async regenToken(id) { const t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); return chk(await T('projects').update({ token: t }).eq('id', id).select().single()); },
    async deleteProjects(ids) {
      const files = chk(await T('samples').select('storage_path').in('project_id', ids));
      const atts = chk(await T('projects').select('attachments').in('id', ids)).flatMap(p => (p.attachments || []).map(a => a.path)).filter(Boolean);
      const resFiles = chk(await T('results').select('storage_path').in('project_id', ids)).map(r => r.storage_path).filter(Boolean);
      const del = chk(await T('projects').delete().in('id', ids).select('id'));
      await removeFiles(files);
      for (let i = 0; i < resFiles.length; i += 100) { const { error } = await sb.storage.from('results').remove(resFiles.slice(i, i + 100)); if (error) console.warn('결과 사진 삭제 실패', error); }
      for (let i = 0; i < atts.length; i += 100) { const { error } = await sb.storage.from('attachments').remove(atts.slice(i, i + 100)); if (error) console.warn('첨부 파일 삭제 실패', error); }
      if (del.length < ids.length) throw new Error('일부 프로젝트를 지우지 못했습니다(관리자 권한 필요).');
    },

    async listRounds(pid) { return chk(await T('rounds').select('*').eq('project_id', pid).order('n')); },
    async createRound(o) { return chk(await T('rounds').insert(o).select().single()); },
    async updateRound(id, p) { return chk(await T('rounds').update(p).eq('id', id).select().single()); },
    async deleteRound(id) { const files = chk(await T('samples').select('storage_path').eq('round_id', id)); chk(await T('rounds').delete().eq('id', id)); await removeFiles(files); },

    async listSamples(pid) { return chk(await T('samples').select('*').eq('project_id', pid).order('sort').order('created_at')); },
    async addSamples(arr) { return chk(await T('samples').insert(arr).select()); },
    async updateSample(id, p) { return chk(await T('samples').update(p).eq('id', id).select().single()); },
    async deleteSamples(rows) { if (!rows.length) return; chk(await T('samples').delete().in('id', rows.map(r => r.id))); await removeFiles(rows); },

    async listLogs(pid) { return chk(await T('logs').select('*').eq('project_id', pid).order('at', { ascending: false }).limit(300)); },
    async addLog(pid, who, text) { chk(await T('logs').insert({ project_id: pid, who, text })); },

    /* 고객 첨부: 비공개 버킷에 올리기만 가능. 한글 파일명은 저장 경로에 못 쓰므로 번호로 저장하고 원래 이름은 따로 기록 */
    async uploadAttachment(file, folder, i) {
      const path = `req/${folder}/${i}.${extOf(file.name)}`;
      const { error } = await sb.storage.from('attachments').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (error) throw new Error(`파일을 올리지 못했습니다: ${file.name} (${error.message})`);
      return { path, name: file.name, size: file.size, type: file.type || '' };
    },
    async attachmentUrl(a, download) {
      const { data, error } = await sb.storage.from('attachments').createSignedUrl(a.path, 3600, download ? { download: a.name } : undefined);
      if (error) throw new Error('첨부 파일을 열 수 없습니다: ' + error.message);
      return data.signedUrl;
    },
    async upload(blob) {
      const path = `${new Date().toISOString().slice(0, 7)}/${rid()}.jpg`;
      chk(await sb.storage.from('samples').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      return { path, url: sb.storage.from('samples').getPublicUrl(path).data.publicUrl };
    },
    async fn(name, body) {
      const { data, error } = await sb.functions.invoke(name, { body });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); msg = j.error || msg; if (j.detail) console.warn(j.detail); } catch {}
        throw new Error(msg);
      }
      return data;
    },
    channel(name, onMsg) {
      const ch = sb.channel('sp-' + name, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload || {})).subscribe();
      return { send: p => ch.send({ type: 'broadcast', event: 'm', payload: p }).catch(() => {}), close: () => sb.removeChannel(ch) };
    },
    watchProjects(cb) {
      const ch = sb.channel('sp-projects-' + rid()).on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => cb()).subscribe();
      return () => sb.removeChannel(ch);
    },

    /* v1.1 촬영팀 · 인계 · 납품 */
    async listCrew() { return chk(await T('crew').select('*').order('created_at')); },
    async saveCrew(o) { return chk(await T('crew').upsert({ ...o, email: o.email.trim().toLowerCase() }).select().single()); },
    async deleteCrew(email) { chk(await T('crew').delete().eq('email', email)); },
    async getHandoff(pid) { return chk(await T('handoffs').select('*').eq('project_id', pid).maybeSingle()); },
    async saveHandoff(o) { return chk(await T('handoffs').upsert(o, { onConflict: 'project_id' }).select().single()); },
    async crewJobs() { return chk(await T('handoffs').select('*').order('shoot_date', { ascending: true, nullsFirst: false }).limit(200)); },
    async crewJob(id) { return chk(await T('handoffs').select('*').eq('id', id).single()); },
    async crewSetStatus(id, status, note) { chk(await sb.rpc('crew_set_status', { p_handoff: id, p_status: status, p_note: note ?? null })); },
    async listResults(pid) { return chk(await T('results').select('*').eq('project_id', pid).order('label').order('sort').order('created_at')); },
    async addResults(arr) { return chk(await T('results').insert(arr).select()); },
    async updateResult(id, p) { return chk(await T('results').update(p).eq('id', id).select().single()); },
    async deleteResults(rows) {
      if (!rows.length) return;
      chk(await T('results').delete().in('id', rows.map(r => r.id)));
      const paths = rows.map(r => r.storage_path).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) { const { error } = await sb.storage.from('results').remove(paths.slice(i, i + 100)); if (error) console.warn('결과 사진 삭제 실패', error); }
    },
    async uploadResult(blob, pid) {
      const path = `${pid}/${rid()}.jpg`;
      chk(await sb.storage.from('results').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      return { path, url: sb.storage.from('results').getPublicUrl(path).data.publicUrl };
    },
    async confirmDelivery(token, note) { chk(await sb.rpc('confirm_delivery', { p_token: token, p_note: note || '' })); },
  };
}
