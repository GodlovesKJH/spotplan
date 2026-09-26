/* SPOTPLAN — 스튜디오 화면 · 요청 목록 · 프로젝트 상세 · 요청서 탭 */
/* =====================================================================
   3) 스튜디오 화면
   ===================================================================== */
async function renderStudio() {
  closeChannels();
  const sess = await DB.session().catch(() => null);
  if (!sess) return renderLogin();
  if (!S.me) {
    try { S.me = await DB.whoami(); } catch (e) { S.me = null; }
    if (!S.me) { app.innerHTML = topbar('studio') + `<main class="wrap narrow" style="max-width:520px;padding-top:40px"><div class="card"><h2>권한이 없는 계정입니다</h2>
      <p class="muted">${esc(sess.user && sess.user.email)} 계정은 권한이 없거나 사용 중지되었습니다. 실장에게 <b>계정 관리</b>에서 권한을 받으세요.</p><button class="btn" id="lo2">로그아웃</button></div></main>`;
      $('#lo2').onclick = async () => { await DB.signOut(); route(); }; return; }
    if (!['admin', 'staff', 'crew'].includes(S.me.role)) S.me.role = 'staff';
  }
  const h = location.hash;
  if (S.me.role === 'crew') { const j = h.match(/^#\/studio\/job\/([^/]+)/); return j ? renderCrewJob(j[1]) : renderCrewHome(); }
  if (h.startsWith('#/studio/accounts') || h.startsWith('#/studio/crew')) return renderAccounts();
  const m = h.match(/^#\/studio\/p\/([^/]+)(?:\/(\w+))?/);
  if (m) return renderDetail(m[1], m[2] || 'request');
  if (h.startsWith('#/studio/data')) return renderDataAdmin();
  return renderList();
}
function renderLogin() {
  document.title = '스튜디오·촬영팀 로그인 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap narrow" style="max-width:420px;padding-top:60px">
    <div class="card"><p class="sec-title">스 튜 디 오 · 촬 영 팀</p><h1 class="page-title" style="margin-bottom:16px">로그인</h1>
    <form id="lf" class="stack">
      <div><label class="f" for="l-email">이메일</label><input type="email" id="l-email" autocomplete="username" required></div>
      ${DEMO ? '<p class="small muted">시험 모드: 아무 이메일이나 입력하면 실장 화면, <b>crew@spotstudio.test</b>로 들어가면 촬영팀 화면입니다.</p>' : `<div><label class="f" for="l-pw">비밀번호</label><input type="password" id="l-pw" autocomplete="current-password" required></div>`}
      <div id="lerr" class="notice warn hidden"></div>
      <button class="btn primary big" type="submit">로그인</button>
    </form></div></main>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const err = $('#lerr'); err.classList.add('hidden');
    try { await DB.signIn($('#l-email').value.trim(), DEMO ? '' : $('#l-pw').value); S.me = null; route(); }
    catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  };
}
const whoName = () => (S.me && (S.me.name || S.me.email)) || '스튜디오';

/* ---------- 요청 목록 ---------- */
async function renderList() {
  document.title = '요청 목록 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap" style="padding-top:24px;padding-bottom:40px">
    <div class="row between" style="margin-bottom:14px"><div><p class="sec-title">요 청 목 록</p><h1 class="page-title">요청·상담·제안</h1></div>
      <div class="row"><button class="btn" id="copyform">요청서 링크 복사</button><button class="btn primary" id="newp">+ 직접 등록</button></div></div>
    <div class="filters" id="flt"></div>
    <div class="row" style="margin:12px 0"><input type="search" id="q" placeholder="업체명·이름·연락처 검색" style="max-width:320px"></div>
    <div class="plist" id="plist"><div class="empty"><span class="spin"></span></div></div></main>`;
  bindTop();
  $('#copyform').onclick = () => copyText(location.origin + location.pathname);
  $('#newp').onclick = newProjectModal;
  $('#q').oninput = drawList;
  await loadList();
  S.unwatch = DB.watchProjects(debounce(loadList, 500));
}
async function loadList() { try { S.list = await DB.listProjects(); drawList(); } catch (e) { fail(e); } }
function drawList() {
  const F = [['active', '진행 중'], ['requested', '신규 요청'], ['consulting', '상담 중'], ['proposing', '제안 중'], ['confirmed', '확정·촬영'], ['done', '완료'], ['all', '전체'], ['closed', '취소·테스트']];
  const counts = {};
  const match = (p, k) => k === 'all' ? true : k === 'closed' ? (p.status === 'cancelled' || p.is_test)
    : k === 'active' ? !['cancelled', 'done'].includes(p.status) : k === 'confirmed' ? ['confirmed', 'shooting'].includes(p.status) : p.status === k;
  F.forEach(([k]) => counts[k] = S.list.filter(p => match(p, k)).length);
  if (!$('#flt')) return; /* 다른 화면으로 이동한 뒤 늦게 도착한 목록은 무시 */
  $('#flt').innerHTML = F.map(([k, l]) => `<button data-k="${k}" class="${S.filter === k ? 'on' : ''}">${l} ${counts[k]}</button>`).join('');
  $$('#flt button').forEach(b => b.onclick = () => { S.filter = b.dataset.k; drawList(); });
  const q = ($('#q').value || '').trim().toLowerCase();
  const rows = S.list.filter(p => match(p, S.filter)).filter(p => !q || [p.company, p.contact_name, p.phone, p.email].join(' ').toLowerCase().includes(q));
  $('#plist').innerHTML = rows.length ? rows.map(p => {
    const intakeN = Object.keys(p.intake || {}).filter(k => k !== 'manual').length;
    return `<a class="pitem" href="#/studio/p/${p.id}">
      <div class="small muted">${fmt(p.created_at, false)}<br>${ago(p.updated_at)}</div>
      <div><div class="t">${esc(p.company || p.contact_name || '(이름 없음)')} <span class="muted" style="font-weight:400">${p.company ? esc(p.contact_name) : ''}</span></div>
        <div class="row small" style="margin-top:4px"><span class="chip line">${esc(purposeName(p.purpose))}</span>
        ${intakeN ? `<span class="chip ok" title="고객이 선택 항목을 작성함">상세 ${intakeN}개</span>` : ''}
        ${(p.attachments || []).length ? `<span class="chip ok">첨부 ${p.attachments.length}</span>` : ''}
        ${p.intake && p.intake.contact_pref ? `<span class="chip">${esc(p.intake.contact_pref)} 선호</span>` : ''}
        ${p.consult && p.consult.active ? '<span class="chip warn">상담 중</span>' : ''}
        ${p.is_test ? '<span class="chip warn">테스트</span>' : ''}</div></div>
      <div><span class="chip ${p.status === 'requested' ? 'dark' : ''}">${STATUS[p.status] || p.status}</span></div></a>`;
  }).join('') : `<div class="empty">해당하는 요청이 없습니다</div>`;
}
function newProjectModal() {
  const m = modal(`<h2>요청 직접 등록</h2><p class="small muted" style="margin:-6px 0 12px">전화·카톡·이메일로 받은 문의를 등록합니다.</p>
    <div class="stack"><div><label class="f req">촬영 목적</label><select id="n-p">${PURPOSES.map(p => `<option value="${p.k}">${p.t}</option>`).join('')}</select></div>
    <div class="grid2"><div><label class="f req">성함</label><input type="text" id="n-name"></div><div><label class="f">업체·브랜드명</label><input type="text" id="n-co"></div>
    <div><label class="f">연락처</label><input type="tel" id="n-ph"></div><div><label class="f">이메일</label><input type="email" id="n-em"></div></div>
    <div><label class="f">방문 경로</label><select id="n-src"><option value="">-</option>${SOURCES.map(s => `<option>${s}</option>`).join('')}</select></div>
    <p class="small muted">개인정보 수집·이용 동의는 통화 중 구두로 받거나, 고객 링크에서 확인받으세요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="n-c">취소</button><button class="btn primary" id="n-ok">등록</button></div></div>`);
  $('#n-c', m.el).onclick = m.close;
  $('#n-ok', m.el).onclick = async () => {
    const name = $('#n-name', m.el).value.trim(); if (!name) return toast('성함을 입력하세요');
    try {
      const p = await DB.createProject({ purpose: $('#n-p', m.el).value, contact_name: name, company: $('#n-co', m.el).value.trim(), phone: $('#n-ph', m.el).value.trim(),
        email: $('#n-em', m.el).value.trim(), source: $('#n-src', m.el).value, intake: { manual: true } });
      await DB.addLog(p.id, whoName(), '스튜디오에서 직접 등록'); m.close(); location.hash = `#/studio/p/${p.id}/request`;
    } catch (e) { fail(e); }
  };
}

