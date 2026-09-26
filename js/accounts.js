/* SPOTPLAN — v1.2 계정 관리 (관리자: 실무팀·촬영팀 로그인 계정 만들기·권한·중지) · 내 비밀번호 변경 */
const KIND_LABEL = { admin: '관리자(실장)', staff: '실무팀', crew: '촬영팀' };
const KIND_DESC = {
  admin: '모든 화면 + 계정 관리 · 데이터 관리',
  staff: '요청 목록 · 요청서 · 제안서 · 촬영팀 인계 · 납품 · 결제 (계정 관리는 못 함)',
  crew: '자기에게 인계된 촬영만 보고, 결과 사진을 올림',
};
const studioUrl = () => `${location.origin}${location.pathname}#/studio`;
/* 읽기 쉬운 임시 비밀번호: 헷갈리는 글자(0 O 1 l I) 뺌 */
function makePassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz', n = '23456789';
  const r = s => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return 'spot-' + Array.from({ length: 4 }, () => r(a)).join('') + Array.from({ length: 4 }, () => r(n)).join('');
}
function loginNotice(name, email, pw) {
  return `[${BRAND}] ${name ? name + '님, ' : ''}SPOTPLAN 계정 안내입니다.\n주소: ${studioUrl()}\n아이디: ${email}\n임시 비밀번호: ${pw}\n처음 로그인하신 뒤 오른쪽 위 [비밀번호]에서 본인 비밀번호로 바꿔 주세요.`;
}
function showNotice(title, text) {
  const m = modal(`<h2>${esc(title)}</h2><p class="small muted" style="margin:-6px 0 10px">아래 안내 문구를 복사해 카톡·문자로 보내 주세요. 이 창을 닫으면 비밀번호는 다시 볼 수 없습니다.</p>
    <textarea id="nt" rows="6" readonly>${esc(text)}</textarea>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="nt-c">닫기</button><button class="btn primary" id="nt-copy">안내 문구 복사</button></div>`);
  $('#nt-c', m.el).onclick = m.close;
  $('#nt-copy', m.el).onclick = () => copyText(text);
}
function accountsErr(e) {
  const msg = e && e.message || String(e);
  return /Failed to send|fetch|not found|404|FunctionsFetchError|FunctionsRelayError/i.test(msg)
    ? `${msg}<br><span class="small">Supabase에 Edge Function <b>admin-users</b>를 배포했는지 확인하세요 (레포의 SETUP_V1.2.md).</span>` : esc(msg);
}

