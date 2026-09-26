/* SPOTPLAN — 데이터 계층 2 (시험 모드) · DB 선택 */
/* =====================================================================
   데이터 계층 2: 시험 모드 (이 브라우저 안에만 저장, 탭끼리 실시간 반영)
   ===================================================================== */
function placeholder(text, hue = 30, sub = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},28%,86%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},22%,62%)"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<rect x="300" y="360" width="200" height="380" rx="36" fill="hsl(${hue},18%,96%)" opacity=".92"/>
<rect x="340" y="300" width="120" height="80" rx="14" fill="hsl(${hue},14%,30%)" opacity=".85"/>
<ellipse cx="400" cy="770" rx="170" ry="26" fill="#000" opacity=".12"/>
<text x="400" y="880" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#222" opacity=".7">${text}</text>
<text x="400" y="930" font-family="sans-serif" font-size="26" text-anchor="middle" fill="#222" opacity=".5">${sub}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function makeDemoDB() {
  const KEY = 'spotplan-demo-v1', UKEY = 'spotplan-demo-user';
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('spotplan-demo') : null;
  const subs = new Set();
  if (bc) bc.onmessage = e => { for (const s of subs) if (s.name === e.data.name) s.fn(e.data.payload || {}); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  let mem = null;
  function seed() {
    const pid = rid(), rid1 = rid(), t = nowIso();
    const items = [
      { id: 'i1', letter: 'A', name: '비타C 앰플 30ml', cuts: 2, desc: '물방울·청량감, 흰 배경 연출' },
      { id: 'i2', letter: 'B', name: '수분 크림 50g', cuts: 1, desc: '텍스처 강조 클로즈업' },
    ];
    const s = (item, n, hue, title) => ({ id: rid(), round_id: rid1, project_id: pid, item_id: item.id, label: `${item.letter}-${n}`, sort: n, kind: 'photo',
      image_url: placeholder(`${item.letter}-${n}`, hue, '시험용 이미지'), storage_path: null, title, note: '', source: '시험 모드', source_url: '', credit: '예시',
      from_label: '', state: null, picked: false, pick_comment: '', picked_by: '', picked_at: null, created_at: t });
    return {
      projects: [{
        id: pid, token: 'demo' + rid().replace(/-/g, ''), created_at: t, updated_at: t, status: 'proposing', is_test: true,
        purpose: 'detail', company: '(예시) 루미에르 코스메틱', contact_name: '김담당', phone: '010-0000-0000', email: 'demo@example.com',
        consent_at: t, intake: { product: '앰플 1종, 크림 1종', schedule: '10월 둘째 주' }, source: '네이버 검색',
        request: { usage: '스마트스토어 상세페이지 메인 컷', brand: '루미에르', industry: '코스메틱(스킨케어)', schedule: '10월 둘째 주 촬영, 3주 안 납품',
          budget: '', tone: '밝고 청량한 톤, 화이트·블루', references: '', notes: '', items },
        checks: ['예산 범위 언급 없음'], request_shared: true, request_confirmed_at: null, consult: {}, studio_memo: '시험용 예시 프로젝트입니다.',
      }],
      rounds: [{ id: rid1, project_id: pid, n: 1, status: 'sent', rev: 1, studio_note: '요청하신 컷수의 2~3배수로 준비했습니다. 마음에 드는 안을 골라 주세요.',
        customer_note: '', intent: '', counters: { i1: 5, i2: 3 }, edits: [], created_at: t, sent_at: t, picked_at: null }],
      samples: [
        s(items[0], 1, 200, '물방울 튀는 정면 컷'), s(items[0], 2, 190, '유리판 위 반사 컷'), s(items[0], 3, 210, '흰 큐브 위 45도'),
        s(items[0], 4, 180, '햇살 그림자 연출'), s(items[0], 5, 220, '손 모델 드롭 컷'),
        s(items[1], 1, 30, '텍스처 스와치'), s(items[1], 2, 20, '뚜껑 열린 탑뷰'), s(items[1], 3, 40, '스패출러 클로즈업'),
      ],
      logs: [{ id: 1, project_id: pid, at: t, who: '시스템', text: '시험용 예시 프로젝트 생성' }],
      crew: [{ email: 'crew@spotstudio.test', name: '박촬영', phone: '', part: '사진', active: true, memo: '시험용 촬영팀 계정', created_at: t }],
      handoffs: [], results: [], staff: [],
      accounts: [{ email: 'crew@spotstudio.test', active: true, last: null }],
    };
  }
  function load() { if (mem) return mem; try { mem = JSON.parse(store.get(KEY)); } catch { mem = null; } if (!mem || !mem.projects) { mem = seed(); save(false); }
    if (!mem.crew) mem.crew = seed().crew; if (!mem.handoffs) mem.handoffs = []; if (!mem.results) mem.results = [];
    if (!mem.staff) mem.staff = []; if (!mem.accounts) mem.accounts = seed().accounts; return mem; }
  function save(ping = true) { store.set(KEY, JSON.stringify(mem)); if (ping && bc) bc.postMessage({ name: '__projects' }); }
  window.addEventListener('storage', e => { if (e.key === KEY) mem = null; });
  const db = () => { mem = null; return load(); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const touch = (d, pid) => { const p = d.projects.find(x => x.id === pid); if (p) p.updated_at = nowIso(); };
  const wait = (ms = 60) => new Promise(r => setTimeout(r, ms));
  const pub = p => {
    const d = db(); const pr = d.projects.find(x => x.token === p); if (!pr) return null;
    return clone({
      id: pr.id, company: pr.company, contact_name: pr.contact_name, purpose: pr.purpose, status: pr.status, created_at: pr.created_at, updated_at: pr.updated_at,
      consult: pr.consult, request_shared: pr.request_shared, request_confirmed_at: pr.request_confirmed_at,
      request: pr.request_shared ? pr.request : { items: (pr.request && pr.request.items) || [] }, checks: pr.request_shared ? pr.checks : [],
      handoff: (h => h ? { shoot_date: h.shoot_date, shoot_time: h.shoot_time, status: h.status } : null)(d.handoffs.find(h => h.project_id === pr.id)),
      delivery: pr.delivery && pr.delivery.shared ? { shared_at: pr.delivery.shared_at, message: pr.delivery.message || '', original_link: pr.delivery.original_link || '',
        customer_ack_at: pr.delivery.customer_ack_at || null, customer_note: pr.delivery.customer_note || '',
        results: d.results.filter(x => x.project_id === pr.id && !x.hidden).sort((a, b) => a.label.localeCompare(b.label) || a.sort - b.sort).map(x => ({ id: x.id, label: x.label, url: x.url, title: x.title, note: x.note })) } : null,
      rounds: d.rounds.filter(r => r.project_id === pr.id && r.status !== 'draft').sort((a, b) => a.n - b.n).map(r => ({
        ...r, samples: d.samples.filter(s => s.round_id === r.id && !s.state).sort((a, b) => a.item_id.localeCompare(b.item_id) || a.sort - b.sort),
      })),
    });
  };
  const addLog = (d, pid, who, text) => d.logs.push({ id: Date.now() + Math.random(), project_id: pid, at: nowIso(), who, text });
  return {
    mode: 'demo',
    async submitRequest(p) {
      await wait(300); const d = db(); const id = rid();
      if (!PURPOSES.some(x => x.k === p.purpose)) throw new Error('invalid purpose');
      d.projects.push({ id, token: 'demo' + rid().replace(/-/g, ''), created_at: nowIso(), updated_at: nowIso(), status: 'requested', is_test: false,
        purpose: p.purpose, company: p.company || '', contact_name: p.contact_name, phone: p.phone, email: p.email, consent_at: nowIso(),
        intake: p.intake || {}, source: p.source || '', attachments: p.attachments || [], request: {}, checks: [], request_shared: false, request_confirmed_at: null, consult: {}, studio_memo: '' });
      addLog(d, id, '고객', '온라인 요청서 접수'); save();
    },
    async getProposal(token) { await wait(); return pub(token); },
    async submitPicks(token, roundId, picks, note, intent) {
      await wait(200); const d = db(); const pr = d.projects.find(x => x.token === token); if (!pr) throw new Error('not found');
      const r = d.rounds.find(x => x.id === roundId && x.project_id === pr.id); if (!r || !['sent', 'picked'].includes(r.status)) throw new Error('round closed');
      let cnt = 0;
      for (const pk of picks) { const s = d.samples.find(x => x.id === pk.id && x.round_id === r.id && !x.state); if (!s) continue;
        s.picked = !!pk.picked; s.pick_comment = pk.comment || ''; s.picked_by = pk.picked ? 'customer' : ''; s.picked_at = pk.picked ? nowIso() : null; if (pk.picked) cnt++; }
      Object.assign(r, { status: 'picked', picked_at: nowIso(), customer_note: note || '', intent: ['next', 'confirm'].includes(intent) ? intent : '' });
      addLog(d, pr.id, '고객', `${r.n}차 선택 제출 (${cnt}안 선택${intent === 'confirm' ? ', 확정 희망' : intent === 'next' ? ', 다음 제안 희망' : ''})`);
      touch(d, pr.id); save();
    },
    async confirmRequest(token) { const d = db(); const pr = d.projects.find(x => x.token === token); if (!pr) throw new Error('not found');
      pr.request_confirmed_at = nowIso(); addLog(d, pr.id, '고객', '요청서 내용 "이대로 확인"'); touch(d, pr.id); save(); },

    async session() { return store.get(UKEY) ? { user: { email: store.get(UKEY) } } : null; },
    async signIn(email) { if (!email) throw new Error('이메일을 입력하세요'); const a = db().accounts.find(x => x.email === email.trim().toLowerCase());
      if (a && !a.active) throw new Error('사용 중지된 계정입니다. 실장에게 문의하세요.'); if (a) { a.last = nowIso(); save(false); } store.set(UKEY, email); },
    async signOut() { store.del(UKEY); },
    async whoami() { const e = store.get(UKEY); if (!e) return null; const d = db();
      const st = d.staff.find(x => x.email === e.toLowerCase()); if (st) return { email: st.email, name: st.name, role: st.role };
      const c = d.crew.find(x => x.email === e.toLowerCase() && x.active); if (c) return { email: c.email, name: c.name, role: 'crew', part: c.part };
      return { email: e, name: '실장(시험)', role: 'admin' }; },
    async changePassword(pw) { if (String(pw).length < 8) throw new Error('비밀번호는 8자 이상으로 정해 주세요.'); },
    /* 시험 모드용 계정 관리 (실제 운영은 Edge Function admin-users) */
    async adminUsers(action, b = {}) {
      await wait(); const d = db(); const me = (store.get(UKEY) || '').toLowerCase(); const e = String(b.email || '').trim().toLowerCase();
      const kindOf = x => { const st = d.staff.find(r => r.email === x); return st ? st.role : d.crew.some(r => r.email === x) ? 'crew' : null; };
      const admins = () => d.staff.filter(r => r.role === 'admin').length + 1; /* 시험 모드: 로그인한 사람도 관리자로 셈 */
      const setKind = (kind, f) => { const oc = d.crew.find(r => r.email === e), os = d.staff.find(r => r.email === e); const name = f.name ?? os?.name ?? oc?.name ?? '';
        if (kind === 'crew') { const row = { email: e, name, part: f.part ?? oc?.part ?? '사진', phone: f.phone ?? oc?.phone ?? '', active: f.active ?? oc?.active ?? true, memo: oc?.memo || '', created_at: oc?.created_at || os?.created_at || nowIso() };
          d.crew = d.crew.filter(r => r.email !== e).concat(row); d.staff = d.staff.filter(r => r.email !== e); }
        else { const row = { email: e, name, role: kind, created_at: os?.created_at || oc?.created_at || nowIso() }; d.staff = d.staff.filter(r => r.email !== e).concat(row); d.crew = d.crew.filter(r => r.email !== e); } };
      const pw = x => { if (String(x || '').length < 8) throw new Error('비밀번호는 8자 이상으로 정해 주세요.'); };
      if (action === 'list') {
        const list = [...d.staff.map(r => ({ ...r, kind: r.role, part: '', phone: '' })), ...d.crew.map(r => ({ ...r, kind: 'crew' }))].map(r => { const a = d.accounts.find(x => x.email === r.email);
          return { email: r.email, name: r.name, kind: r.kind, part: r.part, phone: r.phone, has_login: !!a, active: (r.kind !== 'crew' || r.active) && (!a || a.active), last_sign_in_at: a ? a.last : null, created_at: r.created_at }; });
        if (me && !list.some(r => r.email === me)) list.unshift({ email: me, name: '실장(시험)', kind: 'admin', part: '', phone: '', has_login: true, active: true, last_sign_in_at: nowIso(), created_at: nowIso() });
        const o = { admin: 0, staff: 1, crew: 2 }; list.sort((a, b) => o[a.kind] - o[b.kind]); return { me, list: clone(list) };
      }
      if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('이메일 형식을 확인하세요.');
      if (action === 'create') { if (!['admin', 'staff', 'crew'].includes(b.kind)) throw new Error('권한을 골라 주세요.'); pw(b.password);
        if (e === me && b.kind !== 'admin') throw new Error('자기 자신의 관리자 권한은 뺄 수 없습니다.');
        const ex = d.accounts.find(x => x.email === e); if (ex) ex.active = true; else d.accounts.push({ email: e, active: true, last: null });
        setKind(b.kind, { name: b.name || '', part: b.part || undefined, phone: b.phone || '', active: true }); save(); return { ok: true, existed: !!ex }; }
      if (action === 'update') { const cur = kindOf(e); const kind = b.kind || cur || 'staff';
        if (e === me && kind !== 'admin') throw new Error('자기 자신의 관리자 권한은 뺄 수 없습니다.');
        if (e === me && b.active === false) throw new Error('자기 자신은 사용 중지할 수 없습니다.');
        if (cur === 'admin' && kind !== 'admin' && admins() <= 1) throw new Error('관리자가 최소 1명은 있어야 합니다.');
        const f = {}; ['name', 'part', 'phone'].forEach(k => { if (b[k] != null) f[k] = String(b[k]).trim(); }); setKind(kind, f);
        if (typeof b.active === 'boolean') { const a = d.accounts.find(x => x.email === e); if (a) a.active = b.active; const c = d.crew.find(r => r.email === e); if (c) c.active = b.active; }
        save(); return { ok: true }; }
      if (action === 'password') { pw(b.password); if (!d.accounts.some(x => x.email === e)) throw new Error('로그인 계정이 없습니다. 먼저 계정을 만드세요.'); return { ok: true }; }
      if (action === 'delete') { if (e === me) throw new Error('자기 자신은 삭제할 수 없습니다.');
        d.staff = d.staff.filter(r => r.email !== e); d.crew = d.crew.filter(r => r.email !== e); d.accounts = d.accounts.filter(x => x.email !== e); save(); return { ok: true }; }
      throw new Error('알 수 없는 요청입니다.');
    },

    async listProjects() { await wait(); return clone(db().projects).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
    async getProject(id) { const p = db().projects.find(x => x.id === id); if (!p) throw new Error('프로젝트를 찾을 수 없습니다'); return clone(p); },
    async createProject(o) { const d = db(); const p = { id: rid(), token: 'demo' + rid().replace(/-/g, ''), created_at: nowIso(), updated_at: nowIso(), status: 'requested', is_test: false,
      purpose: '', company: '', contact_name: '', phone: '', email: '', consent_at: null, intake: {}, source: '', request: {}, checks: [], request_shared: false,
      request_confirmed_at: null, consult: {}, studio_memo: '', ...o }; d.projects.push(p); save(); return clone(p); },
    async updateProject(id, patch) { const d = db(); const p = d.projects.find(x => x.id === id); Object.assign(p, clone(patch)); p.updated_at = nowIso(); save(); return clone(p); },
    async regenToken(id) { return this.updateProject(id, { token: 'demo' + rid().replace(/-/g, '') }); },
    async deleteProjects(ids) { const d = db(); d.projects = d.projects.filter(p => !ids.includes(p.id)); d.rounds = d.rounds.filter(r => !ids.includes(r.project_id));
      d.samples = d.samples.filter(s => !ids.includes(s.project_id)); d.logs = d.logs.filter(l => !ids.includes(l.project_id));
      d.handoffs = d.handoffs.filter(h => !ids.includes(h.project_id)); d.results = d.results.filter(x => !ids.includes(x.project_id)); save(); },

    async listRounds(pid) { return clone(db().rounds.filter(r => r.project_id === pid).sort((a, b) => a.n - b.n)); },
    async createRound(o) { const d = db(); if (d.rounds.some(r => r.project_id === o.project_id && r.n === o.n)) throw new Error('같은 차수가 이미 있습니다');
      const r = { id: rid(), status: 'draft', rev: 1, studio_note: '', customer_note: '', intent: '', counters: {}, edits: [], created_at: nowIso(), sent_at: null, picked_at: null, ...clone(o) };
      d.rounds.push(r); touch(d, o.project_id); save(); return clone(r); },
    async updateRound(id, p) { const d = db(); const r = d.rounds.find(x => x.id === id); Object.assign(r, clone(p)); touch(d, r.project_id); save(); return clone(r); },
    async deleteRound(id) { const d = db(); const r = d.rounds.find(x => x.id === id); d.rounds = d.rounds.filter(x => x.id !== id); d.samples = d.samples.filter(s => s.round_id !== id); if (r) touch(d, r.project_id); save(); },

    async listSamples(pid) { return clone(db().samples.filter(s => s.project_id === pid).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))); },
    async addSamples(arr) { const d = db(); const out = arr.map(o => ({ id: rid(), sort: 0, kind: 'photo', image_url: '', storage_path: null, title: '', note: '', source: '', source_url: '', credit: '', from_label: '',
      state: null, picked: false, pick_comment: '', picked_by: '', picked_at: null, created_at: nowIso(), ...clone(o) })); d.samples.push(...out); if (out[0]) touch(d, out[0].project_id); save(); return clone(out); },
    async updateSample(id, p) { const d = db(); const s = d.samples.find(x => x.id === id); Object.assign(s, clone(p)); touch(d, s.project_id); save(); return clone(s); },
    async deleteSamples(rows) { const d = db(); const ids = rows.map(r => r.id); const s0 = d.samples.find(s => ids.includes(s.id)); d.samples = d.samples.filter(s => !ids.includes(s.id)); if (s0) touch(d, s0.project_id); save(); },

    async listLogs(pid) { return clone(db().logs.filter(l => l.project_id === pid).sort((a, b) => b.at.localeCompare(a.at))); },
    async addLog(pid, who, text) { const d = db(); addLog(d, pid, who, text); save(false); },

    async uploadAttachment(file, folder, i) {
      if (file.size > 1.5 * 1048576) throw new Error(`시험 모드에서는 1.5MB 이하 파일만 첨부할 수 있습니다: ${file.name} (실제 모드는 파일당 20MB)`);
      await wait(200);
      return { path: `req/${folder}/${i}.${extOf(file.name)}`, name: file.name, size: file.size, type: file.type || '', data: await blobToDataUrl(file) };
    },
    async attachmentUrl(a) { return a.data || ''; },
    async upload(blob) { const url = await blobToDataUrl(blob); if (url.length > 900000) throw new Error('시험 모드에서는 큰 사진을 저장할 수 없습니다(브라우저 저장 한도). 실제 모드에서는 문제없습니다.'); return { path: null, url }; },
    async fn(name, body) {
      await wait(700);
      if (name === 'photo-search') {
        if (body.action === 'track') return { ok: true };
        const q = body.q || '';
        return { photos: Array.from({ length: 12 }, (_, i) => { const h = (q.length * 37 + i * 29) % 360; const url = placeholder(q.slice(0, 18) || '사진', h, `시험 결과 ${i + 1}`);
          return { id: 'demo' + i + Date.now(), source: i % 2 ? 'Pexels' : 'Unsplash', thumb: url, full: url, credit: '시험용', source_url: '' }; }), notes: ['시험 모드: 실제 검색은 Supabase 연결 후 동작합니다'] };
      }
      if (name === 'extract-call') return { result: demoExtract(body.text || '') };
      throw new Error('unknown function');
    },
    channel(name, onMsg) { const s = { name, fn: onMsg }; subs.add(s); return { send: p => bc && bc.postMessage({ name, payload: p }), close: () => subs.delete(s) }; },
    watchProjects(cb) { const s = { name: '__projects', fn: cb }; subs.add(s); return () => subs.delete(s); },

    /* v1.1 촬영팀 · 인계 · 납품 */
    async listCrew() { return clone(db().crew); },
    async saveCrew(o) { const d = db(); const e = o.email.trim().toLowerCase(); let c = d.crew.find(x => x.email === e);
      if (c) Object.assign(c, clone(o), { email: e }); else { c = { name: '', phone: '', part: '사진', active: true, memo: '', created_at: nowIso(), ...clone(o), email: e }; d.crew.push(c); } save(); return clone(c); },
    async deleteCrew(email) { const d = db(); d.crew = d.crew.filter(x => x.email !== email); save(); },
    async getHandoff(pid) { return clone(db().handoffs.find(h => h.project_id === pid) || null); },
    async saveHandoff(o) { const d = db(); let h = d.handoffs.find(x => x.project_id === o.project_id);
      if (h) Object.assign(h, clone(o)); else { h = { id: rid(), status: 'handed', crew_note: '', received_at: null, uploaded_at: null, created_at: nowIso(), ...clone(o) }; d.handoffs.push(h); }
      touch(d, o.project_id); save(); return clone(h); },
    async crewJobs() { await wait(); const e = (store.get(UKEY) || '').toLowerCase(); const d = db(); const me = d.crew.find(x => x.email === e);
      return clone(d.handoffs.filter(h => !me || (h.crew_emails || []).includes(e)).sort((a, b) => String(a.shoot_date || '9').localeCompare(String(b.shoot_date || '9')))); },
    async crewJob(id) { const h = db().handoffs.find(x => x.id === id); if (!h) throw new Error('인계 내용을 찾을 수 없습니다'); return clone(h); },
    async crewSetStatus(id, status, note) { const d = db(); const h = d.handoffs.find(x => x.id === id); if (!h) throw new Error('not found');
      const e = (store.get(UKEY) || '').toLowerCase(); const c = d.crew.find(x => x.email === e); const cnt = d.results.filter(x => x.project_id === h.project_id).length;
      if (status) h.status = status; if (status === 'received') h.received_at = nowIso(); if (status === 'uploaded') h.uploaded_at = nowIso(); if (note != null) h.crew_note = note;
      addLog(d, h.project_id, c ? c.name : '촬영팀', !status ? `촬영팀 메모: ${(note || '').slice(0, 200)}` : status === 'received' ? '촬영팀 인계 내용 확인' : status === 'shooting' ? '촬영 시작' : `촬영 결과 업로드 완료 (${cnt}장)`); touch(d, h.project_id); save(); },
    async listResults(pid) { return clone(db().results.filter(x => x.project_id === pid).sort((a, b) => a.label.localeCompare(b.label) || a.sort - b.sort || a.created_at.localeCompare(b.created_at))); },
    async addResults(arr) { const d = db(); const out = arr.map(o => ({ id: rid(), label: '', storage_path: null, url: '', title: '', note: '', hidden: false, sort: 0, uploaded_by: '', created_at: nowIso(), ...clone(o) }));
      d.results.push(...out); if (out[0]) touch(d, out[0].project_id); save(); return clone(out); },
    async updateResult(id, p) { const d = db(); const x = d.results.find(r => r.id === id); Object.assign(x, clone(p)); touch(d, x.project_id); save(); return clone(x); },
    async deleteResults(rows) { const d = db(); const ids = rows.map(r => r.id); d.results = d.results.filter(x => !ids.includes(x.id)); save(); },
    async uploadResult(blob) { return this.upload(blob); },
    async confirmDelivery(token, note) { const d = db(); const pr = d.projects.find(x => x.token === token); if (!pr || !(pr.delivery && pr.delivery.shared)) throw new Error('not shared');
      pr.delivery = { ...pr.delivery, customer_ack_at: nowIso(), customer_note: note || '' }; if (['confirmed', 'shooting'].includes(pr.status)) pr.status = 'done';
      addLog(d, pr.id, '고객', '촬영 결과 수령 확인'); touch(d, pr.id); save(); },
  };
}
/* 시험 모드용 간단 정리기 (실제 모드에서는 Claude가 정리) */
function demoExtract(text) {
  const items = []; const re = /([가-힣A-Za-z0-9\s]{2,20}?)\s*(\d+)\s*컷/g; let m;
  while ((m = re.exec(text))) items.push({ name: m[1].trim(), cuts: Number(m[2]), desc: '' });
  const pick = (words) => { const line = text.split(/\n|\.\s/).find(l => words.some(w => l.includes(w))); return line ? line.trim() : ''; };
  const r = { usage: pick(['상세', '광고', 'SNS', '인스타', '용도']), brand: '', industry: '', items, schedule: pick(['월', '주', '일정', '날짜']),
    budget: pick(['예산', '만원', '만 원']), tone: pick(['톤', '느낌', '무드', '색']), references: pick(['http', '레퍼런스', '참고']), notes: '',
    checks: ['(시험 모드) 실제 운영에서는 Claude가 통화 내용을 읽고 정리합니다'], next_questions: ['촬영물을 본 고객이 무엇을 하길 원하시나요?'], search_keywords: ['cosmetic product photography'] };
  if (!r.budget) r.checks.push('예산 범위 언급 없음');
  if (!items.length) r.checks.push('아이템별 컷수 확인 필요');
  return r;
}
const DB = DEMO ? makeDemoDB() : makeSupabaseDB();