/* ---------- 프로젝트 상세 ---------- */
async function loadDetail(pid) {
  const [p, rounds, samples, logs] = await Promise.all([DB.getProject(pid), DB.listRounds(pid), DB.listSamples(pid), DB.listLogs(pid)]);
  S.p = p; S.rounds = rounds; S.samples = samples; S.logs = logs;
  /* v1.1: 인계·결과·촬영팀 (update_v1.1.sql 실행 전이면 비워 둠) */
  const [h, res, crew] = await Promise.all([DB.getHandoff(pid).catch(() => null), DB.listResults(pid).catch(() => []), DB.listCrew().catch(() => [])]);
  S.handoff = h; S.results = res; S.crew = crew;
  if (!S.roundId || !rounds.some(r => r.id === S.roundId)) S.roundId = rounds.length ? rounds[rounds.length - 1].id : null;
}
async function renderDetail(pid, tab) {
  S.tab = tab;
  app.innerHTML = topbar('studio') + `<main class="wrap" id="dmain" style="padding-top:20px;padding-bottom:60px"><div class="empty"><span class="spin"></span></div></main>`;
  bindTop();
  if (!S.p || S.p.id !== pid) S.roundId = null;
  try { await loadDetail(pid); } catch (e) { $('#dmain').innerHTML = `<div class="empty">불러오지 못했습니다: ${esc(e.message)}</div>`; return; }
  openProjectChannel();
  drawDetail();
}
function openProjectChannel() {
  if (S.chan) S.chan.close();
  const token = S.p.token;
  S.chan = DB.channel(token, async msg => {
    if (msg.kind !== 'refresh' || !S.p) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && $('#dmain').contains(document.activeElement);
    await loadDetail(S.p.id).catch(() => {});
    if (typing || $('.modal-bg')) { drawHead(); toast('고객 화면에서 변경이 있었습니다'); } else drawDetail();
  });
}
function ping(kind = 'refresh', extra = {}) { S.chan && S.chan.send({ kind, ...extra }); }
const customerUrl = () => `${location.origin}${location.pathname}?p=${S.p.token}`;