async function renderAccounts() {
  document.title = '계정 관리 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap" style="padding-top:24px;padding-bottom:40px">
    <p class="sec-title">계 정 관 리</p><h1 class="page-title">계정 관리</h1>
    <p class="muted" style="margin-top:4px">여기서 만든 계정은 모두 같은 주소(<code>${esc(studioUrl())}</code>)로 로그인하며, 권한에 따라 보이는 화면이 다릅니다.</p>
    <div class="kinds">${Object.keys(KIND_LABEL).map(k => `<div><span class="chip ${k === 'admin' ? 'dark' : k === 'crew' ? 'line' : ''}">${KIND_LABEL[k]}</span> <span class="small muted">${KIND_DESC[k]}</span></div>`).join('')}</div>
    <div id="acc" style="margin-top:18px"><div class="empty"><span class="spin"></span></div></div></main>`;
  bindTop();
  if (!S.me || S.me.role !== 'admin') { $('#acc').innerHTML = '<div class="empty">관리자(실장)만 사용할 수 있습니다.</div>'; return; }
  let data;
  try { data = await DB.adminUsers('list'); } catch (e) { $('#acc').innerHTML = `<div class="empty">계정 목록을 불러오지 못했습니다: ${accountsErr(e)}</div>`; return; }
  const me = (data.me || '').toLowerCase();
  const list = data.list || [];
  const kindSel = (v, dis) => `<select data-ak="kind" ${dis ? 'disabled' : ''}>${Object.keys(KIND_LABEL).map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}${v ? '' : '<option value="" selected>(권한 없음)</option>'}</select>`;
  const state = a => !a.kind ? '<span class="chip warn">권한 없음</span>' : !a.has_login ? '<span class="chip warn">로그인 계정 없음</span>' : a.active ? '<span class="chip ok">사용 중</span>' : '<span class="chip warn">사용 중지</span>';

  $('#acc').innerHTML = `
    <div class="card"><p class="sec-title">새 계 정 만 들 기</p>
      <div class="acc-new">
        <div><label class="f req" for="an-name">이름</label><input type="text" id="an-name" placeholder="예: 박촬영"></div>
        <div><label class="f req" for="an-email">이메일 (로그인 아이디)</label><input type="email" id="an-email" placeholder="name@example.com" autocomplete="off"></div>
        <div><label class="f req">권한</label><div class="radios" id="an-kind">${['staff', 'crew', 'admin'].map((k, i) => `<label><input type="radio" name="an-kind" value="${k}" ${i === 1 ? 'checked' : ''}>${KIND_LABEL[k]}</label>`).join('')}</div></div>
        <div class="an-crew"><label class="f" for="an-part">담당</label><input type="text" id="an-part" value="사진" placeholder="사진 · 영상 · 스타일리스트 · 보조"></div>
        <div class="an-crew"><label class="f" for="an-phone">연락처</label><input type="text" id="an-phone" placeholder="010-"></div>
        <div><label class="f req" for="an-pw">임시 비밀번호 (8자 이상)</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="an-pw" autocomplete="off" value="${makePassword()}"><button class="btn sm" id="an-gen" type="button" title="새로 만들기">↻</button></div></div>
      </div>
      <div class="row between" style="margin-top:12px"><span class="small muted">만들면 바로 로그인할 수 있습니다. Supabase에 따로 들어갈 필요가 없습니다.</span><button class="btn primary" id="an-add">계정 만들기</button></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="row between"><p class="sec-title" style="margin:0">계 정 목 록 <span class="muted" style="letter-spacing:0">${list.length}명</span></p></div>
      <div class="acc-list">${list.map(a => { const self = a.email === me;
        return `<div class="acc-row ${a.active ? '' : 'off'}" data-ae="${esc(a.email)}">
          <div class="acc-who"><input type="text" data-ak="name" value="${esc(a.name || '')}" placeholder="이름">
            <div class="small muted acc-mail">${esc(a.email)}${self ? ' <span class="chip dark">나</span>' : ''}</div></div>
          <div>${kindSel(a.kind, self)}</div>
          <div class="acc-crew ${a.kind === 'crew' ? '' : 'na'}"><input type="text" data-ak="part" value="${esc(a.part || '')}" placeholder="담당"><input type="text" data-ak="phone" value="${esc(a.phone || '')}" placeholder="연락처"></div>
          <div class="acc-st">${state(a)}<div class="small muted">${a.last_sign_in_at ? '최근 로그인 ' + fmt(a.last_sign_in_at) : a.has_login ? '아직 로그인 안 함' : ''}</div></div>
          <div class="acc-acts">
            ${a.kind && !a.has_login ? `<button class="btn sm primary" data-aa="login">로그인 계정 만들기</button>` : ''}
            ${a.has_login ? `<button class="btn sm" data-aa="pw">비밀번호 재설정</button>` : ''}
            ${self ? '' : `<button class="btn sm ghost" data-aa="${a.active ? 'off' : 'on'}">${a.active ? '사용 중지' : '다시 사용'}</button><button class="btn sm ghost" data-aa="del" style="color:var(--accent)">삭제</button>`}
          </div></div>`; }).join('') || '<div class="empty">계정이 없습니다</div>'}</div>
      <p class="small muted" style="margin:12px 0 0">사용 중지하면 그 계정은 로그인할 수 없고 일감도 보이지 않습니다(기록은 남음). 삭제하면 로그인 계정과 명단에서 모두 지워집니다. 이미 인계한 기록·올린 사진은 남습니다.</p>
    </div>`;

  /* 새 계정 */
  const syncKind = () => { const k = $('input[name=an-kind]:checked').value; $$('.an-crew').forEach(el => el.classList.toggle('hidden', k !== 'crew')); };
  $$('input[name=an-kind]').forEach(r => r.onchange = syncKind); syncKind();
  $('#an-gen').onclick = () => { $('#an-pw').value = makePassword(); };
  $('#an-add').onclick = async e => {
    const name = $('#an-name').value.trim(), email = $('#an-email').value.trim().toLowerCase(), pw = $('#an-pw').value.trim(), kind = $('input[name=an-kind]:checked').value;
    if (!name) return toast('이름을 넣어 주세요');
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('이메일을 확인하세요');
    if (pw.length < 8) return toast('비밀번호는 8자 이상으로 정해 주세요');
    if (list.some(a => a.email === email && a.has_login) && !confirm(`${email}은 이미 로그인 계정이 있습니다. 권한을 ${KIND_LABEL[kind]}(으)로 바꾸고 비밀번호를 새로 정할까요?`)) return;
    e.target.disabled = true;
    try {
      await DB.adminUsers('create', { email, name, kind, password: pw, part: kind === 'crew' ? $('#an-part').value.trim() : '', phone: kind === 'crew' ? $('#an-phone').value.trim() : '' });
      await renderAccounts();
      showNotice(`${name} 계정을 만들었습니다 (${KIND_LABEL[kind]})`, loginNotice(name, email, pw));
    } catch (ex) { fail(ex); e.target.disabled = false; }
  };

  /* 목록 */
  const find = el => list.find(a => a.email === el.closest('[data-ae]').dataset.ae);
  const upd = async (a, patch, msg) => { try { await DB.adminUsers('update', { email: a.email, ...patch }); if (msg) toast(msg, 1600); return true; } catch (ex) { fail(ex); return false; } };
  $$('.acc-row').forEach(row => {
    const a = find(row);
    const save = debounce(async () => { const f = {}; $$('input[data-ak]', row).forEach(i => f[i.dataset.ak] = i.value.trim()); await upd(a, f, '저장했습니다'); }, 700);
    $$('input[data-ak]', row).forEach(i => { i.oninput = save; i.onchange = () => save.flush(); });
    const sel = $('select[data-ak=kind]', row);
    if (sel) sel.onchange = async () => {
      const k = sel.value; if (!k) return;
      if (!confirm(`${a.name || a.email}의 권한을 ${KIND_LABEL[k]}(으)로 바꿀까요?\n${KIND_DESC[k]}`)) { sel.value = a.kind || ''; return; }
      if (await upd(a, { kind: k }, '권한을 바꿨습니다')) renderAccounts(); else sel.value = a.kind || '';
    };
    $$('[data-aa]', row).forEach(b => b.onclick = async () => {
      const act = b.dataset.aa;
      if (act === 'off' || act === 'on') { if (await upd(a, { active: act === 'on' }, act === 'on' ? '다시 사용할 수 있게 했습니다' : '사용 중지했습니다')) renderAccounts(); }
      if (act === 'del') twoClick(b, async () => { await DB.adminUsers('delete', { email: a.email }); toast('삭제했습니다'); renderAccounts(); });
      if (act === 'pw' || act === 'login') passwordModal(a, act === 'login');
    });
  });
}
function passwordModal(a, create) {
  const m = modal(`<h2>${create ? '로그인 계정 만들기' : '비밀번호 재설정'}</h2>
    <p class="small muted" style="margin:-6px 0 12px">${esc(a.name || '')} · ${esc(a.email)}</p>
    <label class="f" for="pw-new">새 임시 비밀번호 (8자 이상)</label>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="pw-new" value="${makePassword()}" autocomplete="off"><button class="btn sm" id="pw-gen" type="button">↻</button></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="pw-c">취소</button><button class="btn primary" id="pw-ok">저장</button></div>`);
  $('#pw-gen', m.el).onclick = () => { $('#pw-new', m.el).value = makePassword(); };
  $('#pw-c', m.el).onclick = m.close;
  $('#pw-ok', m.el).onclick = async e => {
    const pw = $('#pw-new', m.el).value.trim(); if (pw.length < 8) return toast('8자 이상으로 정해 주세요');
    e.target.disabled = true;
    try {
      if (create) await DB.adminUsers('create', { email: a.email, name: a.name, kind: a.kind, password: pw, part: a.part, phone: a.phone });
      else await DB.adminUsers('password', { email: a.email, password: pw });
      m.close(); if (create) await renderAccounts();
      showNotice(create ? '로그인 계정을 만들었습니다' : '비밀번호를 바꿨습니다', loginNotice(a.name, a.email, pw));
    } catch (ex) { fail(ex); e.target.disabled = false; }
  };
}

/* 누구나: 내 비밀번호 바꾸기 */
function myPasswordModal() {
  const m = modal(`<h2>내 비밀번호 바꾸기</h2><p class="small muted" style="margin:-6px 0 12px">${esc(S.me && S.me.email || '')}</p>
    <div class="stack"><div><label class="f" for="mp-1">새 비밀번호 (8자 이상)</label><input type="password" id="mp-1" autocomplete="new-password"></div>
    <div><label class="f" for="mp-2">새 비밀번호 한 번 더</label><input type="password" id="mp-2" autocomplete="new-password"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="mp-c">취소</button><button class="btn primary" id="mp-ok">바꾸기</button></div>`);
  $('#mp-c', m.el).onclick = m.close;
  $('#mp-ok', m.el).onclick = async e => {
    const p1 = $('#mp-1', m.el).value, p2 = $('#mp-2', m.el).value;
    if (p1.length < 8) return toast('8자 이상으로 정해 주세요');
    if (p1 !== p2) return toast('두 칸의 비밀번호가 다릅니다');
    e.target.disabled = true;
    try { await DB.changePassword(p1); m.close(); toast('비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.', 3500); }
    catch (ex) { fail(ex); e.target.disabled = false; }
  };
}
