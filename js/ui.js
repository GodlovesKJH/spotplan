/* SPOTPLAN — 화면 공통 (상단 바 · 라이트박스 · 창) · 라우터 */
/* =====================================================================
   화면 공통
   ===================================================================== */
const app = $('#app');
const S = { me: null, list: [], filter: 'active', p: null, rounds: [], samples: [], logs: [], tab: 'request', roundId: null, chan: null, unwatch: null };
function closeChannels() { if (S.chan) { S.chan.close(); S.chan = null; } if (S.unwatch) { S.unwatch(); S.unwatch = null; } }

function topbar(kind) {
  const demo = DEMO ? '<span class="demo-badge" title="Supabase 연결 전: 이 브라우저 안에만 저장됩니다">시험 모드</span>' : '';
  if (kind === 'studio' && S.me && S.me.role === 'crew') {
    return `<header class="top"><div class="wrap">
      <a class="brand" href="#/studio">${logoSvg()}<b>${esc(BRAND)}</b><span>촬영팀</span></a><span class="ver" title="SPOTPLAN 앱 버전">${esc(APP_VERSION)}</span>
      <nav class="nav"><a href="#/studio" class="on">인계받은 촬영</a></nav>
      <span class="spacer"></span>${demo}<span class="small muted">${esc(S.me.name || S.me.email)}</span><button class="btn ghost sm" id="logout">로그아웃</button>
    </div></header>`;
  }
  if (kind === 'studio') {
    const h = location.hash;
    return `<header class="top"><div class="wrap">
      <a class="brand" href="#/studio">${logoSvg()}<b>${esc(BRAND)}</b><span>${esc(CFG.LABEL_STUDIO || '온라인 기획서')}</span></a><span class="ver" title="SPOTPLAN 앱 버전">${esc(APP_VERSION)}</span>
      <nav class="nav"><a href="#/studio" class="${h === '#/studio' || h.startsWith('#/studio/p') ? 'on' : ''}">요청 목록</a>
      ${S.me && S.me.role === 'admin' ? `<a href="#/studio/crew" class="${h.startsWith('#/studio/crew') ? 'on' : ''}">촬영팀</a><a href="#/studio/data" class="${h.startsWith('#/studio/data') ? 'on' : ''}">데이터 관리</a>` : ''}</nav>
      <span class="spacer"></span>${demo}
      ${S.me ? `<span class="small muted">${esc(S.me.name || S.me.email)}</span><button class="btn ghost sm" id="logout">로그아웃</button>` : ''}
    </div></header>`;
  }
  return `<header class="top"><div class="wrap narrow" style="max-width:${kind === 'customer' ? '1080px' : '640px'}">
    <span class="brand">${logoSvg()}<b>${esc(BRAND)}</b><span>${esc(CFG.LABEL_CUSTOMER || '고객 요청서')}</span></span><span class="spacer"></span>${demo}</div></header>`;
}
function bindTop() { const b = $('#logout'); if (b) b.onclick = async () => { await DB.signOut(); S.me = null; location.hash = '#/studio'; route(); }; }

/* 라이트박스 */
function openLightbox(list, idx) {
  let i = idx;
  const el = document.createElement('div'); el.className = 'lb';
  const draw = () => {
    const it = list[i];
    el.innerHTML = `<button class="x" aria-label="닫기">×</button>
      ${list.length > 1 ? '<button class="nav-l" aria-label="이전">‹</button><button class="nav-r" aria-label="다음">›</button>' : ''}
      <img src="${esc(it.url)}" alt=""><div class="cap">${it.caption || ''}</div>`;
    $('.x', el).onclick = close;
    if (list.length > 1) { $('.nav-l', el).onclick = e => { e.stopPropagation(); i = (i - 1 + list.length) % list.length; draw(); }; $('.nav-r', el).onclick = e => { e.stopPropagation(); i = (i + 1) % list.length; draw(); }; }
  };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft' && list.length > 1) { i = (i - 1 + list.length) % list.length; draw(); } if (e.key === 'ArrowRight' && list.length > 1) { i = (i + 1) % list.length; draw(); } };
  let sx = null;
  el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (sx == null || list.length < 2) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { i = (i + (dx < 0 ? 1 : -1) + list.length) % list.length; draw(); } sx = null; });
  el.addEventListener('click', e => { if (e.target === el) close(); });
  function close() { el.remove(); document.removeEventListener('keydown', key); }
  document.addEventListener('keydown', key);
  draw(); document.body.appendChild(el);
}
function sampleCaption(s) {
  return `<b>${esc(s.label)}</b> ${esc(s.title)}${s.kind === 'ai' ? ' · AI 생성 · 무드 참고용' : ''}${s.credit || s.source ? `<br>${esc(creditText(s))}` : ''}`;
}
function creditText(s) {
  if (s.kind === 'ai') return 'AI 생성 · 무드 참고용';
  if (s.source === 'Unsplash' || s.source === 'Pexels') return `Photo by ${s.credit} on ${s.source}`;
  return [s.credit, s.source].filter(Boolean).join(' · ');
}
function modal(html, wide = false, onClose = null) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  const key = e => { if (e.key === 'Escape') close(); };
  function close() { if (!bg.isConnected) return; bg.remove(); document.removeEventListener('keydown', key); if (onClose) onClose(); }
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(bg);
  return { el: $('.modal', bg), close };
}

/* =====================================================================
   라우터
   ===================================================================== */
async function route() {
  const q = new URLSearchParams(location.search);
  if (q.get('p')) return renderCustomer(q.get('p'));
  if (location.hash.startsWith('#/studio')) return renderStudio();
  closeChannels();
  return renderRequestForm();
}
window.addEventListener('hashchange', route);
