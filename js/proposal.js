/* SPOTPLAN — 제안서 탭 · 사진 검색 · 진행 기록 · 데이터 관리 */
/* ---------- 제안서 탭 ---------- */
const curRound = () => S.rounds.find(r => r.id === S.roundId);
const roundSamples = (r, itemId) => S.samples.filter(s => s.round_id === r.id && (!itemId || s.item_id === itemId)).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
const consultOn = () => !!(S.p.consult && S.p.consult.active);
const visibleToCustomer = r => ['sent', 'picked', 'final'].includes(r.status);

async function logEdit(r, text) {
  if (['sent', 'picked'].includes(r.status)) {
    const edits = [...(r.edits || []), { at: nowIso(), who: whoName(), text }];
    // 같은 사람이 10분 안에 이어서 고치면 같은 버전으로 묶음
    const prev = (r.edits || [])[(r.edits || []).length - 1];
    const grouped = prev && r.rev > 1 && prev.who === whoName() && Date.now() - new Date(prev.at).getTime() < 10 * 60 * 1000;
    const u = await DB.updateRound(r.id, { rev: grouped ? r.rev : (r.rev || 1) + 1, edits }); Object.assign(r, u);
  }
  await DB.addLog(S.p.id, whoName(), `${r.n}차 ${text}`);
}
async function refreshProposal() { await loadDetail(S.p.id); drawDetail(); ping(); }