function drawDetail() {
  const scrollY = window.scrollY;
  $('#dmain').innerHTML = `<div id="dhead"></div>
    <div class="tabs">${[['request', '요청서'], ['proposal', '제안서'], ['shoot', '촬영·납품·결제'], ['log', '진행 기록']].map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="dbody"></div>`;
  drawHead();
  $$('[data-tab]').forEach(b => b.onclick = () => { history.replaceState(null, '', `#/studio/p/${S.p.id}/${b.dataset.tab}`); S.tab = b.dataset.tab; drawDetail(); });
  if (S.tab === 'proposal') drawProposal(); else if (S.tab === 'shoot') drawShoot(); else if (S.tab === 'log') drawLog(); else drawRequest();
  window.scrollTo(0, scrollY);
}
function drawHead() {
  const p = S.p; const on = !!(p.consult && p.consult.active);
  document.title = `${p.company || p.contact_name} · SPOTPLAN`;
  $('#dhead').innerHTML = `
    <div class="row between" style="align-items:flex-start">
      <div><a href="#/studio" class="small muted" style="text-decoration:none">← 요청 목록</a>
        <h1 class="page-title" style="margin-top:4px">${esc(p.company || p.contact_name || '(이름 없음)')} <span class="muted" style="font-size:16px;font-weight:400">${p.company ? esc(p.contact_name) : ''}</span></h1>
        <div class="row small" style="margin-top:6px">
          ${p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''} ${p.email ? `<span class="muted">·</span> <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}
          <span class="chip line">${esc(purposeName(p.purpose))}</span>${p.is_test ? '<span class="chip warn">테스트</span>' : ''}
          ${p.consent_at ? '' : '<span class="chip warn" title="직접 등록 건: 개인정보 동의를 따로 받아야 합니다">동의 미확인</span>'}</div></div>
      <div class="row">
        <select id="st" style="width:auto;min-height:38px">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn ${on ? 'danger' : ''}" id="consult">${on ? '■ 상담 종료' : '● 상담 시작'}</button>
        <button class="btn" id="copylink">고객 링크 복사</button>
        <a class="btn" href="${esc(customerUrl())}" target="_blank" rel="noopener">고객 화면 열기</a>
        <button class="btn ghost" id="more">⋯</button></div></div>
    <div style="margin-top:14px">${dotsHtml(p.status)}</div>
    ${on ? `<div class="notice warn" style="margin-top:12px">상담 모드 · 입력하는 내용이 고객 화면에 바로 반영됩니다 (${esc(p.consult.by || '')}, ${fmt(p.consult.at)} 시작)</div>` : ''}`;
  $('#st').onchange = async e => { try { const v = e.target.value; S.p = await DB.updateProject(p.id, { status: v }); await DB.addLog(p.id, whoName(), `상태 변경: ${STATUS[v]}`); ping(); drawHead(); } catch (ex) { fail(ex); } };
  $('#copylink').onclick = () => copyText(customerUrl());
  $('#consult').onclick = toggleConsult;
  $('#more').onclick = moreMenu;
}
async function toggleConsult() {
  const p = S.p; const on = !!(p.consult && p.consult.active);
  try {
    const patch = { consult: on ? { active: false, ended_at: nowIso(), by: whoName() } : { active: true, by: whoName(), at: nowIso() } };
    if (!on && p.status === 'requested') patch.status = 'consulting';
    S.p = await DB.updateProject(p.id, patch);
    await DB.addLog(p.id, whoName(), on ? '상담 종료' : '상담 시작 (고객 화면 실시간 반영)');
    ping(); drawDetail();
    if (!on) toast('상담을 시작했습니다. 고객 링크를 열어 두도록 안내하세요.');
  } catch (e) { fail(e); }
}
function moreMenu() {
  const p = S.p;
  const m = modal(`<h2>프로젝트 관리</h2><div class="stack">
    <div class="row between"><span>테스트 프로젝트로 표시 <span class="small muted">(데이터 관리에서 한꺼번에 삭제)</span></span><button class="btn sm" id="m-test">${p.is_test ? '표시 해제' : '테스트로 표시'}</button></div>
    <div class="row between"><span>프로젝트 취소</span><button class="btn sm ${p.status === 'cancelled' ? '' : 'danger'}" id="m-cancel">${p.status === 'cancelled' ? '취소 해제' : '프로젝트 취소'}</button></div>
    <div class="row between"><span>고객 링크 재발급 <span class="small muted">(기존 링크는 열리지 않게 됨)</span></span><button class="btn sm danger" id="m-regen">재발급</button></div>
    ${!p.consent_at ? `<div class="row between"><span>개인정보 동의 받음 <span class="small muted">(구두·서면으로 받은 경우)</span></span><button class="btn sm" id="m-consent">동의 받음으로 기록</button></div>` : ''}
    <div><label class="f">방문 경로</label><select id="m-src"><option value="">-</option>${SOURCES.map(s => `<option ${p.source === s ? 'selected' : ''}>${s}</option>`).join('')}${p.source && !SOURCES.includes(p.source) ? `<option selected>${esc(p.source)}</option>` : ''}</select></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="m-close">닫기</button></div></div>`);
  const upd = async (patch, log) => { try { S.p = await DB.updateProject(p.id, patch); if (log) await DB.addLog(p.id, whoName(), log); ping(); m.close(); drawDetail(); } catch (e) { fail(e); } };
  $('#m-close', m.el).onclick = m.close;
  $('#m-test', m.el).onclick = () => upd({ is_test: !p.is_test }, p.is_test ? '테스트 표시 해제' : '테스트로 표시');
  $('#m-cancel', m.el).onclick = () => upd(p.status === 'cancelled' ? { status: 'requested' } : { status: 'cancelled', consult: {} }, p.status === 'cancelled' ? '프로젝트 취소 해제' : '프로젝트 취소');
  $('#m-regen', m.el).onclick = e => twoClick(e.target, async () => { S.p = await DB.regenToken(p.id); await DB.addLog(p.id, whoName(), '고객 링크 재발급'); m.close(); openProjectChannel(); drawDetail(); toast('새 링크를 발급했습니다'); }, '한 번 더 누르면 재발급');
  $('#m-consent', m.el) && ($('#m-consent', m.el).onclick = () => upd({ consent_at: nowIso() }, '개인정보 동의 받음으로 기록'));
  $('#m-src', m.el).onchange = e => upd({ source: e.target.value }, null);
}
/* ---------- 요청서 탭 ---------- */
const RQ = { saving: false, pendingFields: new Set(), lastTypingPing: 0 };
function reqItems() { S.p.request = S.p.request || {}; S.p.request.items = S.p.request.items || []; return S.p.request.items; }
function nextLetter(items) { const used = new Set(items.map(i => i.letter)); for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) return c; return 'Z' + items.length; }

function drawRequest() {
  const p = S.p; const req = p.request || {}; const intake = p.intake || {};
  const items = reqItems();
  $('#dbody').innerHTML = `<div class="two">
    <aside class="stack">
      <div class="card"><p class="sec-title">고 객 작 성</p>
        <dl class="kv"><dt>접수</dt><dd>${fmt(p.created_at)}</dd><dt>촬영 목적</dt><dd>${esc(purposeName(p.purpose))}</dd>
        ${Object.entries(intake).filter(([k]) => k !== 'manual').map(([k, v]) => `<dt>${esc(INTAKE_LABELS[k] || k)}</dt><dd>${esc(v)}</dd>`).join('')}
        <dt>방문 경로</dt><dd>${esc(p.source || '-')}</dd></dl>
        ${(p.attachments || []).length ? `<p class="small muted" style="margin:14px 0 0">첨부 파일 ${p.attachments.length}개</p>
          <ul class="flist" id="attlist">${p.attachments.map((a, i) => `<li>${isImageAtt(a) ? `<img data-att="${i}" alt="">` : `<span class="ficon">${esc(extOf(a.name).toUpperCase().slice(0, 4))}</span>`}
            <span class="fn" title="${esc(a.name)}">${esc(a.name)}</span><span class="small muted">${fmtSize(a.size || 0)}</span><button class="btn sm" data-attopen="${i}">받기</button></li>`).join('')}</ul>` : ''}
        ${p.purpose === 'direction' ? '<div class="notice" style="margin-top:10px">기획 포함 패키지(유료) 대상</div>' : ''}
        ${p.purpose === 'rental' ? '<div class="notice" style="margin-top:10px">렌탈 문의 · 아워플레이스 예약 안내</div>' : ''}
      </div>
      <div class="card"><p class="sec-title">통 화 내 용 정 리</p>
        <p class="small muted" style="margin:0 0 8px">통화 메모나 녹음 받아쓰기 텍스트를 붙여넣으면 Claude가 요청서 칸에 나눠 정리합니다. 원문은 저장하지 않습니다.</p>
        <textarea id="calltext" rows="8" placeholder="예) 상세페이지용. 앰플 2컷, 크림 1컷. 물방울 느낌 원함. 10월 둘째 주 촬영 희망…"></textarea>
        <button class="btn primary" id="extract" style="margin-top:8px;width:100%">Claude로 정리</button>
        <div id="exres"></div>
      </div>
      <div class="card"><p class="sec-title">스 튜 디 오 메 모</p>
        <textarea id="memo" rows="4" placeholder="고객에게 보이지 않습니다">${esc(p.studio_memo || '')}</textarea></div>
    </aside>
    <section class="card">
      <div class="row between"><p class="sec-title" style="margin:0">요 청 서</p>
        <span class="small muted" id="savestate"></span></div>
      <div class="row between panel" style="margin:10px 0 16px">
        <label class="row" style="cursor:pointer"><input type="checkbox" id="shared" ${p.request_shared ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--strong)"> <b style="color:var(--strong)">고객 화면에 요청서 공개</b></label>
        <span class="small">${p.request_confirmed_at ? `<span class="chip ok">고객 확인 완료 · ${fmt(p.request_confirmed_at)}</span>` : p.request_shared ? '<span class="chip warn">고객 확인 전</span>' : '<span class="muted">비공개</span>'}</span></div>
      <div class="grid2" id="reqfields">${REQ_FIELDS.map(([k, l]) => `<div ${['usage', 'notes', 'references', 'tone'].includes(k) ? 'style="grid-column:1/-1"' : ''}>
        <label class="f" for="rq-${k}">${l}</label>${['notes', 'references', 'usage'].includes(k) ? `<textarea id="rq-${k}" data-field="${k}" rows="2">${esc(req[k] || '')}</textarea>` : `<input type="text" id="rq-${k}" data-field="${k}" value="${esc(req[k] || '')}">`}</div>`).join('')}</div>
      <div class="divider"></div>
      <div class="row between"><h3 style="font-size:15px">촬영 아이템·컷수</h3><button class="btn sm" id="additem">+ 아이템 추가</button></div>
      <table class="items-table" style="margin-top:8px"><thead><tr><th></th><th>제품명</th><th>컷수</th><th>요청 사항</th><th></th></tr></thead>
        <tbody id="itemrows">${items.map((it, i) => `<tr data-i="${i}"><td class="letter">${esc(it.letter)}</td>
          <td><input type="text" data-ik="name" value="${esc(it.name || '')}"></td>
          <td class="cuts"><input type="number" min="0" data-ik="cuts" value="${it.cuts ?? ''}"></td>
          <td><input type="text" data-ik="desc" value="${esc(it.desc || '')}"></td>
          <td><button class="btn ghost sm" data-delitem="${i}" title="삭제">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted small" style="padding:10px 6px">아직 아이템이 없습니다. 통화 내용을 정리하거나 직접 추가하세요.</td></tr>'}</tbody></table>
      <div class="divider"></div>
      <div class="row between"><h3 style="font-size:15px" class="accent">고객 확인 필요</h3><button class="btn sm" id="addcheck">+ 추가</button></div>
      <div id="checklist" style="margin-top:8px">${(p.checks || []).map((c, i) => `<div class="row" style="margin-bottom:6px"><input type="text" data-check="${i}" value="${esc(c)}" class="grow" style="flex:1"><button class="btn ghost sm" data-delcheck="${i}">✕</button></div>`).join('') || '<p class="small muted">없음</p>'}</div>
    </section></div>`;
  bindRequest();
}
const saveReq = debounce(async () => {
  const p = S.p; const fields = [...RQ.pendingFields]; RQ.pendingFields.clear();
  const patch = { request: p.request, checks: p.checks || [], studio_memo: p.studio_memo || '' };
  const touchedCustomerVisible = fields.some(f => f !== 'memo');
  if (touchedCustomerVisible && p.request_shared && p.request_confirmed_at) patch.request_confirmed_at = null;
  const st = $('#savestate'); if (st) st.textContent = '저장 중…';
  try {
    const saved = await DB.updateProject(p.id, patch);
    S.p.updated_at = saved.updated_at; S.p.request_confirmed_at = saved.request_confirmed_at;
    if (st && st.isConnected) st.textContent = `저장됨 ${fmt(nowIso()).slice(11)}`;
    if (touchedCustomerVisible) {
      if (p.consult && p.consult.active) await DB.addLog(p.id, whoName(), `상담 중 실장 입력 · 요청서 (${fields.filter(f => f !== 'memo').map(f => (REQ_FIELDS.find(x => x[0] === f) || [0, f === 'items' ? '아이템' : f === 'checks' ? '확인 필요' : f])[1]).join(', ')})`);
      if ('request_confirmed_at' in patch) { await DB.addLog(p.id, whoName(), '요청서 수정으로 고객 재확인 필요'); toast('요청서가 바뀌어 고객 “이대로 확인”이 해제되었습니다. 다시 확인받으세요.', 4000); }
      ping();
    }
  } catch (e) { if (st) st.textContent = '저장 실패'; fail(e); }
}, 700);
function markReq(field) {
  RQ.pendingFields.add(field); saveReq();
  const t = Date.now(); if (S.p.consult && S.p.consult.active && t - RQ.lastTypingPing > 1200) { RQ.lastTypingPing = t; ping('typing'); }
}
function bindAttachments() {
  const atts = S.p.attachments || []; const urls = {};
  $$('#attlist [data-att]').forEach(img => { const a = atts[+img.dataset.att];
    DB.attachmentUrl(a, false).then(u => { urls[img.dataset.att] = u; img.src = u; }).catch(() => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'ficon', textContent: 'IMG' })); });
    img.onclick = () => { const imgs = atts.map((x, i) => ({ x, i })).filter(o => isImageAtt(o.x) && urls[o.i]);
      openLightbox(imgs.map(o => ({ url: urls[o.i], caption: esc(o.x.name) })), Math.max(0, imgs.findIndex(o => String(o.i) === img.dataset.att))); };
  });
  $$('#attlist [data-attopen]').forEach(b => b.onclick = () => { const a = atts[+b.dataset.attopen]; openFile(() => DB.attachmentUrl(a, true), a.name); });
}
function bindRequest() {
  const p = S.p;
  bindAttachments();
  $$('[data-field]').forEach(el => el.oninput = () => { p.request = p.request || {}; p.request[el.dataset.field] = el.value; markReq(el.dataset.field); });
  $('#memo').oninput = e => { p.studio_memo = e.target.value; markReq('memo'); };
  $$('#itemrows tr[data-i]').forEach(tr => $$('[data-ik]', tr).forEach(inp => inp.oninput = () => {
    const it = reqItems()[+tr.dataset.i]; const k = inp.dataset.ik; it[k] = k === 'cuts' ? (inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0)) : inp.value; markReq('items');
  }));
  $('#additem').onclick = () => { const items = reqItems(); items.push({ id: 'i' + rid().slice(0, 8), letter: nextLetter(items), name: '', cuts: 1, desc: '' }); markReq('items'); drawRequest(); const rows = $$('#itemrows tr[data-i]'); if (rows.length) $('[data-ik=name]', rows[rows.length - 1]).focus(); };
  $$('[data-delitem]').forEach(b => b.onclick = () => {
    const it = reqItems()[+b.dataset.delitem];
    if (S.samples.some(s => s.item_id === it.id)) return toast('이 아이템에 샘플이 있어 지울 수 없습니다. 제안서에서 샘플을 먼저 정리하세요.', 4000);
    twoClick(b, () => { reqItems().splice(+b.dataset.delitem, 1); markReq('items'); drawRequest(); }, '삭제?');
  });
  $('#addcheck').onclick = () => { p.checks = [...(p.checks || []), '']; markReq('checks'); drawRequest(); const c = $$('[data-check]'); c[c.length - 1].focus(); };
  $$('[data-check]').forEach(el => el.oninput = () => { p.checks[+el.dataset.check] = el.value; markReq('checks'); });
  $$('[data-delcheck]').forEach(b => b.onclick = () => { p.checks.splice(+b.dataset.delcheck, 1); markReq('checks'); drawRequest(); });
  $('#shared').onchange = async e => {
    try { await saveReq.flush(); S.p = await DB.updateProject(p.id, { request_shared: e.target.checked }); await DB.addLog(p.id, whoName(), e.target.checked ? '요청서 고객 공개' : '요청서 비공개로 전환'); ping(); drawRequest(); }
    catch (ex) { fail(ex); }
  };
  $('#extract').onclick = runExtract;
}
async function runExtract() {
  const text = $('#calltext').value.trim();
  if (text.length < 10) return toast('통화 내용을 붙여넣어 주세요');
  const btn = $('#extract'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 정리 중 (10~30초)';
  try {
    const cur = { ...(S.p.request || {}) };
    const { result } = await DB.fn('extract-call', { text, current: cur });
    showExtractReview(result);
  } catch (e) { fail(e); }
  finally { btn.disabled = false; btn.textContent = 'Claude로 정리'; }
}
function showExtractReview(r) {
  const req = S.p.request || {}; const items = reqItems();
  const rows = REQ_FIELDS.filter(([k]) => (r[k] || '').trim());
  const newItems = (r.items || []).filter(i => (i.name || '').trim());
  const m = modal(`<h2>통화 내용 정리 결과</h2>
    <p class="small muted" style="margin:-6px 0 12px">반영할 항목을 고르세요. 통화에 없던 내용은 비워 두었습니다. 반영 후에도 수정할 수 있습니다.</p>
    ${rows.length ? `<div class="diff"><span></span><span class="h">항목</span><span class="h o">지금 요청서</span><span class="h">통화 정리</span>
      ${rows.map(([k, l]) => { const same = (req[k] || '').trim() === r[k].trim(); return `<input type="checkbox" data-apply="${k}" ${same ? '' : 'checked'} ${same ? 'disabled' : ''}>
        <span class="lbl">${l}</span><span class="old">${esc(req[k] || '—')}</span><span class="new">${esc(r[k])}${same ? ' <span class="small muted">(같음)</span>' : ''}</span>`; }).join('')}</div>` : '<p class="muted">채울 수 있는 항목이 없었습니다.</p>'}
    ${newItems.length ? `<div class="divider"></div><h3 style="font-size:15px">아이템·컷수</h3>
      <table class="items-table"><tbody>${newItems.map(i => `<tr><td>${esc(i.name)}</td><td>${i.cuts == null ? '<span class="accent">컷수 불분명</span>' : i.cuts + '컷'}</td><td>${esc(i.desc || '')}</td></tr>`).join('')}</tbody></table>
      <div class="radios" style="margin-top:8px">${items.length ? `<label><input type="radio" name="imode" value="append" checked>기존 아이템에 추가 (이름이 같으면 갱신)</label><label><input type="radio" name="imode" value="replace">아이템 목록 교체</label>` : ''}<label><input type="radio" name="imode" value="skip" ${items.length ? '' : ''}>반영 안 함</label>${items.length ? '' : '<label><input type="radio" name="imode" value="append" checked>반영</label>'}</div>` : ''}
    ${(r.checks || []).length ? `<div class="divider"></div><h3 style="font-size:15px" class="accent">고객 확인 필요</h3>${r.checks.map((c, i) => `<label class="row small" style="margin:4px 0"><input type="checkbox" data-chk="${i}" checked> ${esc(c)}</label>`).join('')}` : ''}
    ${(r.next_questions || []).length ? `<div class="divider"></div><h3 style="font-size:15px">다음 통화 때 물어볼 것</h3><ul class="small">${r.next_questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    ${(r.search_keywords || []).length ? `<div class="divider"></div><h3 style="font-size:15px">사진 검색어 제안</h3><div class="row">${r.search_keywords.map(k => `<span class="chip line">${esc(k)}</span>`).join('')}</div>
      <p class="small muted">제안서 탭의 사진 검색에서 쓸 수 있도록 스튜디오 메모에 남깁니다.</p>` : ''}
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" id="x-c">닫기</button><button class="btn primary" id="x-ok">선택한 항목 반영</button></div>`, true);
  $('#x-c', m.el).onclick = m.close;
  $('#x-ok', m.el).onclick = async () => {
    const p = S.p; p.request = p.request || {}; const applied = [];
    $$('[data-apply]', m.el).forEach(cb => { if (cb.checked && !cb.disabled) { p.request[cb.dataset.apply] = r[cb.dataset.apply].trim(); applied.push(cb.dataset.apply); RQ.pendingFields.add(cb.dataset.apply); } });
    const mode = ($('input[name=imode]:checked', m.el) || {}).value;
    if (newItems.length && mode && mode !== 'skip') {
      let list = mode === 'replace' ? [] : reqItems().slice();
      if (mode === 'replace') { const locked = reqItems().filter(it => S.samples.some(s => s.item_id === it.id)); list = locked; if (locked.length) toast('샘플이 있는 아이템은 남겨 두었습니다', 3500); }
      for (const ni of newItems) {
        const ex = list.find(x => (x.name || '').trim() === ni.name.trim());
        if (ex) { if (ni.cuts != null) ex.cuts = ni.cuts; if (ni.desc) ex.desc = ni.desc; }
        else list.push({ id: 'i' + rid().slice(0, 8), letter: nextLetter(list), name: ni.name.trim(), cuts: ni.cuts, desc: ni.desc || '' });
      }
      p.request.items = list; RQ.pendingFields.add('items');
    }
    const chks = $$('[data-chk]', m.el).filter(c => c.checked).map(c => r.checks[+c.dataset.chk]);
    if (chks.length) { p.checks = [...new Set([...(p.checks || []).filter(Boolean), ...chks])]; RQ.pendingFields.add('checks'); }
    if ((r.search_keywords || []).length) { p.studio_memo = ((p.studio_memo || '').trim() + `\n[사진 검색어] ${r.search_keywords.join(', ')}`).trim(); RQ.pendingFields.add('memo'); }
    m.close();
    await saveReq.flush();
    await DB.addLog(p.id, whoName(), `통화 내용 정리 반영 (Claude): ${applied.length}개 항목${RQ.pendingFields.has('items') || newItems.length ? ', 아이템' : ''}`).catch(() => {});
    $('#calltext') && ($('#calltext').value = '');
    drawRequest(); toast('요청서에 반영했습니다. 확인 후 고객에게 공개하세요.', 3500);
  };
}
