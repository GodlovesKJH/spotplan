/* SPOTPLAN — 고객 요청서 · 고객 제안서 화면 */
/* =====================================================================
   1) 고객 최소 요청서
   ===================================================================== */
function renderRequestForm() {
  document.title = `촬영 요청서 · ${CFG.STUDIO_NAME}`;
  const q = new URLSearchParams(location.search);
  const src = (q.get('src') || '').slice(0, 60);
  const f = { purpose: '' };
  app.innerHTML = topbar('form') + `
  <main class="wrap narrow" style="max-width:640px;padding-top:28px;padding-bottom:40px">
    <p class="sec-title">촬 영 요 청 서</p>
    <h1 class="page-title">어떤 촬영을 준비하고 계신가요?</h1>
    <p class="muted" style="margin:6px 0 22px">30초면 충분합니다. 자세한 내용은 전화로 함께 정리해 드릴게요.</p>
    <form id="rf" class="stack" novalidate autocomplete="on">
      <div>
        <label class="f req">촬영 목적</label>
        <div class="choices">${PURPOSES.map(p => `<button type="button" class="choice" data-k="${p.k}"><b>${p.t}</b><small>${p.d}</small></button>`).join('')}</div>
        <div id="pnote" style="margin-top:10px"></div>
      </div>
      <div class="grid2">
        <div><label class="f req" for="f-name">성함</label><input type="text" id="f-name" name="name" autocomplete="name" required></div>
        <div><label class="f" for="f-company">업체·브랜드명</label><input type="text" id="f-company" name="organization" autocomplete="organization"></div>
        <div><label class="f req" for="f-phone">연락처</label><input type="tel" id="f-phone" name="tel" autocomplete="tel" inputmode="tel" placeholder="010-0000-0000" required></div>
        <div><label class="f req" for="f-email">이메일</label><input type="email" id="f-email" name="email" autocomplete="email" required></div>
      </div>
      <div>
        <label class="f">참고 파일 <span class="muted">(선택)</span></label>
        <label class="drop" id="f-drop" for="f-files"><b>+ 파일 첨부</b><small>제품 사진, 기획안, 참고 이미지 등 · 최대 10개, 파일당 20MB</small></label>
        <input type="file" id="f-files" multiple class="vh">
        <ul class="flist" id="f-list"></ul>
      </div>
      <details class="more">
        <summary>더 알려주시면 더 빨리 준비해 드려요 (선택)</summary>
        <div class="stack" style="margin-top:12px">
          <div><label class="f" for="f-product">제품명·대략 수량</label><input type="text" id="f-product" placeholder="예: 앰플 2종, 크림 1종"></div>
          <div class="grid2">
            <div><label class="f" for="f-schedule">희망 일정</label><input type="text" id="f-schedule" placeholder="예: 10월 둘째 주"></div>
            <div><label class="f" for="f-calltime">통화 가능 시간</label><input type="text" id="f-calltime" placeholder="예: 평일 오후 2~5시"></div>
          </div>
          <div><label class="f" for="f-ref">참고하고 싶은 사진·링크</label><input type="text" id="f-ref" placeholder="인스타그램, 쇼핑몰 링크 등"></div>
          <div><label class="f">편한 상담 방식</label>
            <div class="radios">${['전화', '카카오톡', '이메일'].map(v => `<label><input type="radio" name="pref" value="${v}">${v}</label>`).join('')}</div></div>
          ${src ? '' : `<div><label class="f" for="f-src">스팟스튜디오를 알게 된 경로</label><select id="f-src"><option value="">선택 안 함</option>${SOURCES.map(s => `<option>${s}</option>`).join('')}</select></div>`}
          <div><label class="f" for="f-memo">남기실 말</label><textarea id="f-memo" rows="3"></textarea></div>
        </div>
      </details>
      <div class="consent">
        <label><input type="checkbox" id="f-consent"> <span>개인정보 수집·이용에 동의합니다 <span class="accent">(필수)</span></span></label>
        <div style="margin-top:6px;padding-left:24px">
          수집 항목: 성함, 업체명, 연락처, 이메일, 요청 내용, 첨부 파일 · 이용 목적: 촬영 상담, 견적·제안서 제공 · 보관 기간: ${esc(CFG.PRIVACY_RETENTION)}<br>
          ${esc(CFG.PRIVACY_AI_NOTE)} 동의하지 않으실 수 있으나, 이 경우 상담이 어렵습니다.
        </div>
      </div>
      <div class="hp" aria-hidden="true"><label>홈페이지<input type="text" id="f-hp" tabindex="-1" autocomplete="off"></label></div>
      <div id="ferr" class="notice warn hidden"></div>
      <button type="submit" class="btn primary big" id="f-submit">요청 보내기</button>
      <p class="small muted" style="text-align:center">급한 문의는 ${esc(CFG.STUDIO_PHONE)}로 전화 주세요.</p>
    </form>
  </main>
  <footer class="foot">${esc(CFG.STUDIO_NAME)} · 기획부터 촬영까지, 외주 없이 소속 인원이 직접 진행합니다</footer>`;
  bindTop();
  /* 첨부 파일 */
  const files = []; const MAXF = 10, MAXS = 20 * 1048576;
  const drawFiles = () => {
    $('#f-list').innerHTML = files.map((f, i) => `<li>${/^image\//.test(f.type) ? `<img data-prev="${i}" alt="">` : `<span class="ficon">${esc(extOf(f.name).toUpperCase().slice(0, 4))}</span>`}
      <span class="fn">${esc(f.name)}</span><span class="small muted">${fmtSize(f.size)}</span><button type="button" class="btn ghost sm" data-rm="${i}" aria-label="빼기">✕</button></li>`).join('');
    $$('#f-list [data-prev]').forEach(img => { img.src = URL.createObjectURL(files[+img.dataset.prev]); img.onload = () => URL.revokeObjectURL(img.src); });
    $$('#f-list [data-rm]').forEach(b => b.onclick = () => { files.splice(+b.dataset.rm, 1); drawFiles(); });
  };
  const addFiles = list => {
    for (const f of list) {
      if (files.length >= MAXF) { toast(`파일은 최대 ${MAXF}개까지 첨부할 수 있습니다`); break; }
      if (f.size > MAXS) { toast(`${f.name}: 20MB가 넘는 파일은 첨부할 수 없습니다`, 3500); continue; }
      if (!f.size) continue;
      if (!files.some(x => x.name === f.name && x.size === f.size)) files.push(f);
    }
    drawFiles();
  };
  $('#f-files').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
  const drop = $('#f-drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles([...(e.dataTransfer.files || [])]));
  $$('.choice').forEach(b => b.onclick = () => {
    f.purpose = b.dataset.k; $$('.choice').forEach(x => x.classList.toggle('on', x === b));
    const n = $('#pnote');
    if (f.purpose === 'direction') n.innerHTML = `<div class="notice"><b>기획 포함 패키지</b>로 안내해 드립니다. 촬영 방향·컷 구성부터 함께 잡는 유료 기획 서비스이며, 비용은 상담 때 안내드립니다.</div>`;
    else if (f.purpose === 'rental') n.innerHTML = `<div class="notice">스튜디오 대관은 ${CFG.RENTAL_URL ? `<a href="${esc(CFG.RENTAL_URL)}" target="_blank" rel="noopener">아워플레이스 예약 페이지</a>` : '아워플레이스에서 “스팟스튜디오”를 검색해'} 바로 예약하실 수 있습니다. 문의가 필요하시면 아래를 작성해 주세요.</div>`;
    else n.innerHTML = '';
  });
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#ferr'); err.classList.add('hidden');
    const v = id => ($(id) ? $(id).value.trim() : '');
    const missing = [];
    if (!f.purpose) missing.push('촬영 목적');
    if (!v('#f-name')) missing.push('성함');
    if (!v('#f-phone')) missing.push('연락처');
    if (!/^\S+@\S+\.\S+$/.test(v('#f-email'))) missing.push('이메일');
    if (!$('#f-consent').checked) missing.push('개인정보 동의');
    if (missing.length) { err.textContent = `확인해 주세요: ${missing.join(', ')}`; err.classList.remove('hidden'); return; }
    if (v('#f-hp')) { showDone(); return; } // 자동 제출 방지
    const pref = $('input[name=pref]:checked');
    const intake = {}; const put = (k, val) => { if (val) intake[k] = val.slice(0, 1000); };
    put('product', v('#f-product')); put('schedule', v('#f-schedule')); put('call_time', v('#f-calltime'));
    put('reference', v('#f-ref')); put('contact_pref', pref ? pref.value : ''); put('memo', v('#f-memo'));
    const btn = $('#f-submit'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 보내는 중';
    try {
      const attachments = [];
      if (files.length) {
        const folder = rid();
        for (let i = 0; i < files.length; i++) {
          btn.innerHTML = `<span class="spin"></span> 파일 올리는 중 (${i + 1}/${files.length})`;
          attachments.push(await DB.uploadAttachment(files[i], folder, i));
        }
        btn.innerHTML = '<span class="spin"></span> 보내는 중';
      }
      await DB.submitRequest({ purpose: f.purpose, company: v('#f-company'), contact_name: v('#f-name'), phone: v('#f-phone'), email: v('#f-email'),
        consent: true, intake, source: src || v('#f-src'), attachments });
      showDone();
    } catch (ex) {
      err.textContent = '전송하지 못했습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요. (' + ex.message + ')'; err.classList.remove('hidden');
      btn.disabled = false; btn.textContent = '요청 보내기';
    }
  };
  function showDone() {
    $('main').innerHTML = `<div style="padding:40px 0;text-align:center">
      <div style="display:inline-block;margin-bottom:18px">${logoSvg(44)}</div>
      <h1 class="page-title">요청이 접수되었습니다</h1>
      <p style="margin:10px 0 4px">내용을 확인한 뒤 연락드리겠습니다.</p>
      <p class="muted">통화로 원하시는 방향을 함께 정리한 뒤, 온라인 제안서 링크를 보내드립니다.</p>
      <div class="panel" style="text-align:left;margin-top:24px"><b style="color:var(--strong)">진행 순서</b>
        <div style="margin-top:8px">${dotsHtml('requested')}</div>
        <p class="small muted" style="margin:10px 0 0">요청 → 전화 상담 → 온라인 제안서(마음에 드는 안 고르기) → 확정 → 촬영</p></div>
    </div>`;
    window.scrollTo(0, 0);
  }
}
/* =====================================================================
   2) 고객 제안서 화면 (비밀 링크)
   ===================================================================== */
const C = { token: null, data: null, roundId: null, picks: {}, dirty: {}, note: {}, intent: {}, typingTimer: null, lastLoad: null };
async function renderCustomer(token) {
  closeChannels();
  C.token = token;
  app.innerHTML = topbar('customer') + `<div id="cbanner"></div><main class="wrap" id="cmain" style="padding-bottom:40px"><div class="empty"><span class="spin"></span></div></main>`;
  $('#cmain').addEventListener('focusout', () => setTimeout(() => { if (C.pendingDraw && !$('#cmain').contains(document.activeElement)) { C.pendingDraw = false; drawCustomer(); } }, 50));
  await loadCustomer(true);
  S.chan = DB.channel(token, msg => {
    if (msg.kind === 'refresh') loadCustomer();
    if (msg.kind === 'typing') showTyping();
    if (msg.kind === 'focus') focusSample(msg.id);
  });
}
async function loadCustomer(first = false) {
  try {
    const d = await DB.getProposal(C.token);
    if (!d) { $('#cmain').innerHTML = `<div class="empty"><h2>링크를 찾을 수 없습니다</h2><p>주소가 바뀌었을 수 있습니다. ${esc(CFG.STUDIO_NAME)}(${esc(CFG.STUDIO_PHONE)})로 문의해 주세요.</p></div>`; return; }
    C.data = d; C.lastLoad = nowIso();
    const consultOn = !!(d.consult && d.consult.active);
    for (const r of d.rounds) {
      if (!C.dirty[r.id] || consultOn) {
        C.picks[r.id] = {}; for (const s of r.samples) C.picks[r.id][s.id] = { picked: !!s.picked, comment: s.pick_comment || '' };
        C.note[r.id] = r.customer_note || ''; C.intent[r.id] = r.intent || ''; C.dirty[r.id] = false;
      }
    }
    const newRound = d.rounds.length > (C.roundCount || 0); C.roundCount = d.rounds.length;
    if (!C.roundId || !d.rounds.some(r => r.id === C.roundId) || first || newRound) C.roundId = d.rounds.length ? d.rounds[d.rounds.length - 1].id : null;
    const ae = document.activeElement;
    if (!first && !consultOn && ae && ['TEXTAREA', 'INPUT'].includes(ae.tagName) && $('#cmain').contains(ae)) { C.pendingDraw = true; return; }
    drawCustomer();
  } catch (e) { $('#cmain').innerHTML = `<div class="empty">불러오지 못했습니다: ${esc(e.message)}</div>`; }
}
function showTyping() {
  const t = $('#ctyping'); if (!t) return; t.textContent = '실장님이 입력 중…';
  clearTimeout(C.typingTimer); C.typingTimer = setTimeout(() => { if ($('#ctyping')) $('#ctyping').textContent = ''; }, 2500);
}
function focusSample(id) {
  const r = C.data && C.data.rounds.find(x => x.samples.some(s => s.id === id));
  if (r && r.id !== C.roundId) { C.roundId = r.id; drawCustomer(); }
  const el = document.querySelector(`[data-sid="${id}"]`); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('focus'); setTimeout(() => el.classList.remove('focus'), 3500);
}
function drawCustomer() {
  const d = C.data; const scrollY = window.scrollY; C.pendingDraw = false;
  document.title = `${d.company || d.contact_name} 촬영 제안 · ${CFG.STUDIO_NAME}`;
  const consultOn = !!(d.consult && d.consult.active);
  $('#cbanner').innerHTML = consultOn ? `<div class="banner"><span class="pulse"></span><span>${esc(CFG.STUDIO_NAME)}와 상담 중입니다 · 실장님이 화면에 함께 입력하고 있어요</span><span class="typing" id="ctyping"></span></div>` : '';
  const req = d.request || {}; const items = req.items || [];
  const round = d.rounds.find(r => r.id === C.roundId);
  const latest = d.rounds[d.rounds.length - 1];

  let html = `<section class="cust-hero">
    <p class="sec-title">촬 영 제 안</p>
    <div class="row between"><h1 class="page-title">${esc(d.company || d.contact_name)}${d.company && d.contact_name ? ` <span class="muted" style="font-size:16px;font-weight:400">${esc(d.contact_name)} 님</span>` : ''}</h1>
      <span class="row small muted">마지막 업데이트 ${esc(ago(d.updated_at))} <button class="btn sm" id="creload">새로고침</button></span></div>
    <div style="margin-top:14px">${dotsHtml(d.status)}</div>
  </section>`;

  // 요청서
  if (d.request_shared) {
    const filled = REQ_FIELDS.filter(([k]) => req[k]);
    html += `<section class="card" style="margin-top:8px">
      <div class="row between"><h2 style="font-size:17px">상담으로 정리한 요청 내용</h2>
      ${d.request_confirmed_at ? `<span class="chip ok">확인 완료 · ${fmt(d.request_confirmed_at)}</span>` : `<span class="chip warn">확인 전</span>`}</div>
      ${filled.length ? `<dl class="kv" style="margin-top:12px">${filled.map(([k, l]) => `<dt>${l}</dt><dd>${esc(req[k])}</dd>`).join('')}</dl>` : ''}
      ${items.length ? `<table class="shotlist" style="margin-top:14px"><thead><tr><th></th><th>제품</th><th>요청 컷수</th><th>요청 사항</th></tr></thead><tbody>
        ${items.map(it => `<tr><td><b>${esc(it.letter)}</b></td><td>${esc(it.name)}</td><td>${it.cuts ?? '-'}</td><td>${esc(it.desc || '')}</td></tr>`).join('')}</tbody></table>` : ''}
      ${(d.checks || []).length ? `<div class="notice warn" style="margin-top:14px"><b>확인이 필요한 부분</b><ul class="checks">${d.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      ${d.request_confirmed_at ? '' : `<div class="row" style="margin-top:14px"><button class="btn primary" id="cconfirm">이대로 확인</button><span class="small muted">내용이 다르면 실장님께 말씀해 주세요.</span></div>`}
    </section>`;
  }

  html += customerShootHtml(d);
  if (!d.rounds.length) {
    html += d.request_shared ? '' : `<section class="card" style="margin-top:8px"><h2 style="font-size:17px">요청이 접수되었습니다</h2>
      <p class="muted" style="margin:6px 0 0">상담 후 이 페이지에서 제안서를 보실 수 있습니다.</p></section>`;
  } else {
    html += `<section style="margin-top:26px"><p class="sec-title">제 안 서</p>
      <div class="rtabs">${d.rounds.map(r => `<button data-rid="${r.id}" class="${r.id === C.roundId ? 'on' : ''}">${r.n}차${r.rev > 1 ? ` v${r.rev}` : ''}${r.status === 'final' ? ' · 확정' : ''}</button>`).join('')}</div>`;
    if (round) html += customerRound(round, items, round.id === latest.id);
    html += `</section>`;
  }
  html += `<footer class="foot">${esc(CFG.STUDIO_NAME)} · ${esc(CFG.STUDIO_PHONE)}<br>샘플 사진은 방향을 정하기 위한 참고 자료이며, 실제 촬영은 고객님의 제품으로 새로 진행합니다.</footer>`;
  $('#cmain').innerHTML = html;
  window.scrollTo(0, scrollY);
  bindCustomer();
}
function customerRound(r, items, isLatest) {
  const P = C.picks[r.id] || {};
  const open = isLatest && ['sent', 'picked'].includes(r.status);
  const final = r.status === 'final';
  let h = '';
  if (r.studio_note) h += `<div class="notice" style="margin-bottom:18px;white-space:pre-wrap">${esc(r.studio_note)}</div>`;
  if (r.rev > 1 && (r.edits || []).length) h += `<details class="small muted" style="margin-bottom:14px"><summary>수정 이력 (v${r.rev})</summary><ul>${r.edits.map(e => `<li>${fmt(e.at)} · ${esc(e.text)}</li>`).join('')}</ul></details>`;
  if (final) {
    const picked = r.samples.filter(s => s.picked);
    h += `<div class="card" style="margin-bottom:22px"><h2 style="font-size:17px">확정 촬영 목록</h2>
      <table class="shotlist" style="margin-top:10px"><thead><tr><th></th><th>번호</th><th>제품</th><th>내용</th></tr></thead><tbody>
      ${picked.map(s => { const it = items.find(i => i.id === s.item_id) || {}; return `<tr><td><img src="${esc(s.image_url)}" alt=""></td><td><b>${esc(s.label)}</b></td><td>${esc(it.name || '')}</td><td>${esc(s.title)}${s.pick_comment ? `<br><span class="muted small">의견: ${esc(s.pick_comment)}</span>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  }
  const groups = items.length ? items : [...new Set(r.samples.map(s => s.item_id))].map(id => ({ id, letter: '', name: '' }));
  for (const it of groups) {
    const list = r.samples.filter(s => s.item_id === it.id);
    if (!list.length) continue;
    const cnt = list.filter(s => P[s.id] && P[s.id].picked).length;
    h += `<div class="item-block"><div class="item-head">${it.letter ? `<span class="letter">${esc(it.letter)}</span>` : ''}<h3>${esc(it.name || '제품')}</h3>
      <span class="small muted">요청 ${it.cuts ?? '-'}컷 · 샘플 ${list.length}안</span>${open ? `<span class="chip ${cnt ? 'dark' : ''}">${cnt}안 선택</span>` : ''}</div>
      <div class="sgrid">${list.map((s, i) => {
        const pk = P[s.id] || {};
        return `<div class="scard ${pk.picked ? 'picked' : ''}" data-sid="${s.id}">
          <div class="img" data-zoom="${s.id}"><img loading="lazy" src="${esc(s.image_url)}" alt="${esc(s.title)}"><span class="lbl">${esc(s.label)}</span>
            ${pk.picked ? `<span class="pk chip dark">${s.picked_by === 'studio' ? '상담 중 선택' : '선택'}</span>` : ''}</div>
          <div class="body">${s.from_label ? `<span class="src-tag">${esc(s.from_label)} 발전안</span>` : ''}
            ${s.title ? `<div class="ttl">${esc(s.title)}</div>` : ''}${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
            <div class="cr">${s.kind === 'ai' ? '<span class="ai-tag">AI 생성 · 무드 참고용</span>' : esc(creditText(s))}</div></div>
          ${open ? `<button class="btn sm ${pk.picked ? 'primary' : ''} pickbtn" data-pick="${s.id}">${pk.picked ? '✓ 선택됨' : '이 안 선택'}</button>
            ${pk.picked ? `<textarea data-cmt="${s.id}" placeholder="이 안에 대한 의견 (선택)">${esc(pk.comment)}</textarea>` : ''}`
            : (pk.picked && pk.comment ? `<div class="small" style="padding:0 12px 10px">의견: ${esc(pk.comment)}</div>` : '')}
        </div>`; }).join('')}</div></div>`;
  }
  if (open) {
    const total = Object.values(P).filter(x => x.picked).length;
    h += `<div class="card"><h2 style="font-size:16px">종합 의견</h2>
      <textarea id="cnote" placeholder="전체적인 느낌, 바꾸고 싶은 점 등을 자유롭게 적어 주세요" style="margin-top:8px">${esc(C.note[r.id] || '')}</textarea>
      <div class="radios" style="margin-top:12px">
        <label><input type="radio" name="intent" value="next" ${C.intent[r.id] === 'next' ? 'checked' : ''}>고른 안으로 다음 제안 받기</label>
        <label><input type="radio" name="intent" value="confirm" ${C.intent[r.id] === 'confirm' ? 'checked' : ''}>이 선택으로 확정하고 싶어요</label>
      </div></div>
      <div class="sticky-submit"><div class="row between">
        <span class="small">${total}안 선택${r.status === 'picked' ? ` · <span class="muted">${fmt(r.picked_at)} 제출함 (다시 제출 가능)</span>` : ''}${C.dirty[r.id] ? ' · <span class="accent">제출 전 변경 있음</span>' : ''}</span>
        <button class="btn primary" id="csubmit">${r.status === 'picked' ? '다시 제출' : '선택 결과 보내기'}</button></div></div>`;
  } else if (r.customer_note || r.intent) {
    h += `<div class="panel small"><b>보내신 의견</b> ${r.intent === 'confirm' ? '(확정 희망)' : r.intent === 'next' ? '(다음 제안 희망)' : ''}<div style="white-space:pre-wrap">${esc(r.customer_note)}</div></div>`;
  }
  return h;
}
function bindCustomer() {
  const d = C.data; const r = d.rounds.find(x => x.id === C.roundId);
  $('#creload') && ($('#creload').onclick = () => loadCustomer());
  $('#cconfirm') && ($('#cconfirm').onclick = async (e) => {
    e.target.disabled = true;
    try { await DB.confirmRequest(C.token); S.chan && S.chan.send({ kind: 'refresh' }); toast('확인했습니다. 감사합니다.'); await loadCustomer(); } catch (ex) { fail(ex); e.target.disabled = false; }
  });
  $$('.rtabs [data-rid]').forEach(b => b.onclick = () => { C.roundId = b.dataset.rid; drawCustomer(); });
  bindCustomerShoot();
  if (!r) return;
  $$('[data-zoom]').forEach(el => el.onclick = () => {
    const list = r.samples; const i = list.findIndex(s => s.id === el.dataset.zoom);
    openLightbox(list.map(s => ({ url: s.image_url, caption: sampleCaption(s) })), i);
  });
  $$('[data-pick]').forEach(b => b.onclick = () => {
    const P = C.picks[r.id]; const id = b.dataset.pick; P[id] = P[id] || { picked: false, comment: '' };
    P[id].picked = !P[id].picked; C.dirty[r.id] = true; drawCustomer();
  });
  $$('[data-cmt]').forEach(t => t.oninput = () => { C.picks[r.id][t.dataset.cmt].comment = t.value; C.dirty[r.id] = true; });
  $('#cnote') && ($('#cnote').oninput = e => { C.note[r.id] = e.target.value; C.dirty[r.id] = true; });
  $$('input[name=intent]').forEach(x => x.onchange = () => { C.intent[r.id] = x.value; C.dirty[r.id] = true; });
  $('#csubmit') && ($('#csubmit').onclick = async (e) => {
    const P = C.picks[r.id];
    const picks = r.samples.map(s => ({ id: s.id, picked: !!(P[s.id] && P[s.id].picked), comment: (P[s.id] && P[s.id].comment) || '' }));
    if (!picks.some(p => p.picked) && !confirm('선택한 안이 없습니다. 의견만 보낼까요?')) return;
    e.target.disabled = true; e.target.innerHTML = '<span class="spin"></span> 보내는 중';
    try {
      await DB.submitPicks(C.token, r.id, picks, C.note[r.id] || '', C.intent[r.id] || '');
      C.dirty[r.id] = false; S.chan && S.chan.send({ kind: 'refresh' });
      toast('선택 결과를 보냈습니다. 확인 후 연락드리겠습니다.', 3500); await loadCustomer();
    } catch (ex) { fail(ex); e.target.disabled = false; e.target.textContent = '선택 결과 보내기'; }
  });
}