function drawProposal() {
  const items = reqItems();
  const r = curRound();
  const last = S.rounds[S.rounds.length - 1];
  let h = `<div class="rtabs">${S.rounds.map(x => `<button data-round="${x.id}" class="${x.id === S.roundId ? 'on' : ''}">${x.n}차${x.rev > 1 ? ' v' + x.rev : ''} · ${x.status === 'draft' ? '작성 중' : x.status === 'sent' ? '공개' : x.status === 'picked' ? '선택 완료' : '확정'}</button>`).join('')}
    ${!last ? `<button id="newround">+ 1차 제안 만들기</button>` : ''}</div>`;
  if (!items.length) { $('#dbody').innerHTML = h + `<div class="empty">요청서에 촬영 아이템·컷수를 먼저 입력하세요.<br><button class="btn" style="margin-top:10px" onclick="location.hash='#/studio/p/${S.p.id}/request'">요청서로 이동</button></div>`; bindProposalTop(); return; }
  if (!r) { $('#dbody').innerHTML = h + `<div class="empty">아직 제안서가 없습니다. 1차 제안을 만들어 샘플을 채우세요.<br><span class="small">아이템별 요청 컷수의 2~3배수를 권장합니다.</span></div>`; bindProposalTop(); return; }
  const isLast = r.id === last.id;
  const final = r.status === 'final';
  const counts = items.map(it => ({ it, n: roundSamples(r, it.id).filter(s => !s.state).length, picked: roundSamples(r, it.id).filter(s => s.picked && !s.state).length }));
  const hasPicks = counts.some(c => c.picked);

  h += `<div class="card" style="margin-bottom:18px">
    <div class="row between"><div class="row"><h2 style="font-size:18px">${r.n}차 제안${r.rev > 1 ? ` <span class="muted" style="font-weight:400">v${r.rev}</span>` : ''}</h2>
      <span class="chip ${r.status === 'draft' ? '' : r.status === 'final' ? 'dark' : 'ok'}">${ROUND_STATUS[r.status]}</span>
      ${r.sent_at ? `<span class="small muted">공개 ${fmt(r.sent_at)}</span>` : ''}</div>
      <div class="row">
        ${r.status === 'draft' ? `<button class="btn primary" id="publish">고객에게 공개</button>` : ''}
        ${isLast && ['sent', 'picked'].includes(r.status) ? `<button class="btn" id="nextround" ${hasPicks ? '' : 'disabled title="선택된 안이 있어야 합니다"'}>선택안으로 ${r.n + 1}차 만들기</button>
          <button class="btn primary" id="finalize" ${hasPicks ? '' : 'disabled title="선택된 안이 있어야 합니다"'}>최종 확정</button>` : ''}
        ${!final ? `<button class="btn ghost" id="cleanup">데이터 정리</button>` : ''}</div></div>
    <label class="f" style="margin-top:12px">고객에게 보이는 안내 문구</label>
    <textarea id="rnote" rows="2" placeholder="예: 1차 선택하신 A-2 방향으로 조명과 소품을 바꿔 봤습니다.">${esc(r.studio_note || '')}</textarea>
    ${r.status === 'picked' || r.customer_note || r.intent ? `<div class="notice ${r.intent === 'confirm' ? '' : ''}" style="margin-top:12px"><b>고객 응답</b> ${r.picked_at ? `<span class="small muted">${fmt(r.picked_at)}</span>` : ''}
      ${r.intent ? `<span class="chip ${r.intent === 'confirm' ? 'dark' : ''}">${r.intent === 'confirm' ? '이 선택으로 확정 희망' : '다음 제안 희망'}</span>` : ''}
      <div style="white-space:pre-wrap;margin-top:4px">${esc(r.customer_note || '(종합 의견 없음)')}</div></div>` : ''}
    ${consultOn() && visibleToCustomer(r) ? `<p class="small accent" style="margin:10px 0 0">상담 모드: 카드의 “대신 선택”은 고객 화면에 바로 반영되고 “상담 중 실장 입력”으로 기록됩니다. “고객 화면 이동”은 고객 화면을 그 카드로 옮깁니다.</p>` : ''}
  </div>`;

  if (final) {
    const picked = S.samples.filter(s => s.round_id === r.id && s.picked && !s.state);
    h += `<div class="card" style="margin-bottom:18px"><h2 style="font-size:17px">확정 촬영 목록</h2><table class="shotlist" style="margin-top:10px">
      <thead><tr><th></th><th>번호</th><th>제품</th><th>내용</th><th>고객 의견</th></tr></thead><tbody>
      ${picked.map(s => { const it = items.find(i => i.id === s.item_id) || {}; return `<tr><td><img src="${esc(s.image_url)}" alt=""></td><td><b>${esc(s.label)}</b></td><td>${esc(it.name || '')}</td><td>${esc(s.title)}<div class="small muted" style="white-space:pre-wrap">${esc(s.note)}</div></td><td>${esc(s.pick_comment)}</td></tr>`; }).join('')}
      </tbody></table><div class="row" style="margin-top:10px"><button class="btn sm" id="copyshot">촬영 목록 텍스트 복사</button>
      <button class="btn sm primary" id="gohandoff">${S.handoff ? '촬영·납품 보기 →' : '촬영팀에 인계 →'}</button></div></div>`;
  }

  for (const { it, n, picked } of counts) {
    const cuts = it.cuts || 0; const mult = cuts ? n / cuts : 0;
    const list = roundSamples(r, it.id);
    h += `<div class="item-block"><div class="item-head"><span class="letter">${esc(it.letter)}</span><h3>${esc(it.name || '(제품명 없음)')}</h3>
      <span class="mult ${cuts && mult < 2 ? 'accent' : 'muted'}">요청 ${cuts || '-'}컷 · 샘플 ${n}안${cuts ? ` (${mult.toFixed(1)}배수${mult < 2 ? ', 2배수 미만' : ''})` : ''}</span>
      ${picked ? `<span class="chip dark">${picked}안 선택됨</span>` : ''}
      ${!final ? `<span class="spacer"></span><div class="addbar">
        <button class="btn sm" data-search="${it.id}">+ 사진 검색</button>
        <button class="btn sm" data-upload="${it.id}" data-kind="upload">+ 사진 올리기</button>
        <button class="btn sm" data-upload="${it.id}" data-kind="ai">+ AI 이미지 올리기</button>
        <button class="btn sm ghost" data-link="${it.id}">+ 이미지 주소</button></div>` : ''}</div>
      ${it.desc ? `<p class="small muted" style="margin:-4px 0 10px">요청: ${esc(it.desc)}</p>` : ''}
      <div class="sgrid">${list.map(s => studioCard(s, r)).join('') || '<div class="panel small muted">아직 샘플이 없습니다</div>'}</div></div>`;
  }
  $('#dbody').innerHTML = h;
  bindProposalTop(); bindProposal(r);
}
function studioCard(s, r) {
  const final = r.status === 'final';
  const lockDel = final && s.picked;
  const canPick = visibleToCustomer(r) && !final && !s.state;
  return `<div class="scard ${s.picked ? 'picked' : ''} ${s.state ? 'dim' : ''}" data-sid="${s.id}">
    <div class="img" data-zoom="${s.id}"><img loading="lazy" src="${esc(s.image_url)}" alt=""><span class="lbl">${esc(s.label)}</span>
      ${s.state ? `<span class="pk chip warn">${s.state === 'hold' ? '보류' : '취소'}</span>` : s.picked ? `<span class="pk chip dark">${s.picked_by === 'studio' ? '상담 중 선택' : '고객 선택'}</span>` : ''}</div>
    <div class="body">${s.from_label ? `<span class="src-tag">${esc(s.from_label)} 발전안</span>` : ''}
      <div class="ttl">${s.title ? esc(s.title) : '<span class="muted" style="font-weight:400">제목 없음 · 수정에서 입력</span>'}</div>${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      ${s.pick_comment ? `<div class="small"><b>고객 의견</b> ${esc(s.pick_comment)}</div>` : ''}
      <div class="cr">${s.kind === 'ai' ? '<span class="ai-tag">AI 생성 · 무드 참고용</span>' : esc(creditText(s))}</div></div>
    <div class="acts">
      ${!final ? `<button class="btn sm" data-edit="${s.id}">수정</button>
        <button class="btn sm ghost" data-state="${s.id}" data-v="hold">${s.state === 'hold' ? '보류 해제' : '보류'}</button>
        <button class="btn sm ghost" data-state="${s.id}" data-v="cancel">${s.state === 'cancel' ? '취소 해제' : '취소'}</button>` : ''}
      ${lockDel ? '' : `<button class="btn sm ghost" data-del="${s.id}" style="color:var(--accent)">삭제</button>`}
      ${canPick ? `<button class="btn sm ${s.picked ? 'primary' : ''}" data-proxy="${s.id}">${s.picked ? '선택 해제' : '대신 선택'}</button>` : ''}
      ${consultOn() && visibleToCustomer(r) && !s.state ? `<button class="btn sm ghost" data-follow="${s.id}" title="고객 화면을 이 카드로 이동">화면 이동</button>` : ''}
    </div></div>`;
}
function bindProposalTop() {
  $$('[data-round]').forEach(b => b.onclick = () => { S.roundId = b.dataset.round; drawProposal(); });
  const nr = $('#newround'); if (nr) nr.onclick = async () => {
    try { const r = await DB.createRound({ project_id: S.p.id, n: 1, status: 'draft', counters: {}, studio_note: '요청하신 컷수의 2~3배수로 샘플을 준비했습니다. 마음에 드는 안을 골라 의견과 함께 보내 주세요.' });
      await DB.addLog(S.p.id, whoName(), '1차 제안 작성 시작'); S.roundId = r.id; await refreshProposal(); } catch (e) { fail(e); }
  };
}
function bindProposal(r) {
  const items = reqItems();
  const rnote = $('#rnote');
  const saveNote = debounce(async () => { try { const u = await DB.updateRound(r.id, { studio_note: rnote.value }); Object.assign(r, u); if (visibleToCustomer(r)) ping(); } catch (e) { fail(e); } }, 800);
  rnote.oninput = () => { r.studio_note = rnote.value; saveNote(); };
  rnote.onblur = async () => { await saveNote.flush(); };

  $$('[data-zoom]').forEach(el => el.onclick = () => {
    const list = roundSamples(r); const i = list.findIndex(s => s.id === el.dataset.zoom);
    openLightbox(list.map(s => ({ url: s.image_url, caption: sampleCaption(s) })), i);
  });
  $('#publish') && ($('#publish').onclick = async () => {
    const empty = items.filter(it => !roundSamples(r, it.id).some(s => !s.state));
    if (empty.length && !confirm(`샘플이 없는 아이템이 있습니다 (${empty.map(i => i.letter).join(', ')}). 그래도 공개할까요?`)) return;
    const low = items.filter(it => it.cuts && roundSamples(r, it.id).filter(s => !s.state).length < it.cuts * 2);
    if (low.length && !confirm(`2배수 미만인 아이템이 있습니다 (${low.map(i => i.letter).join(', ')}). 그래도 공개할까요?`)) return;
    try {
      await rnote.onblur();
      const u = await DB.updateRound(r.id, { status: 'sent', sent_at: nowIso() }); Object.assign(r, u);
      if (['requested', 'consulting'].includes(S.p.status)) S.p = await DB.updateProject(S.p.id, { status: 'proposing' });
      await DB.addLog(S.p.id, whoName(), `${r.n}차 제안 고객 공개`);
      await refreshProposal(); toast('공개했습니다. 고객 링크를 보내 주세요.');
    } catch (e) { fail(e); }
  });
  $('#nextround') && ($('#nextround').onclick = async (e) => {
    const picked = roundSamples(r).filter(s => s.picked && !s.state);
    e.target.disabled = true;
    try {
      const counters = {}; const rows = [];
      for (const s of picked) {
        const it = items.find(i => i.id === s.item_id) || { letter: '?' };
        counters[s.item_id] = (counters[s.item_id] || 0) + 1;
        rows.push({ round_id: null, project_id: S.p.id, item_id: s.item_id, label: `${it.letter}-${counters[s.item_id]}`, sort: counters[s.item_id], kind: s.kind,
          image_url: s.image_url, storage_path: s.storage_path || null, title: s.title, note: [s.note, s.pick_comment ? `고객 의견: ${s.pick_comment}` : ''].filter(Boolean).join('\n'),
          source: s.source, source_url: s.source_url, credit: s.credit, from_label: `${r.n}차 ${s.label}` });
      }
      const nr = await DB.createRound({ project_id: S.p.id, n: r.n + 1, status: 'draft', counters,
        studio_note: `${r.n}차에서 고르신 안을 바탕으로 구체화했습니다.${r.customer_note ? '\n반영한 의견: ' + r.customer_note : ''}` });
      rows.forEach(x => x.round_id = nr.id);
      if (rows.length) await DB.addSamples(rows);
      await DB.addLog(S.p.id, whoName(), `${nr.n}차 제안 작성 시작 (${r.n}차 선택 ${picked.length}안 복사)`);
      S.roundId = nr.id; await refreshProposal(); toast(`${nr.n}차를 만들었습니다. 발전안을 추가해 2~3배수로 채우세요.`, 3500);
    } catch (ex) { fail(ex); e.target.disabled = false; }
  });
  $('#finalize') && ($('#finalize').onclick = e => twoClick(e.target, async () => {
    const missing = items.filter(it => !roundSamples(r, it.id).some(s => s.picked && !s.state));
    if (missing.length && !confirm(`선택된 안이 없는 아이템이 있습니다 (${missing.map(i => i.letter).join(', ')}). 그래도 확정할까요?`)) return;
    const u = await DB.updateRound(r.id, { status: 'final' }); Object.assign(r, u);
    S.p = await DB.updateProject(S.p.id, { status: 'confirmed' });
    await DB.addLog(S.p.id, whoName(), `${r.n}차로 최종 확정 (촬영 목록 고정)`);
    await refreshProposal(); toast('최종 확정했습니다');
  }, '한 번 더 누르면 확정'));
  $('#copyshot') && ($('#copyshot').onclick = () => {
    const picked = S.samples.filter(s => s.round_id === r.id && s.picked && !s.state);
    copyText(`[${S.p.company || S.p.contact_name}] 확정 촬영 목록\n` + picked.map(s => { const it = items.find(i => i.id === s.item_id) || {}; return `- ${s.label} ${it.name || ''} · ${s.title}${s.pick_comment ? ` (의견: ${s.pick_comment})` : ''}`; }).join('\n'));
  });
  $('#cleanup') && ($('#cleanup').onclick = () => cleanupModal(r));
  $('#gohandoff') && ($('#gohandoff').onclick = () => { history.replaceState(null, '', `#/studio/p/${S.p.id}/shoot`); S.tab = 'shoot'; drawDetail(); if (!S.handoff) handoffModal(); });

  $$('[data-search]').forEach(b => b.onclick = () => photoSearchModal(r, items.find(i => i.id === b.dataset.search)));
  $$('[data-upload]').forEach(b => b.onclick = () => uploadSamples(r, items.find(i => i.id === b.dataset.upload), b.dataset.kind));
  $$('[data-link]').forEach(b => b.onclick = () => editSampleModal(r, null, items.find(i => i.id === b.dataset.link)));
  $$('[data-edit]').forEach(b => b.onclick = () => editSampleModal(r, S.samples.find(s => s.id === b.dataset.edit)));
  $$('[data-state]').forEach(b => b.onclick = async () => {
    const s = S.samples.find(x => x.id === b.dataset.state); const v = s.state === b.dataset.v ? null : b.dataset.v;
    try { const patch = { state: v }; if (v) Object.assign(patch, { picked: false, picked_by: '', picked_at: null }); await DB.updateSample(s.id, patch);
      if (visibleToCustomer(r)) await logEdit(r, `${s.label} ${v === 'hold' ? '보류' : v === 'cancel' ? '취소' : '표시 해제'}`); await refreshProposal(); } catch (e) { fail(e); }
  });
  $$('[data-del]').forEach(b => b.onclick = () => twoClick(b, async () => {
    const s = S.samples.find(x => x.id === b.dataset.del);
    await DB.deleteSamples([s]); if (visibleToCustomer(r)) await logEdit(r, `${s.label} 삭제`); else await DB.addLog(S.p.id, whoName(), `${r.n}차 ${s.label} 삭제`);
    await refreshProposal();
  }, '삭제?'));
  $$('[data-proxy]').forEach(b => b.onclick = async () => {
    const s = S.samples.find(x => x.id === b.dataset.proxy); const on = !s.picked;
    try { await DB.updateSample(s.id, { picked: on, picked_by: on ? 'studio' : '', picked_at: on ? nowIso() : null, pick_comment: on ? s.pick_comment : '' });
      await DB.addLog(S.p.id, whoName(), `${consultOn() ? '상담 중 실장 입력 · ' : ''}${r.n}차 ${s.label} ${on ? '선택' : '선택 해제'}`);
      if (on && r.status === 'sent') { const u = await DB.updateRound(r.id, { status: 'picked', picked_at: nowIso() }); Object.assign(r, u); }
      await refreshProposal(); } catch (e) { fail(e); }
  });
  $$('[data-follow]').forEach(b => b.onclick = () => { ping('focus', { id: b.dataset.follow }); toast('고객 화면을 이 카드로 옮겼습니다'); });
}
async function nextLabels(r, itemId, count) {
  const it = reqItems().find(i => i.id === itemId);
  const counters = { ...(r.counters || {}) };
  const labels = []; for (let i = 0; i < count; i++) { counters[itemId] = (counters[itemId] || 0) + 1; labels.push({ label: `${it.letter}-${counters[itemId]}`, sort: counters[itemId] }); }
  const u = await DB.updateRound(r.id, { counters }); Object.assign(r, u);
  return labels;
}
async function addToRound(r, it, rows, what) {
  const labels = await nextLabels(r, it.id, rows.length);
  const full = rows.map((x, i) => ({ round_id: r.id, project_id: S.p.id, item_id: it.id, ...labels[i], ...x }));
  const added = await DB.addSamples(full);
  S.samples.push(...added);
  if (visibleToCustomer(r)) await logEdit(r, `${labels.map(l => l.label).join(', ')} 추가${what ? ' (' + what + ')' : ''}`);
  return added;
}
/* 아이템별 사진 검색어: 스튜디오 메모에 "[사진 검색어 A·i1234abcd] a, b, c" 형태로 저장 (고객에게 안 보임, 고객 확인 해제 안 됨) */
const KW_RE = id => new RegExp('^\\[사진 검색어 [^\\]]*·' + id + '\\]\\s*(.*)$', 'm');
function itemKw(it) { const m = (S.p.studio_memo || '').match(KW_RE(it.id)); return m ? m[1].split(',').map(x => x.trim()).filter(Boolean) : []; }
async function saveItemKw(it, kws) {
  const line = `[사진 검색어 ${it.letter}·${it.id}] ${kws.join(', ')}`;
  const memo = S.p.studio_memo || '';
  S.p.studio_memo = KW_RE(it.id).test(memo) ? memo.replace(KW_RE(it.id), line) : (memo.trim() + '\n' + line).trim();
  RQ.pendingFields.add('memo'); await saveReq.flush();
}
async function makeItemKw(it) {
  const q = S.p.request || {};
  const text = `사진 검색어 만들기 요청입니다. 아래 촬영 아이템 하나만을 위한 무료 사진 사이트(Unsplash·Pexels) 영어 검색어를 search_keywords에 3~6개 적어 주세요. 제품 종류와 이 아이템의 연출·구도가 드러나야 하고, 다른 제품과 겹치는 일반적인 검색어는 피합니다. 나머지 칸은 비워 둡니다.
제품: ${it.name}
컷수: ${it.cuts ?? ''}
촬영 컨셉: ${it.desc || ''}
브랜드: ${q.brand || ''} / 업종: ${q.industry || ''} / 톤: ${q.tone || ''}`;
  const { result } = await DB.fn('extract-call', { text });
  const kws = (result && result.search_keywords || []).map(x => String(x).trim()).filter(Boolean).slice(0, 6);
  if (!kws.length) throw new Error('검색어를 만들지 못했습니다. 직접 입력해 주세요.');
  await saveItemKw(it, kws); return kws;
}
function photoSearchModal(r, it) {
  const memoKw = ((S.p.studio_memo || '').match(/^\[사진 검색어\]\s*(.+)$/m) || [])[1];
  const projKw = memoKw ? memoKw.split(',').map(k => k.trim()).filter(Boolean) : [];
  let kws = itemKw(it);
  const chip = k => `<button type="button" class="chip line" style="cursor:pointer;border-style:solid" data-kw="${esc(k)}">${esc(k)}</button>`;
  const m = modal(`<div class="row between"><h2>${esc(it.letter)}. ${esc(it.name)} · 사진 검색</h2><button class="btn ghost sm" id="ps-x">닫기</button></div>
    ${it.desc ? `<p class="small muted" style="margin:-4px 0 8px;white-space:pre-line">${esc(it.desc)}</p>` : ''}
    <form id="ps-f" class="row"><input type="search" id="ps-q" placeholder="영어 검색어가 결과가 많습니다 (예: serum bottle splash)" style="flex:1;min-width:200px" value="${esc(kws[0] || '')}">
      <select id="ps-src" style="width:auto"><option value="all">Unsplash+Pexels</option><option value="unsplash">Unsplash</option><option value="pexels">Pexels</option></select>
      <button class="btn primary" type="submit">검색</button></form>
    <div class="row small" style="margin-top:8px"><span class="muted">이 아이템 검색어:</span><span id="ps-ikw" class="row" style="gap:6px"></span><button type="button" class="btn ghost sm" id="ps-gen"></button></div>
    ${projKw.length ? `<div class="row small" style="margin-top:6px"><span class="muted">전체 검색어:</span>${projKw.map(chip).join('')}</div>` : ''}
    <p class="small muted" style="margin:8px 0 0">누르면 바로 샘플로 추가됩니다. 무료 라이선스 사진이며 사진작가 표기가 자동으로 붙습니다. 이미 이 차수에 쓴 사진은 흐리게 표시됩니다.</p>
    <div id="ps-res" class="pgrid"></div><div class="row" style="justify-content:center;margin-top:12px"><button class="btn hidden" id="ps-more">더 보기</button></div>`, true, () => drawProposal());
  let page = 1, q = '';
  const drawKw = () => {
    $('#ps-ikw', m.el).innerHTML = kws.length ? kws.map(chip).join('') : '<span class="muted">없음</span>';
    $('#ps-gen', m.el).textContent = kws.length ? '검색어 다시 만들기' : 'Claude로 검색어 만들기';
    $$('#ps-ikw [data-kw]', m.el).forEach(b => b.onclick = () => { $('#ps-q', m.el).value = b.dataset.kw; run(false); });
  };
  $('#ps-x', m.el).onclick = () => m.close();
  const used = () => new Set(S.samples.filter(s => s.round_id === r.id).map(s => s.image_url));
  const run = async (more) => {
    if (!more) { page = 1; q = $('#ps-q', m.el).value.trim(); $('#ps-res', m.el).innerHTML = ''; } else page++;
    if (!q) return;
    const box = $('#ps-res', m.el); const load = document.createElement('div'); load.className = 'empty'; load.style.gridColumn = '1/-1'; load.innerHTML = '<span class="spin"></span>'; box.appendChild(load);
    try {
      const { photos, notes } = await DB.fn('photo-search', { q, source: $('#ps-src', m.el).value, page });
      load.remove();
      if ((notes || []).length && page === 1) toast(notes.join(' · '), 3500);
      if (!photos.length && page === 1) box.innerHTML = '<div class="empty" style="grid-column:1/-1">결과가 없습니다. 영어 검색어로 바꿔 보세요.</div>';
      const u = used();
      for (const ph of photos) {
        const d = document.createElement('div'); d.className = 'pres'; d.innerHTML = `<img loading="lazy" src="${esc(ph.thumb)}" alt=""><div class="cap">${esc(ph.source)} · ${esc(ph.credit)}</div>`;
        if (u.has(ph.full)) { d.style.opacity = '.4'; d.title = '이미 이 차수에 추가한 사진'; }
        d.onclick = async () => {
          if (d.classList.contains('added') || d.dataset.busy) return; d.dataset.busy = '1';
          try {
            await addToRound(r, it, [{ kind: 'photo', image_url: ph.full, title: '', note: '', source: ph.source, source_url: ph.source_url, credit: ph.credit }], ph.source);
            if (ph.download_location) DB.fn('photo-search', { action: 'track', download_location: ph.download_location }).catch(() => {});
            d.classList.add('added'); ping();
          } catch (e) { fail(e); } finally { delete d.dataset.busy; }
        };
        box.appendChild(d);
      }
      $('#ps-more', m.el).classList.toggle('hidden', photos.length < 10);
    } catch (e) { load.remove(); fail(e); }
  };
  $('#ps-f', m.el).onsubmit = e => { e.preventDefault(); run(false); };
  $('#ps-more', m.el).onclick = () => run(true);
  $$('[data-kw]', m.el).forEach(b => b.onclick = () => { $('#ps-q', m.el).value = b.dataset.kw; run(false); });
  const gen = async () => {
    const b = $('#ps-gen', m.el); b.disabled = true; b.innerHTML = '<span class="spin"></span> 만드는 중';
    try { kws = await makeItemKw(it); drawKw(); $('#ps-q', m.el).value = kws[0]; run(false); }
    catch (e) { fail(e); drawKw(); } finally { b.disabled = false; }
  };
  $('#ps-gen', m.el).onclick = gen;
  drawKw();
  $('#ps-q', m.el).focus();
  if (kws.length) run(false);
  else if (!DEMO) gen();
}
function uploadSamples(r, it, kind) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files]; if (!files.length) return;
    toast(`${files.length}장 올리는 중…`);
    try {
      const rows = [];
      for (const f of files) { const blob = await resizeImage(f, DEMO ? 700 : 1600); const up = await DB.upload(blob);
        rows.push({ kind, image_url: up.url, storage_path: up.path, title: '', note: '', source: kind === 'ai' ? 'AI 생성' : '스튜디오', credit: '' }); }
      await addToRound(r, it, rows, kind === 'ai' ? 'AI 이미지' : '업로드');
      await refreshProposal(); toast(`${files.length}장 추가했습니다`);
    } catch (e) { fail(e); }
  };
  inp.click();
}
function editSampleModal(r, s, it) {
  const isNew = !s;
  const m = modal(`<h2>${isNew ? `${esc(it.letter)}. ${esc(it.name)} · 이미지 주소로 추가` : `${esc(s.label)} 수정`}</h2><div class="stack">
    ${isNew ? '<p class="small muted" style="margin:0">스튜디오 자체 사진이나 라이선스를 확보한 사진만 넣으세요. 다른 스튜디오 포트폴리오·핀터레스트 사진은 넣지 않습니다.</p>' : ''}
    <div><label class="f">이미지 주소</label><input type="url" id="e-url" value="${esc(s ? s.image_url : '')}" ${s && s.storage_path ? 'readonly' : ''}></div>
    <div><label class="f">제목 (고객에게 보임)</label><input type="text" id="e-title" value="${esc(s ? s.title : '')}" placeholder="예: 물방울 튀는 정면 컷"></div>
    <div><label class="f">설명 (고객에게 보임)</label><textarea id="e-note" rows="3" placeholder="구도, 조명, 소품, 연출 포인트">${esc(s ? s.note : '')}</textarea></div>
    <div class="grid2"><div><label class="f">출처</label><input type="text" id="e-src" value="${esc(s ? s.source : '')}"></div><div><label class="f">사진작가·표기</label><input type="text" id="e-credit" value="${esc(s ? s.credit : '')}"></div></div>
    <label class="row small"><input type="checkbox" id="e-ai" ${s && s.kind === 'ai' ? 'checked' : ''}> AI 생성 이미지 ("AI 생성 · 무드 참고용" 표시)</label>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="e-c">취소</button><button class="btn primary" id="e-ok">${isNew ? '추가' : '저장'}</button></div></div>`);
  $('#e-c', m.el).onclick = m.close;
  $('#e-ok', m.el).onclick = async () => {
    const url = $('#e-url', m.el).value.trim(); if (!/^(https?:|data:image)/.test(url)) return toast('이미지 주소를 확인하세요');
    const ai = $('#e-ai', m.el).checked;
    const patch = { image_url: url, title: $('#e-title', m.el).value.trim(), note: $('#e-note', m.el).value.trim(), source: $('#e-src', m.el).value.trim(), credit: $('#e-credit', m.el).value.trim() };
    try {
      if (isNew) await addToRound(r, it, [{ ...patch, kind: ai ? 'ai' : 'link' }], '이미지 주소');
      else { patch.kind = ai ? 'ai' : (s.kind === 'ai' ? (s.storage_path ? 'upload' : 'link') : s.kind); await DB.updateSample(s.id, patch); if (visibleToCustomer(r)) await logEdit(r, `${s.label} 수정`); }
      m.close(); await refreshProposal();
    } catch (e) { fail(e); }
  };
}
function cleanupModal(r) {
  const all = roundSamples(r);
  const unpicked = all.filter(s => !s.picked);
  const held = all.filter(s => s.state);
  const canUnpicked = ['picked'].includes(r.status);
  const m = modal(`<h2>${r.n}차 데이터 정리</h2><p class="small muted" style="margin:-6px 0 12px">모든 삭제는 되돌릴 수 없습니다. 샘플 번호는 지워도 바뀌지 않습니다.</p><div class="stack">
    <div class="row between"><span>선택 안 된 샘플 ${unpicked.length}개 삭제 ${canUnpicked ? '' : '<span class="small muted">(고객 선택이 끝난 차수만)</span>'}</span><button class="btn sm danger" id="c-un" ${canUnpicked && unpicked.length ? '' : 'disabled'}>삭제</button></div>
    <div class="row between"><span>보류·취소 샘플 ${held.length}개 삭제</span><button class="btn sm danger" id="c-held" ${held.length ? '' : 'disabled'}>삭제</button></div>
    <div class="row between"><span>${r.n}차 전체 삭제 (샘플 ${all.length}개 포함)</span><button class="btn sm danger" id="c-all">차수 삭제</button></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="c-x">닫기</button></div></div>`);
  $('#c-x', m.el).onclick = m.close;
  $('#c-un', m.el).onclick = e => twoClick(e.target, async () => { await DB.deleteSamples(unpicked); await DB.addLog(S.p.id, whoName(), `${r.n}차 선택 안 된 샘플 ${unpicked.length}개 삭제`); m.close(); await refreshProposal(); });
  $('#c-held', m.el).onclick = e => twoClick(e.target, async () => { await DB.deleteSamples(held); if (visibleToCustomer(r)) await logEdit(r, `보류·취소 샘플 ${held.length}개 삭제`); else await DB.addLog(S.p.id, whoName(), `${r.n}차 보류·취소 샘플 ${held.length}개 삭제`); m.close(); await refreshProposal(); });
  $('#c-all', m.el).onclick = e => twoClick(e.target, async () => {
    const later = S.rounds.some(x => x.n > r.n);
    if (later && !confirm('이후 차수가 있습니다. 그래도 이 차수를 지울까요? (이후 차수의 “발전안” 표시는 그대로 남습니다)')) return;
    await DB.deleteRound(r.id); await DB.addLog(S.p.id, whoName(), `${r.n}차 전체 삭제`); S.roundId = null; m.close(); await refreshProposal();
  }, '한 번 더 누르면 차수 삭제');
}

