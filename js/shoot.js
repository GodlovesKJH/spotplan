/* SPOTPLAN — v1.1 촬영팀 인계 · 촬영 결과 납품 · 결제 · 촬영팀 화면 */
/* =====================================================================
   v1.1 — 촬영팀 인계 · 촬영 결과 납품 · 결제 기록 · 촬영팀 화면
   ===================================================================== */
const SHOOT_LOCATION = CFG.SHOOT_LOCATION || `${CFG.STUDIO_NAME} 양재점`;
const payOf = (p, k) => ((p.payments || {})[k]) || {};
const paidAll = p => PAY_ROWS.filter(([k]) => Number(payOf(p, k).amount) > 0).every(([k]) => payOf(p, k).paid_at);
const finalRound = () => S.rounds.find(r => r.status === 'final');

/* 확정 촬영 목록 스냅샷 (촬영팀에게 넘어가는 내용) */
function buildShotlist(r) {
  const items = reqItems();
  const L = s => (items.find(i => i.id === s.item_id) || {}).letter || 'Z';
  return S.samples.filter(s => s.round_id === r.id && s.picked && !s.state)
    .sort((a, b) => L(a).localeCompare(L(b)) || a.sort - b.sort)
    .map(s => { const it = items.find(i => i.id === s.item_id) || {};
      return { label: s.label, item_letter: it.letter || '', item_name: it.name || '', cuts: it.cuts ?? null, title: s.title, note: s.note, pick_comment: s.pick_comment, image_url: s.image_url, kind: s.kind }; });
}
function buildInfo() {
  const p = S.p; const q = p.request || {};
  return { company: p.company, contact_name: p.contact_name, purpose: purposeName(p.purpose), brand: q.brand || '', usage: q.usage || '', tone: q.tone || '',
    schedule: q.schedule || '', notes: q.notes || '', items: reqItems().map(i => ({ letter: i.letter, name: i.name, cuts: i.cuts, desc: i.desc })) };
}