/* ---------- 진행 기록 탭 ---------- */
function drawLog() {
  $('#dbody').innerHTML = `<div class="card"><p class="sec-title">진 행 기 록</p><ul class="log">${S.logs.map(l => `<li><span class="muted">${fmt(l.at)}</span><span>${esc(l.who)}</span><span style="color:var(--strong)">${esc(l.text)}</span></li>`).join('') || '<li>기록이 없습니다</li>'}</ul></div>`;
}

/* ---------- 데이터 관리 (관리자) ---------- */
async function renderDataAdmin() {
  document.title = '데이터 관리 · SPOTPLAN';
  app.innerHTML = topbar('studio') + `<main class="wrap" style="padding-top:24px;padding-bottom:40px">
    <p class="sec-title">데 이 터 관 리</p><h1 class="page-title">테스트·취소 프로젝트 삭제</h1>
    <p class="muted">요청서, 모든 차수, 샘플 사진 파일, 진행 기록이 함께 삭제됩니다. 되돌릴 수 없습니다.</p>
    <div id="dlist" style="margin-top:16px"><div class="empty"><span class="spin"></span></div></div></main>`;
  bindTop();
  if (!S.me || S.me.role !== 'admin') { $('#dlist').innerHTML = '<div class="empty">관리자만 사용할 수 있습니다.</div>'; return; }
  const list = (await DB.listProjects()).filter(p => p.is_test || p.status === 'cancelled');
  if (!list.length) { $('#dlist').innerHTML = '<div class="empty">삭제할 테스트·취소 프로젝트가 없습니다</div>'; return; }
  $('#dlist').innerHTML = `<div class="card"><label class="row" style="margin-bottom:10px"><input type="checkbox" id="d-all"> 전체 선택</label>
    ${list.map(p => `<label class="row" style="padding:8px 0;border-top:1px solid var(--line)"><input type="checkbox" data-pid="${p.id}">
      <span class="grow"><b style="color:var(--strong)">${esc(p.company || p.contact_name)}</b> <span class="small muted">${fmt(p.created_at, false)} · ${STATUS[p.status]}</span></span>
      ${p.is_test ? '<span class="chip warn">테스트</span>' : ''}${p.status === 'cancelled' ? '<span class="chip">취소</span>' : ''}</label>`).join('')}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn danger" id="d-go">선택한 프로젝트 삭제</button></div></div>`;
  $('#d-all').onchange = e => $$('[data-pid]').forEach(c => c.checked = e.target.checked);
  $('#d-go').onclick = e => {
    const ids = $$('[data-pid]').filter(c => c.checked).map(c => c.dataset.pid);
    if (!ids.length) return toast('삭제할 프로젝트를 고르세요');
    twoClick(e.target, async () => { await DB.deleteProjects(ids); toast(`${ids.length}개 프로젝트를 삭제했습니다`); renderDataAdmin(); }, `한 번 더 누르면 ${ids.length}개 삭제`);
  };
}