/* ---------- 스튜디오: 촬영·납품 탭 ---------- */
function drawShoot() {
  const p = S.p; const h = S.handoff; const fr = finalRound(); const res = S.results || [];
  const d = p.delivery || {};
  const pays = PAY_ROWS.map(([k, l]) => { const v = payOf(p, k); return `<div class="payrow" data-pay="${k}">
      <div class="row between"><b style="color:var(--strong)">${l}</b>${v.paid_at ? '<span class="chip ok">입금 확인</span>' : Number(v.amount) > 0 ? '<span class="chip warn">미입금</span>' : ''}</div>
      <div class="grid2 tight"><div><label class="f">금액(원)</label><input type="number" min="0" step="10000" data-pk="amount" value="${v.amount ?? ''}" placeholder="0"></div>
        <div><label class="f">입금일</label><input type="date" data-pk="paid_at" value="${esc(v.paid_at || '')}"></div></div>
      <input type="text" data-pk="memo" value="${esc(v.memo || '')}" placeholder="메모 (세금계산서·입금자명 등)" style="margin-top:6px"></div>`; }).join('');
  const total = PAY_ROWS.reduce((a, [k]) => a + (Number(payOf(p, k).amount) || 0), 0);
  const paid = PAY_ROWS.reduce((a, [k]) => a + (payOf(p, k).paid_at ? Number(payOf(p, k).amount) || 0 : 0), 0);
  const crewNames = h ? (h.crew_emails || []).map(e => (S.crew.find(c => c.email === e) || { name: e }).name || e).join(', ') : '';
  const byLabel = {}; res.forEach(x => (byLabel[x.label] = byLabel[x.label] || []).push(x));
  const labels = h ? [...(h.shotlist || []).map(s => s.label), ...Object.keys(byLabel).filter(l => !(h.shotlist || []).some(s => s.label === l))] : Object.keys(byLabel);

  $('#dbody').innerHTML = `<div class="two">
    <aside class="stack">
      <div class="card"><p class="sec-title">결 제</p>
        <div class="pays">${pays}</div>
        <p class="small" style="margin:8px 0 0">합계 <b>${won(total)}</b> · 입금 <b>${won(paid)}</b>${total > paid ? ` · <span class="accent">남은 금액 ${won(total - paid)}</span>` : ''}</p>
        <p class="small muted" style="margin:6px 0 0">고객에게 보이지 않습니다. 입금일을 넣으면 ‘입금 확인’으로 바뀝니다.</p></div>
      <div class="card"><p class="sec-title">고 객 납 품</p>
        <label class="f" for="dv-msg">고객에게 보이는 안내 문구</label>
        <textarea id="dv-msg" rows="3" placeholder="예: 촬영 결과를 올려 드립니다. 보정본은 ○일까지 같은 링크에 추가됩니다.">${esc(d.message || '')}</textarea>
        <label class="f" for="dv-link" style="margin-top:10px">원본 전체 받기 링크 (선택)</label>
        <input type="url" id="dv-link" value="${esc(d.original_link || '')}" placeholder="구글 드라이브·네이버 MYBOX 등 공유 링크">
        <div class="row between panel" style="margin-top:12px">
          <label class="row" style="cursor:pointer"><input type="checkbox" id="dv-shared" ${d.shared ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--strong)"> <b style="color:var(--strong)">고객 화면에 촬영 결과 공개</b></label>
          ${d.customer_ack_at ? `<span class="chip ok">수령 확인 · ${fmt(d.customer_ack_at)}</span>` : d.shared ? '<span class="chip warn">고객 확인 전</span>' : '<span class="small muted">비공개</span>'}</div>
        ${d.customer_note ? `<div class="notice" style="margin-top:10px"><b>고객 의견</b><div style="white-space:pre-wrap">${esc(d.customer_note)}</div></div>` : ''}
        <p class="small muted" style="margin:8px 0 0">숨김 표시한 사진은 공개해도 고객에게 보이지 않습니다.</p></div>
    </aside>
    <section class="stack">
      <div class="card"><div class="row between"><p class="sec-title" style="margin:0">촬 영 팀 인 계</p>
          ${h ? `<span class="chip ${h.status === 'handed' ? 'warn' : h.status === 'delivered' ? 'dark' : 'ok'}">${HANDOFF_STATUS[h.status] || h.status}</span>` : ''}</div>
        ${!fr ? `<div class="empty" style="padding:18px 0">제안서를 <b>최종 확정</b>한 뒤 촬영팀에 인계할 수 있습니다.</div>`
          : !h ? `<p style="margin:10px 0">확정 촬영 목록 <b>${buildShotlist(fr).length}컷</b>을 촬영팀에게 넘깁니다. 촬영팀은 자기 화면에서 참고 사진·설명·고객 의견을 보고, 촬영 후 결과 사진을 올립니다.</p>
              <button class="btn primary" id="handoff">촬영팀에 인계하기</button>`
          : `<dl class="kv" style="margin-top:12px"><dt>촬영팀</dt><dd>${esc(crewNames || '-')}</dd><dt>촬영 일정</dt><dd>${esc(h.shoot_date || '미정')} ${esc(h.shoot_time || '')}</dd>
              <dt>장소</dt><dd>${esc(h.location || '-')}</dd><dt>전달 사항</dt><dd>${esc(h.note || '-')}</dd>
              <dt>인계</dt><dd>${fmt(h.handed_at)} · ${esc(h.handed_by)}</dd>${h.received_at ? `<dt>촬영팀 확인</dt><dd>${fmt(h.received_at)}</dd>` : ''}
              ${h.uploaded_at ? `<dt>업로드 완료</dt><dd>${fmt(h.uploaded_at)}</dd>` : ''}${h.crew_note ? `<dt>촬영팀 메모</dt><dd>${esc(h.crew_note)}</dd>` : ''}</dl>
              <div class="row" style="margin-top:12px"><button class="btn" id="handoff">인계 내용 수정·다시 인계</button><span class="small muted">촬영 목록 ${(h.shotlist || []).length}컷</span></div>`}
      </div>
      <div class="card"><div class="row between"><p class="sec-title" style="margin:0">촬 영 결 과 <span class="muted" style="letter-spacing:0">${res.length}장</span></p>
          <div class="row"><button class="btn sm" id="res-up">+ 사진 올리기</button></div></div>
        ${res.length ? labels.map(l => { const list = byLabel[l] || []; const shot = h && (h.shotlist || []).find(s => s.label === l);
            return `<div class="res-row"><div class="res-h"><span class="chip dark">${esc(l)}</span> <b>${esc(shot ? `${shot.item_name} · ${shot.title || ''}` : l === '추가' ? '추가 컷' : '')}</b> <span class="small muted">${list.length}장</span></div>
              <div class="rgrid">${list.map(x => `<div class="rcard ${x.hidden ? 'dim' : ''}" data-rid="${x.id}"><div class="img" data-rzoom="${x.id}"><img loading="lazy" src="${esc(x.url)}" alt="">${x.hidden ? '<span class="pk chip warn">숨김</span>' : ''}</div>
                <div class="acts"><button class="btn sm ghost" data-rhide="${x.id}">${x.hidden ? '보이기' : '숨김'}</button><button class="btn sm ghost" data-rdel="${x.id}" style="color:var(--accent)">삭제</button></div></div>`).join('') || '<span class="small muted">아직 없음</span>'}</div></div>`; }).join('')
          : `<div class="empty" style="padding:18px 0">${h ? '촬영팀이 결과 사진을 올리면 여기에 표시됩니다.' : '인계 후 촬영팀이 올린 사진이 여기에 모입니다.'}</div>`}
      </div>
    </section></div>`;
  bindShoot();
}
function bindShoot() {
  const p = S.p;
  const savePay = debounce(async () => { try { const u = await DB.updateProject(p.id, { payments: p.payments }); S.p.updated_at = u.updated_at; } catch (e) { fail(e); } }, 700);
  $$('[data-pay]').forEach(tr => $$('[data-pk]', tr).forEach(inp => {
    inp.oninput = () => { p.payments = p.payments || {}; const k = tr.dataset.pay; p.payments[k] = { ...(p.payments[k] || {}), [inp.dataset.pk]: inp.dataset.pk === 'amount' ? (inp.value === '' ? null : Number(inp.value)) : inp.value }; savePay(); };
    inp.onchange = async () => { await savePay.flush(); if (inp.dataset.pk === 'paid_at') { const l = PAY_ROWS.find(x => x[0] === tr.dataset.pay)[1]; await DB.addLog(p.id, whoName(), inp.value ? `${l} 입금 확인 (${won(payOf(p, tr.dataset.pay).amount)})` : `${l} 입금 표시 해제`).catch(() => {}); drawShoot(); } };
  }));
  const saveDv = debounce(async () => { try { const u = await DB.updateProject(p.id, { delivery: p.delivery }); S.p.updated_at = u.updated_at; if (p.delivery.shared) ping(); } catch (e) { fail(e); } }, 700);
  $('#dv-msg').oninput = e => { p.delivery = { ...(p.delivery || {}), message: e.target.value }; saveDv(); };
  $('#dv-link').oninput = e => { p.delivery = { ...(p.delivery || {}), original_link: e.target.value.trim() }; saveDv(); };
  $('#dv-shared').onchange = async e => {
    const on = e.target.checked;
    if (on && !(S.results || []).some(x => !x.hidden) && !confirm('공개할 사진이 없습니다. 그래도 공개할까요?')) { e.target.checked = false; return; }
    if (on && !paidAll(p) && !confirm('아직 입금 확인되지 않은 금액이 있습니다(결제 칸). 그래도 촬영 결과를 공개할까요?')) { e.target.checked = false; return; }
    try {
      await saveDv.flush();
      p.delivery = { ...(p.delivery || {}), shared: on, shared_at: on ? nowIso() : (p.delivery || {}).shared_at };
      S.p = await DB.updateProject(p.id, { delivery: p.delivery });
      if (on && S.handoff) { S.handoff = await DB.saveHandoff({ project_id: p.id, status: 'delivered' }); }
      await DB.addLog(p.id, whoName(), on ? '촬영 결과 고객 공개' : '촬영 결과 비공개로 전환');
      ping(); drawDetail(); if (on) toast('공개했습니다. 고객 링크로 결과를 볼 수 있습니다.', 3500);
    } catch (ex) { fail(ex); }
  };
  $('#handoff') && ($('#handoff').onclick = handoffModal);
  $('#res-up').onclick = () => uploadResults(p.id, S.handoff ? S.handoff.shotlist : [], async () => { await loadDetail(p.id); drawDetail(); });
  const all = S.results || [];
  $$('[data-rzoom]').forEach(el => el.onclick = () => { const i = all.findIndex(x => x.id === el.dataset.rzoom); openLightbox(all.map(x => ({ url: x.url, caption: esc(x.label + (x.title ? ' · ' + x.title : '')) })), i); });
  $$('[data-rhide]').forEach(b => b.onclick = async () => { const x = all.find(r => r.id === b.dataset.rhide); try { await DB.updateResult(x.id, { hidden: !x.hidden }); await loadDetail(p.id); drawDetail(); ping(); } catch (e) { fail(e); } });
  $$('[data-rdel]').forEach(b => b.onclick = () => twoClick(b, async () => { const x = all.find(r => r.id === b.dataset.rdel); await DB.deleteResults([x]); await DB.addLog(p.id, whoName(), `촬영 결과 ${x.label} 사진 1장 삭제`); await loadDetail(p.id); drawDetail(); ping(); }, '삭제?'));
}
async function handoffModal() {
  const p = S.p; const h = S.handoff; const fr = finalRound(); if (!fr) return;
  let crew = []; try { crew = (await DB.listCrew()).filter(c => c.active); } catch (e) { fail(e); }
  const sel = new Set(h ? h.crew_emails : []);
  const shots = buildShotlist(fr);
  const m = modal(`<h2>촬영팀 인계</h2><p class="small muted" style="margin:-6px 0 12px">확정 촬영 목록 ${shots.length}컷과 아래 내용이 촬영팀 화면에 전달됩니다. 고객 연락처는 넘어가지 않습니다.</p>
    <div class="stack">
      <div><label class="f req">촬영팀</label>${crew.length ? `<div class="radios">${crew.map(c => `<label><input type="checkbox" data-crew="${esc(c.email)}" ${sel.has(c.email) ? 'checked' : ''}>${esc(c.name || c.email)} <span class="small muted">${esc(c.part || '')}</span></label>`).join('')}</div>`
        : `<p class="small accent">등록된 촬영팀이 없습니다. 관리자가 상단 <b>촬영팀</b> 메뉴에서 먼저 등록하세요.</p>`}</div>
      <div class="grid2"><div><label class="f">촬영일</label><input type="date" id="h-date" value="${esc(h ? h.shoot_date || '' : '')}"></div>
        <div><label class="f">시간</label><input type="text" id="h-time" value="${esc(h ? h.shoot_time : '')}" placeholder="예: 10:00~17:00"></div></div>
      <div><label class="f">장소</label><input type="text" id="h-loc" value="${esc(h ? h.location : SHOOT_LOCATION)}"></div>
      <div><label class="f">촬영팀 전달 사항</label><textarea id="h-note" rows="4" placeholder="제품 입고일, 소품·스타일링 준비, 조명 콘셉트, 납품 규격(사이즈·파일 형식)·마감일 등">${esc(h ? h.note : '')}</textarea></div>
      <table class="shotlist"><thead><tr><th></th><th>번호</th><th>제품</th><th>내용</th></tr></thead><tbody>
        ${shots.map(s => `<tr><td><img src="${esc(s.image_url)}" alt=""></td><td><b>${esc(s.label)}</b></td><td>${esc(s.item_name)}</td><td>${esc(s.title)}${s.pick_comment ? `<br><span class="small muted">고객 의견: ${esc(s.pick_comment)}</span>` : ''}</td></tr>`).join('')}</tbody></table>
      ${!payOf(p, 'deposit').paid_at ? '<div class="notice warn small">계약금 입금 확인 전입니다. 보통 계약금을 받은 뒤 촬영 일정을 확정합니다.</div>' : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" id="h-c">취소</button><button class="btn primary" id="h-ok">${h ? '다시 인계' : '인계하기'}</button></div></div>`, true);
  $('#h-c', m.el).onclick = m.close;
  $('#h-ok', m.el).onclick = async () => {
    const emails = $$('[data-crew]', m.el).filter(c => c.checked).map(c => c.dataset.crew);
    if (!emails.length) return toast('촬영팀을 한 명 이상 고르세요');
    try {
      S.handoff = await DB.saveHandoff({ project_id: p.id, round_id: fr.id, crew_emails: emails, shoot_date: $('#h-date', m.el).value || null, shoot_time: $('#h-time', m.el).value.trim(),
        location: $('#h-loc', m.el).value.trim(), note: $('#h-note', m.el).value.trim(), info: buildInfo(), shotlist: shots,
        status: h && h.status !== 'delivered' && h.status !== 'handed' ? h.status : 'handed', handed_at: nowIso(), handed_by: whoName() });
      if (['confirmed', 'proposing', 'consulting', 'requested'].includes(p.status)) S.p = await DB.updateProject(p.id, { status: 'shooting' });
      await DB.addLog(p.id, whoName(), `${h ? '촬영팀 인계 내용 수정' : '촬영팀 인계'} (${shots.length}컷, ${$('#h-date', m.el).value || '일정 미정'})`);
      m.close(); ping(); drawDetail(); toast('촬영팀에 인계했습니다. 촬영팀 화면에 바로 표시됩니다.', 3500);
    } catch (e) { fail(e); }
  };
}
/* 결과 사진 올리기 (스튜디오·촬영팀 공용): 긴 변 2560px로 줄여 저장 */
function uploadResults(pid, shotlist, after, fixedLabel) {
  const pickLabel = () => new Promise(res => {
    if (fixedLabel) return res(fixedLabel);
    const opts = [...(shotlist || []).map(s => s.label), '추가'];
    const m = modal(`<h2>어느 컷의 사진인가요?</h2><div class="radios" style="margin-top:8px">${opts.map((l, i) => `<label><input type="radio" name="rl" value="${esc(l)}" ${i === 0 ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="rl-c">취소</button><button class="btn primary" id="rl-ok">사진 고르기</button></div>`, false, () => res(null));
    $('#rl-c', m.el).onclick = () => m.close();
    $('#rl-ok', m.el).onclick = () => { const v = $('input[name=rl]:checked', m.el).value; res(v); m.close(); };
  });
  pickLabel().then(label => {
    if (!label) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => {
      const files = [...inp.files]; if (!files.length) return;
      try {
        const rows = [];
        for (let i = 0; i < files.length; i++) {
          toast(`${i + 1}/${files.length}장 올리는 중…`, 1500);
          const blob = await resizeImage(files[i], DEMO ? 900 : 2560, DEMO ? 0.8 : 0.9);
          const up = await DB.uploadResult(blob, pid);
          rows.push({ project_id: pid, label, storage_path: up.path, url: up.url, title: files[i].name.replace(/\.[^.]+$/, '').slice(0, 80), sort: Date.now() % 1e9 + i, uploaded_by: (S.me && S.me.email || '').toLowerCase() });
        }
        await DB.addResults(rows);
        toast(`${files.length}장 올렸습니다`); if (after) await after();
      } catch (e) { fail(e); }
    };
    inp.click();
  });
}

/* ---------- 관리자: 촬영팀 계정 ---------- */
async function renderCrewAdmin() {
  document.title = '촬영팀 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap" style="padding-top:24px;padding-bottom:40px">
    <p class="sec-title">촬 영 팀</p><h1 class="page-title">촬영팀 계정</h1>
    <p class="muted">여기에 등록된 이메일로 로그인하면 <b>촬영팀 화면</b>(인계받은 촬영 목록, 결과 사진 올리기)만 보입니다. 고객 연락처와 다른 프로젝트는 보이지 않습니다.</p>
    <div id="clist" style="margin-top:16px"><div class="empty"><span class="spin"></span></div></div></main>`;
  bindTop();
  if (!S.me || S.me.role !== 'admin') { $('#clist').innerHTML = '<div class="empty">관리자만 사용할 수 있습니다.</div>'; return; }
  let list = []; try { list = await DB.listCrew(); } catch (e) { $('#clist').innerHTML = `<div class="empty">불러오지 못했습니다: ${esc(e.message)}<br><span class="small">Supabase에 update_v1.1.sql을 실행했는지 확인하세요.</span></div>`; return; }
  $('#clist').innerHTML = `<div class="card"><table class="items-table crewt"><thead><tr><th>이름</th><th>이메일(로그인)</th><th>담당</th><th>연락처</th><th>사용</th><th></th></tr></thead><tbody>
    ${list.map(c => `<tr data-ce="${esc(c.email)}"><td><input type="text" data-ck="name" value="${esc(c.name)}"></td><td class="small">${esc(c.email)}</td>
      <td><input type="text" data-ck="part" value="${esc(c.part)}"></td><td><input type="text" data-ck="phone" value="${esc(c.phone)}"></td>
      <td><input type="checkbox" data-ck="active" ${c.active ? 'checked' : ''}></td><td><button class="btn sm ghost" data-cdel="${esc(c.email)}" style="color:var(--accent)">삭제</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted small">등록된 촬영팀이 없습니다</td></tr>'}
    <tr class="newrow"><td><input type="text" id="cn-name" placeholder="이름"></td><td><input type="email" id="cn-email" placeholder="login@example.com"></td>
      <td><input type="text" id="cn-part" value="사진"></td><td><input type="text" id="cn-phone" placeholder="010-"></td><td></td><td><button class="btn sm primary" id="cn-add">추가</button></td></tr></tbody></table>
    <div class="notice small" style="margin-top:14px"><b>로그인 계정 만들기</b> · 명단에 추가한 뒤, Supabase 대시보드 → <b>Authentication → Users → Add user</b>에서 같은 이메일과 비밀번호로 계정을 만들어 촬영팀에게 알려 주세요.
      촬영팀 주소는 실장 화면과 같습니다: <code>${esc(location.origin + location.pathname)}#/studio</code></div></div>`;
  const save = debounce(async (tr) => { const e = tr.dataset.ce; const o = { email: e }; $$('[data-ck]', tr).forEach(i => o[i.dataset.ck] = i.type === 'checkbox' ? i.checked : i.value.trim()); try { await DB.saveCrew(o); toast('저장했습니다', 1200); } catch (ex) { fail(ex); } }, 600);
  $$('[data-ce]').forEach(tr => $$('[data-ck]', tr).forEach(i => { i.oninput = () => save(tr); i.onchange = () => save.flush(tr); }));
  $$('[data-cdel]').forEach(b => b.onclick = () => twoClick(b, async () => { await DB.deleteCrew(b.dataset.cdel); renderCrewAdmin(); }, '삭제?'));
  $('#cn-add').onclick = async () => {
    const email = $('#cn-email').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) return toast('이메일을 확인하세요');
    try { await DB.saveCrew({ email, name: $('#cn-name').value.trim(), part: $('#cn-part').value.trim() || '사진', phone: $('#cn-phone').value.trim(), active: true }); renderCrewAdmin(); } catch (e) { fail(e); }
  };
}

/* ---------- 촬영팀 화면 ---------- */
async function renderCrewHome() {
  document.title = '촬영 일정 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap" style="padding-top:24px;padding-bottom:40px">
    <p class="sec-title">촬 영 팀</p><h1 class="page-title">인계받은 촬영</h1>
    <p class="muted">실장이 넘긴 확정 촬영 목록입니다. 촬영 후 컷별로 결과 사진을 올리고 <b>업로드 완료 알리기</b>를 누르세요.</p>
    <div class="plist" id="jlist" style="margin-top:16px"><div class="empty"><span class="spin"></span></div></div></main>`;
  bindTop();
  try {
    const jobs = await DB.crewJobs();
    $('#jlist').innerHTML = jobs.length ? jobs.map(j => `<a class="pitem" href="#/studio/job/${j.id}">
      <div class="small"><b style="color:var(--strong);font-size:15px">${esc(j.shoot_date || '일정 미정')}</b><br><span class="muted">${esc(j.shoot_time || '')}</span></div>
      <div><div class="t">${esc((j.info || {}).company || (j.info || {}).contact_name || '(업체명 없음)')}</div>
        <div class="small muted">${esc((j.info || {}).purpose || '')} · 촬영 ${(j.shotlist || []).length}컷 · ${esc(j.location || '')}</div></div>
      <div><span class="chip ${j.status === 'handed' ? 'dark' : j.status === 'delivered' ? '' : 'ok'}">${HANDOFF_STATUS[j.status] || j.status}</span></div></a>`).join('')
      : '<div class="empty">아직 인계받은 촬영이 없습니다.</div>';
  } catch (e) { $('#jlist').innerHTML = `<div class="empty">불러오지 못했습니다: ${esc(e.message)}</div>`; }
}
async function renderCrewJob(id) {
  app.innerHTML = topbar('studio') + `<main class="wrap" id="jmain" style="padding-top:20px;padding-bottom:60px"><div class="empty"><span class="spin"></span></div></main>`;
  bindTop();
  let j, res;
  try { j = await DB.crewJob(id); res = await DB.listResults(j.project_id); } catch (e) { $('#jmain').innerHTML = `<div class="empty">불러오지 못했습니다: ${esc(e.message)}</div>`; return; }
  const info = j.info || {}; document.title = `${info.company || '촬영'} · 촬영팀`;
  const byLabel = {}; res.forEach(x => (byLabel[x.label] = byLabel[x.label] || []).push(x));
  const me = (S.me && S.me.email || '').toLowerCase();
  const next = { handed: ['received', '인계 내용 확인했습니다'], received: ['shooting', '촬영 시작'], shooting: ['uploaded', '업로드 완료 알리기'], uploaded: ['uploaded', '업로드 완료 다시 알리기'] }[j.status];
  const thumbs = l => (byLabel[l] || []).map(x => `<div class="rcard"><div class="img" data-jz="${x.id}"><img loading="lazy" src="${esc(x.url)}" alt=""></div>
      ${x.uploaded_by === me ? `<div class="acts"><button class="btn sm ghost" data-jdel="${x.id}" style="color:var(--accent)">삭제</button></div>` : ''}</div>`).join('');
  $('#jmain').innerHTML = `<a href="#/studio" class="small muted" style="text-decoration:none">← 인계받은 촬영</a>
    <div class="row between" style="align-items:flex-start;margin-top:4px">
      <div><h1 class="page-title">${esc(info.company || info.contact_name || '')}</h1>
        <div class="row small" style="margin-top:6px"><span class="chip dark">${esc(j.shoot_date || '일정 미정')} ${esc(j.shoot_time || '')}</span><span class="chip line">${esc(j.location || '')}</span><span class="chip ${j.status === 'handed' ? 'warn' : 'ok'}">${HANDOFF_STATUS[j.status] || j.status}</span></div></div>
      <div class="row">${next && j.status !== 'delivered' ? `<button class="btn primary" id="jnext" data-s="${next[0]}">${next[1]}</button>` : ''}</div></div>
    <div class="two" style="margin-top:18px">
      <aside class="stack">
        <div class="card"><p class="sec-title">촬 영 개 요</p><dl class="kv"><dt>목적</dt><dd>${esc(info.purpose || '')}${info.usage ? ` · ${esc(info.usage)}` : ''}</dd>
          <dt>브랜드</dt><dd>${esc(info.brand || '-')}</dd><dt>톤·무드</dt><dd>${esc(info.tone || '-')}</dd><dt>일정</dt><dd>${esc(info.schedule || '-')}</dd>
          ${info.notes ? `<dt>기타</dt><dd>${esc(info.notes)}</dd>` : ''}</dl>
          ${(info.items || []).length ? `<table class="shotlist" style="margin-top:10px"><tbody>${info.items.map(i => `<tr><td><b>${esc(i.letter)}</b></td><td>${esc(i.name)}</td><td>${i.cuts ?? '-'}컷</td></tr>`).join('')}</tbody></table>` : ''}</div>
        <div class="card"><p class="sec-title">실 장 전 달 사 항</p><div style="white-space:pre-wrap">${esc(j.note || '없음')}</div>
          <p class="small muted" style="margin:10px 0 0">인계 ${fmt(j.handed_at)} · ${esc(j.handed_by || '')}</p></div>
        <div class="card"><p class="sec-title">실 장 에 게 메 모</p><textarea id="jnote" rows="3" placeholder="촬영 특이 사항, 추가 컷 설명 등">${esc(j.crew_note || '')}</textarea>
          <button class="btn sm" id="jnote-save" style="margin-top:8px">메모 저장</button></div>
      </aside>
      <section class="stack">
        <div class="row between"><h2 style="font-size:18px">확정 촬영 목록 <span class="muted" style="font-weight:400">${(j.shotlist || []).length}컷 · 올린 사진 ${res.length}장</span></h2>
          <button class="btn sm" data-jup="추가">+ 추가 컷 올리기</button></div>
        ${(j.shotlist || []).map(s => `<div class="card jshot"><div class="jref" data-jref="${esc(s.label)}"><img src="${esc(s.image_url)}" alt=""><span class="lbl">${esc(s.label)}</span></div>
          <div class="jbody"><div class="small muted">${esc(s.item_letter)}. ${esc(s.item_name)}</div><h3 style="font-size:16px;margin:2px 0 4px">${esc(s.title || '(제목 없음)')}</h3>
            ${s.note ? `<div class="small" style="white-space:pre-wrap">${esc(s.note)}</div>` : ''}${s.pick_comment ? `<div class="notice small" style="margin-top:6px"><b>고객 의견</b> ${esc(s.pick_comment)}</div>` : ''}
            <div class="row" style="margin-top:10px"><button class="btn sm primary" data-jup="${esc(s.label)}">+ ${esc(s.label)} 결과 올리기</button><span class="small muted">${(byLabel[s.label] || []).length}장</span></div>
            <div class="rgrid" style="margin-top:8px">${thumbs(s.label)}</div></div></div>`).join('')}
        ${(byLabel['추가'] || []).length ? `<div class="card"><h3 style="font-size:15px">추가 컷</h3><div class="rgrid" style="margin-top:8px">${thumbs('추가')}</div></div>` : ''}
        <p class="small muted">사진은 긴 변 2560px JPG로 줄여 저장됩니다(고객 확인용). 원본·RAW는 실장이 정한 방식(드라이브 등)으로 따로 전달하세요.</p>
      </section></div>`;
  const reload = () => renderCrewJob(id);
  $('#jnext') && ($('#jnext').onclick = async e => {
    const st = e.target.dataset.s;
    if (st === 'uploaded' && !res.length) return toast('먼저 결과 사진을 올려 주세요');
    try { await DB.crewSetStatus(j.id, st); toast(st === 'uploaded' ? '실장에게 업로드 완료를 알렸습니다' : '반영했습니다', 3000); reload(); } catch (ex) { fail(ex); }
  });
  $('#jnote-save').onclick = async () => { try { await DB.crewSetStatus(j.id, null, $('#jnote').value); toast('메모를 저장했습니다'); reload(); } catch (e) { fail(e); } };
  $$('[data-jup]').forEach(b => b.onclick = () => uploadResults(j.project_id, j.shotlist, reload, b.dataset.jup));
  $$('[data-jz]').forEach(el => el.onclick = () => { const i = res.findIndex(x => x.id === el.dataset.jz); openLightbox(res.map(x => ({ url: x.url, caption: esc(x.label) })), i); });
  $$('[data-jref]').forEach(el => el.onclick = () => { const i = j.shotlist.findIndex(s => s.label === el.dataset.jref); openLightbox(j.shotlist.map(s => ({ url: s.image_url, caption: esc(`${s.label} 참고 · ${s.title || ''}`) })), i); });
  $$('[data-jdel]').forEach(b => b.onclick = () => twoClick(b, async () => { await DB.deleteResults([res.find(x => x.id === b.dataset.jdel)]); reload(); }, '삭제?'));
}

/* ---------- 고객 화면: 촬영 일정 · 촬영 결과 ---------- */
function customerShootHtml(d) {
  let h = '';
  const dv = d.delivery;
  if (dv) {
    h += `<section style="margin-top:26px" id="cdelivery"><p class="sec-title">촬 영 결 과</p>
      <div class="card">${dv.message ? `<div style="white-space:pre-wrap;margin-bottom:12px">${esc(dv.message)}</div>` : ''}
        <div class="row between"><span class="small muted">사진 ${dv.results.length}장 · ${fmt(dv.shared_at)} 공개</span>
          ${dv.original_link ? `<a class="btn primary sm" href="${esc(dv.original_link)}" target="_blank" rel="noopener">원본 전체 받기</a>` : ''}</div>
        <div class="rgrid big" style="margin-top:12px">${dv.results.map(x => `<div class="rcard"><div class="img" data-dz="${x.id}"><img loading="lazy" src="${esc(x.url)}" alt=""><span class="lbl">${esc(x.label)}</span></div>
          <div class="acts"><a class="btn sm ghost" href="${esc(dlUrl(x.url, `${(d.company || 'photo').replace(/[\\/:*?"<>|]/g, '')}_${x.label}_${x.id.slice(0, 4)}.jpg`))}" download>받기</a></div></div>`).join('')}</div>
        <div class="divider"></div>
        ${dv.customer_ack_at ? `<span class="chip ok">수령 확인 · ${fmt(dv.customer_ack_at)}</span>${dv.customer_note ? `<p class="small" style="white-space:pre-wrap;margin:8px 0 0">${esc(dv.customer_note)}</p>` : ''}`
          : `<label class="f" for="dv-note">의견 (선택)</label><textarea id="dv-note" rows="2" placeholder="수정·보정 요청이 있으면 적어 주세요"></textarea>
             <div class="row" style="margin-top:10px"><button class="btn primary" id="dv-ok">잘 받았습니다</button><span class="small muted">받으신 뒤 눌러 주세요.</span></div>`}
      </div></section>`;
  } else if (d.handoff) {
    const st = { handed: '촬영 준비 중', received: '촬영 준비 중', shooting: '촬영 중', uploaded: '결과 정리 중', delivered: '결과 정리 중' }[d.handoff.status] || '촬영 준비 중';
    h += `<section class="card" style="margin-top:14px"><div class="row between"><h2 style="font-size:17px">촬영 일정</h2><span class="chip dark">${st}</span></div>
      <p style="margin:8px 0 0">${d.handoff.shoot_date ? `<b>${esc(d.handoff.shoot_date)}</b> ${esc(d.handoff.shoot_time || '')} 촬영 예정입니다.` : '촬영 일정을 조율하고 있습니다.'} 촬영이 끝나면 이 페이지에서 결과 사진을 보실 수 있습니다.</p></section>`;
  }
  return h;
}
function bindCustomerShoot() {
  const dv = C.data && C.data.delivery; if (!dv) return;
  $$('[data-dz]').forEach(el => el.onclick = () => { const i = dv.results.findIndex(x => x.id === el.dataset.dz); openLightbox(dv.results.map(x => ({ url: x.url, caption: esc(x.label + (x.title ? ' · ' + x.title : '')) })), i); });
  $('#dv-ok') && ($('#dv-ok').onclick = async e => {
    e.target.disabled = true;
    try { await DB.confirmDelivery(C.token, ($('#dv-note') || {}).value || ''); S.chan && S.chan.send({ kind: 'refresh' }); toast('확인해 주셔서 감사합니다.'); await loadCustomer(); }
    catch (ex) { fail(ex); e.target.disabled = false; }
  });
}
