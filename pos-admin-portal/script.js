/* Hello Kaffi - POS & admin portal (shared by login / cashier / admin pages) */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Number(n).toFixed(2);
const CATS = ['Unlimited promos', 'Wings', 'Pasta', 'Rice Meals', 'Group Meals', 'Snacks & Sandwiches', 'Iced Coffee', 'Hot Coffee', 'Milkteas', 'Sodas & Drinks'];
/* Add-on rules: an "Add-on: ..." item is only sold with its matching unli promo.
   Matching is by item name, so renaming a promo in Admin means updating PROMO_319 / PROMO_349 here. */
const PROMO_319 = 'unli wings, drinks & rice', PROMO_349 = 'unli wings, pasta, drinks & rice';
const norm = v => String(v || '').trim().toLowerCase();
const isAddon = m => norm(m.name).startsWith('add-on');
const isRiceMeal = m => m.category === 'Rice Meals' && !isAddon(m);
const TAG_319 = { label: '₱319 promo', color: '#f59e0b' }, TAG_349 = { label: '₱349 promo', color: '#0ea5e9' }, TAG_RICE = { label: 'Rice meal', color: '#8b5cf6' };
const promoTag = m => norm(m.name) === PROMO_319 ? TAG_319 : norm(m.name) === PROMO_349 ? TAG_349 : null;   // colour of an unli promo
/* For an add-on: test = which sale items it belongs to (its qty can never exceed their total qty), tags = colour badges shown on it.
   Add-on stock is NOT used: the limit is the number of matching promo / rice meal orders in the sale. */
const addonRule = m => {
  const n = norm(m.name);
  if (!n.startsWith('add-on')) return null;
  if (n.includes('juice')) return { test: isRiceMeal, tags: [TAG_RICE], what: 'rice meal' };                                  // Add-on: Unli Juice -> 1 per rice meal order
  if (n.includes('pasta')) return { test: x => norm(x.name) === PROMO_319, tags: [TAG_319], what: '₱319 promo' };            // Unli Pasta & Fries -> 319 promo
  if (n.includes('fries')) return { test: x => norm(x.name) === PROMO_349, tags: [TAG_349], what: '₱349 promo' };            // Unli Fries -> 349 promo
  return { test: x => !!promoTag(x), tags: [TAG_319, TAG_349], what: 'unli promo' };                                          // Ribs & Sausage -> either promo
};
const page = document.body.dataset.page;
const S = JSON.parse(sessionStorage.getItem('hk_staff') || 'null');
let menu = [], orders = [];

/* small tags shown on order cards / tables: dine-in table, take-out, senior discount */
const svcTags = o => (o.service === 'dine-in' ? `<span class="svc dine">🍽 Table ${esc(o.table || '?')}</span>` : o.service === 'take-out' ? '<span class="svc take">🥡 Take-out</span>' : '')
  + (o.discount ? `<span class="svc senior" title="Senior ID ${esc(o.discount.idNumber || '')}">🧓 Senior −${peso(o.discount.amount)}</span>` : '');
async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(S ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  return d;
}
function toast(m) { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .15); } catch (e) {} }
function connect(onMsg) {
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ws?token=' + S.token);
  ws.onopen = () => { $('#live').textContent = 'Live'; $('#live').classList.add('on'); };
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => { $('#live').textContent = 'Reconnecting…'; $('#live').classList.remove('on'); setTimeout(() => connect(onMsg), 2000); };
}
function guard(role) {
  const loginPage = role + '-login.html';
  if (!S || S.user.role !== role) { location.href = loginPage; return false; }
  $('#who').textContent = S.user.name; $('#logout').onclick = () => { sessionStorage.removeItem('hk_staff'); location.href = loginPage; };
  return true;
}
const upsert = o => { const i = orders.findIndex(x => x.id === o.id); i < 0 ? orders.unshift(o) : orders[i] = o; };
const NEXT = { Pending: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };
const setStatus = (id, status) => api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
async function advance(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  try {
    let st = o.status;
    if (st === 'Pending') { await setStatus(id, 'Preparing'); st = 'Preparing'; }   // (online COD uses its own 'Mark as received' button)   // safety: accept first if it somehow is still Pending
    if (st === 'Ready' && o.type === 'delivery' && !o.dispatched) { await api(`/orders/${id}/dispatch`, { method: 'PATCH' }); return; }   // rider leaves with the order
    await setStatus(id, NEXT[st]);   // pickup: Completed | delivery that is out: Delivered (= Completed, frees the rider)
  } catch (e) { toast(e.message); }
}

/* ===== LOGIN ===== */
if (page === 'login') {
  $('#loginForm').onsubmit = async e => {
    e.preventDefault(); $('#err').textContent = '';
    try {
      const role = document.body.dataset.role;
      const s = await api('/auth/staff', { method: 'POST', body: { username: $('#username').value.trim(), password: $('#password').value, role } });
      sessionStorage.setItem('hk_staff', JSON.stringify(s)); location.href = role === 'admin' ? 'admin.html' : 'cashier.html';
    } catch (er) { $('#err').textContent = er.message; }
  };
}

/* ===== CASHIER ===== */
if (page === 'cashier' && guard('cashier')) {
  let cat = CATS[0], cart = {}, q = '';

  /* --- stock reminder popup (low / last one / not enough stock) --- */
  const LOW_STOCK = 10;   // same cut-off the tiles use for the red "low" count (fewer than 10 left)
  { const st = document.createElement('style');
    st.textContent = '#stockModal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:#3d2b2e66}#stockModal .box{background:#fff;border:2px solid #f6d3e0;border-radius:22px;padding:22px 24px;max-width:380px;width:100%;box-shadow:0 18px 40px #3d2b2e40}#stockModal h3{margin:0 0 8px;font-size:19px}#stockModal.out h3{color:#b91c1c}#stockModal.low h3{color:#c2410c}#stockModal p{margin:0 0 16px;color:#5a4448}#stockModal button{width:100%}';
    document.head.appendChild(st); }
  function stockPopup(kind, title, msg) {   // kind: 'low' | 'out'
    const old = document.getElementById('stockModal'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'stockModal'; el.className = kind; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="box"><h3>${esc(title)}</h3><p>${esc(msg)}</p><button type="button" class="btn big">OK</button></div>`;
    const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    el.querySelector('button').onclick = close; el.onclick = e => { if (e.target === el) close(); };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el); el.querySelector('button').focus();
  }
  const pos = $('#pos'), fresh = new Set();
  let riders = [], boardDirty = false;
  const render = () => { renderTabs(); renderTiles(); renderCart(); renderRiderBar(); renderBoard(); };

  /* --- auto-accept: a new order is already confirmed by the customer / cashier, so it goes straight to Preparing --- */
  const accepting = new Set();
  /* Online COD orders are NOT auto-accepted: they wait (status Pending) until the cashier presses "Mark as received".
     Until then the customer can still cancel. Once received -> Preparing, and cancelling is locked. */
  const isCodHold = o => o.status === 'Pending' && o.source === 'Online' && !/gcash/i.test(o.payment || '');
  async function autoAccept(list) {
    for (const o of list) {
      if (o.status !== 'Pending' || isCodHold(o) || accepting.has(o.id)) continue;
      accepting.add(o.id);
      try { await setStatus(o.id, 'Preparing'); } catch (e) { /* another cashier screen may have done it already */ }
      finally { accepting.delete(o.id); }
    }
  }

  /* --- screens (laptop shows all 3; tablet = Sell | Orders; phone = Menu | Sale | Orders) --- */
  function setPane(p) {
    pos.dataset.pane = p;
    $('#paneNav').querySelectorAll('button').forEach(b => {
      const k = b.dataset.pane, on = k === 'sell' ? p !== 'orders' : k === p;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', on);
    });
  }
  $('#paneNav').querySelectorAll('button').forEach(b => b.onclick = () => setPane(b.dataset.pane === 'sell' ? 'menu' : b.dataset.pane));
  setPane('menu');

  /* --- search: every word must match name or category; searches ALL categories --- */
  const matches = m => { const hay = (m.name + ' ' + m.category).toLowerCase(); return q.split(/\s+/).every(w => hay.includes(w)); };
  const srcQty = test => Object.keys(cart).reduce((t, id) => { const x = menu.find(y => y.id == id); return t + (x && test(x) ? cart[id] : 0); }, 0);   // how many matching promo / rice meal orders are in the sale
  const unlocked = m => { const r = addonRule(m); return !r || srcQty(r.test) > 0; };   // add-ons show only while something they belong to is in the sale
  const dots = m => { const t = promoTag(m) ? [promoTag(m)] : (addonRule(m) || { tags: [] }).tags; return t.map(g => `<i class="cdot" style="background:${g.color}" title="${esc(g.label)}"></i>`).join(''); };
  { const st = document.createElement('style');
    st.textContent = '.cdot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:baseline}.tpill{display:inline-block;font-size:11px;font-weight:700;color:#fff;border-radius:999px;padding:1px 9px;margin:3px 4px 0 0;line-height:1.5}';
    document.head.appendChild(st); }
  const current = () => (q ? menu.filter(matches) : menu.filter(m => m.category === cat)).filter(unlocked);
  const setQuery = v => { $('#search').value = v; q = v.trim().toLowerCase(); renderTabs(); renderTiles(); };
  $('#search').addEventListener('input', e => setQuery(e.target.value));
  $('#search').addEventListener('keydown', e => {
    if (e.key === 'Escape') setQuery('');
    if (e.key === 'Enter') { const r = current(); if (q && r.length === 1 && (r[0].stock || isAddon(r[0]))) { qty(r[0].id, 1); setQuery(''); } }
  });
  document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); } });

  function renderTabs() {
    $('#tabs').innerHTML = CATS.map(c => `<button class="${!q && c === cat ? 'active' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
    $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { cat = b.dataset.c; setQuery(''); });
  }
  function renderTiles() {
    const items = current();
    $('#menuGrid').innerHTML = items.length ? items.map(m => { const r = addonRule(m), pt = promoTag(m); return `<button class="tile ${cart[m.id] ? 'in-cart' : ''}" data-id="${m.id}" ${(m.stock || r) ? '' : 'disabled'} ${pt ? `style="border-left:6px solid ${pt.color}"` : ''}>${cart[m.id] ? `<span class="q">${cart[m.id]}</span>` : ''}<span class="tin">${q ? `<small class="cat">${esc(m.category)}</small>` : ''}<span class="nm">${esc(m.name)}</span>${r ? `<span>${r.tags.map(g => `<span class="tpill" style="background:${g.color}">for ${esc(g.label)}</span>`).join('')}</span>` : ''}<span class="row"><span class="p">${peso(m.price)}</span>${r ? '' : `<small class="stk ${m.stock < 10 ? 'low' : ''}">${m.stock ? m.stock + ' left' : 'Sold out'}</small>`}</span></span></button>`; }).join('')
      : `<p class="muted empty">${q ? 'No items match “' + esc($('#search').value.trim()) + '”.' : 'Nothing in this category.'}</p>`;
    $('#menuGrid').querySelectorAll('.tile').forEach(b => b.onclick = () => qty(+b.dataset.id, 1));
  }
  function qty(id, d) {
    const m = menu.find(x => x.id === id); if (!m) return;
    const r = addonRule(m), had = cart[id] || 0, want = had + d;
    if (r) {   // add-on: no stock, limited by the number of matching promo / rice meal orders in the sale
      const cap = srcQty(r.test), n = Math.max(0, Math.min(cap, want));
      n ? cart[id] = n : delete cart[id]; renderCart(); renderTiles();
      if (d > 0 && want > cap) stockPopup('out', 'Add-on limit', `Only ${cap} ${m.name} allowed: one per ${r.what} order in this sale.`);
      return;
    }
    const n = Math.max(0, Math.min(m.stock, want));
    n ? cart[id] = n : delete cart[id]; renderCart(); renderTiles();
    if (d > 0) {
      const left = m.stock - n, wasLeft = m.stock - had;
      if (want > m.stock) stockPopup('out', 'Not enough stock', `Only ${m.stock} ${m.name} in stock. Can't add more to this sale.`);
      else if (left === 0) stockPopup('out', 'Last stock', `That's all the ${m.name} we have. It will be sold out after this sale.`);
      else if (left < LOW_STOCK && (had === 0 || wasLeft >= LOW_STOCK)) stockPopup('low', 'Low stock', `Only ${left} ${m.name} left after this sale. Let the kitchen know.`);
    }
  }
  function renderCart() {
    const trimmed = [];   // items cut down because live stock changed (e.g. another cashier sold the last ones)
    for (const id of Object.keys(cart)) { const m = menu.find(x => x.id == id); if (!m) delete cart[id]; else if (isAddon(m)) continue; else if (!m.stock) { trimmed.push(`${m.name} is sold out and was removed`); delete cart[id]; } else if (cart[id] > m.stock) { trimmed.push(`${m.name} is down to ${m.stock}`); cart[id] = m.stock; } }
    if (trimmed.length) stockPopup('out', 'Stock changed', trimmed.join('. ') + '.');
    let addonCut = false;   // add-ons follow their promo / rice meal: removed with it, and never more than its quantity
    for (const id of Object.keys(cart)) { const r = addonRule(menu.find(x => x.id == id)); if (!r) continue; const cap = srcQty(r.test); if (cap === 0) { delete cart[id]; addonCut = true; } else if (cart[id] > cap) { cart[id] = cap; addonCut = true; } }
    if (addonCut) toast('Add-ons adjusted to match the promo / rice meal quantity.');
    const rows = Object.keys(cart).map(id => ({ m: menu.find(x => x.id == id), q: cart[id] }));
    const n = rows.reduce((s, r) => s + r.q, 0);
    const subtotal = rows.reduce((s, r) => s + r.m.price * r.q, 0), senior = $('#seniorOn').checked && subtotal > 0, p = senior ? seniorPricing(subtotal) : { discount: 0, total: subtotal };
    $('#discLines').hidden = !senior; $('#subTotal').textContent = peso(subtotal); $('#discAmt').textContent = '−' + peso(p.discount);
    $('#cartTotal').textContent = peso(p.total); $('#gAmt').textContent = peso(p.total);
    $('#saleBadge').textContent = n; $('#saleBadge').hidden = !n; $('#clearSale').disabled = !n;
    $('#cartItems').innerHTML = rows.length ? rows.map(r => `<div class="line"><span>${dots(r.m)}${esc(r.m.name)}</span><button data-id="${r.m.id}" data-d="-1" aria-label="Remove one">−</button><b>${r.q}</b><button data-id="${r.m.id}" data-d="1" aria-label="Add one">+</button><b class="amt">${peso(r.m.price * r.q)}</b></div>`).join('') : '<p class="muted">Tap items to start a sale.</p>';
    $('#cartItems').querySelectorAll('button').forEach(b => b.onclick = () => qty(+b.dataset.id, +b.dataset.d));
  }
  $('#clearSale').onclick = () => { cart = {}; renderCart(); renderTiles(); };
  /* senior discount: same maths as the server (the server recalculates and is the one that counts) */
  let cfg = { seniorRate: 0.2, seniorVatExempt: false, vatRate: 0.12 };
  const money = n => Math.round(n * 100) / 100;
  const seniorPricing = sub => { const total = money(cfg.seniorVatExempt ? sub / (1 + cfg.vatRate) * (1 - cfg.seniorRate) : sub * (1 - cfg.seniorRate)); return { total, discount: money(sub - total) }; };
  api('/config').then(c => { cfg = c; $('#seniorPct').textContent = Math.round(c.seniorRate * 100); renderCart(); }).catch(() => {});
  /* dine-in / take-out: the table number only exists for dine-in */
  const setService = v => {
    $('#service').value = v; $('#tableNo').hidden = v !== 'dine-in'; if (v !== 'dine-in') $('#tableNo').value = '';
    $('#svcChips').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x.dataset.v === v); x.setAttribute('aria-checked', x.dataset.v === v); });
  };
  $('#svcChips').querySelectorAll('button').forEach(b => b.onclick = () => { setService(b.dataset.v); if (b.dataset.v === 'dine-in') $('#tableNo').focus(); });
  $('#seniorOn').onchange = () => { $('#seniorFields').hidden = !$('#seniorOn').checked; if ($('#seniorOn').checked) $('#seniorId').focus(); else $('#seniorId').value = ''; renderCart(); };
  const resetSaleExtras = () => { $('#gcashRef').value = ''; $('#custName').value = ''; $('#tableNo').value = ''; $('#seniorOn').checked = false; $('#seniorId').value = ''; $('#seniorFields').hidden = true; setService('dine-in'); };
  $('#payChips').querySelectorAll('button').forEach(b => b.onclick = () => {
    $('#payment').value = b.dataset.v;
    $('#payChips').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    syncGcash(); if (b.dataset.v === 'GCash') $('#gcashRef').focus();
  });
  /* ---- GCash on the POS: pay-to box (QR, number, amount) like the customer page; the cashier enters the reference number ---- */
  const POS_GCASH = {   /* EDIT: same details as gcash.js on the customer page */
    name: 'Hello Kaffi', number: '0981 314 8038',
    qrFiles: ['/gcash.jpg', '/gcash-qr.png', '/gcash-qr.jpg', '/gcash-qr.jpeg', '/gcash-qr.webp', '/images/gcash.jpg', '/images/gcash-qr.png']   // served by the customer-portal folder
  };
  $('#gName').textContent = POS_GCASH.name; $('#gNum').textContent = POS_GCASH.number;
  const probeImg = url => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0 ? url : null); i.onerror = () => ok(null); i.src = url; });
  let qrTried = false;
  async function loadGcashQr() {
    if (qrTried) return; qrTried = true;
    let src = ''; for (const u of POS_GCASH.qrFiles) { if (await probeImg(u)) { src = u; break; } }
    $('#gQrLoading').hidden = true;
    if (!src) { $('#gNoQr').hidden = false; return; }
    $('#gQr').src = src; $('#gQr').hidden = false; $('#gSave').href = src; $('#gSave').hidden = false;
  }
  function syncGcash() {
    const on = $('#payment').value === 'GCash'; $('#gcashBox').hidden = !on;
    if (on) loadGcashQr(); else $('#gcashRef').value = '';
  }
  $('#gQr').onclick = () => { $('#gQr').classList.toggle('big'); };   // tap to enlarge so the customer can scan it
  $('#gCopy').onclick = async e => { const b = e.currentTarget; try { await navigator.clipboard.writeText(POS_GCASH.number.replace(/\s/g, '')); b.textContent = 'Copied!'; } catch (_) { b.textContent = 'Copy failed'; } setTimeout(() => (b.textContent = 'Copy number'), 1500); };

  function renderBoard() {
    const active = orders.filter(o => o.status !== 'Completed').length;
    $('#ordBadge').textContent = active; $('#ordBadge').hidden = !active;
    const hasDelivery = orders.some(o => o.type === 'delivery');
    const cols = [
      ['Payment check', o => o.status === 'Payment Review'],   // GCash orders wait here until the cashier checks the proof
      ...(orders.some(isCodHold) ? [['COD to receive', isCodHold]] : []),   // customer can still cancel here
      ['Preparing', o => o.status === 'Preparing' || (o.status === 'Pending' && !isCodHold(o))],   // Pending is shown as Preparing
      ['Ready', o => o.status === 'Ready' && !o.dispatched],
      ...(hasDelivery ? [['Out for delivery', o => o.status === 'Ready' && o.dispatched]] : [])
    ];
    // what the button on a card does
    // keep a dropdown open while the cashier is choosing a rider (re-render once they are done)
    const ae = document.activeElement;
    if (ae && ae.tagName === 'SELECT' && ae.closest('#board')) { boardDirty = true; return; }
    boardDirty = false;
    const riderPart = o => {
      if (o.type !== 'delivery' || isCodHold(o)) return '';   // rider is assigned only after the cashier marks a COD order received
      if (o.dispatched) return `<select class="assign" disabled aria-label="Rider for order ${o.id} (locked)"><option>${esc(o.riderName)}</option></select><div class="muted small">🔒 Rider is locked while the order is out for delivery.</div>`;
      const free = riders.some(r => r.onDuty && r.state === 'Free');
      const opts = riders.filter(r => r.onDuty && (r.state === 'Free' || r.orderId === o.id)).map(r => `<option value="${r.id}" ${o.riderId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
      return `<select class="assign" data-assign="${o.id}" aria-label="Assign rider to order ${o.id}"><option value="">${free || o.riderId ? '— Assign rider —' : 'No free rider right now'}</option>${opts}</select>`;
    };
    const action = o => {
      if (o.status !== 'Ready') return { label: 'Mark Ready' };
      if (o.type !== 'delivery') return { label: 'Mark Completed' };
      if (!o.riderId) return { label: 'Waiting for rider', off: true };
      return { label: o.dispatched ? 'Mark Delivered' : 'Out for delivery' };
    };
    $('#board').innerHTML = cols.map(([name, test]) => `<div class="col ${name.replace(/\s/g, '')}"><h4>${name} (${orders.filter(test).length})</h4>${orders.filter(test).map(o => { const a = action(o); return `
      <div class="ord ${fresh.has(o.id) ? 'fresh' : ''} ${isCodHold(o) ? 'cod' : ''}"><header><span>#${o.id}</span><span class="tag ${o.source === 'POS' ? 'pos' : ''}">${esc(o.source)} · ${esc(o.type)}</span></header>
      <div>${esc(o.customer)}${o.address ? ' · ' + esc(o.address) : ''}</div>
      ${svcTags(o) ? `<div class="svcs">${svcTags(o)}</div>` : ''}
      ${riderPart(o)}
      <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)}</li>`).join('')}</ul>${o.note ? `<em>${esc(o.note)}</em><br>` : ''}
      <b>${peso(o.total)}</b> <small>${esc(o.payment)}${o.source === 'POS' && o.gcashRef ? ' · Ref ' + esc(o.gcashRef) : ''}</small>
      ${isCodHold(o) ? `<div class="codnote">⏳ Customer can still cancel until you mark this received.</div><button class="btn" data-recv="${o.id}">Mark as received</button>` : o.status === 'Payment Review' ? `<button class="btn" data-proof="${o.id}">Check payment proof</button>` : `<button class="btn" data-adv="${o.id}" ${a.off ? 'disabled' : ''}>${a.label}</button>`}</div>`; }).join('') || '<p class="muted small">None</p>'}</div>`).join('');
    $('#board').querySelectorAll('[data-adv]').forEach(b => b.onclick = () => advance(+b.dataset.adv));
    $('#board').querySelectorAll('[data-recv]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await setStatus(+b.dataset.recv, 'Preparing'); toast('Order received, sent to kitchen'); }
      catch (e) { toast(e.message || 'Could not mark as received (the customer may have just cancelled)'); b.disabled = false; }
    });
    $('#board').querySelectorAll('[data-proof]').forEach(b => b.onclick = () => openProof(+b.dataset.proof));
    $('#board').querySelectorAll('[data-assign]').forEach(sel => sel.onchange = async () => {
      const cur = orders.find(x => x.id == sel.dataset.assign);
      if (cur && cur.dispatched) { toast('Rider is locked: order is already out for delivery'); boardDirty = true; sel.blur(); return; }
      try { await api(`/orders/${sel.dataset.assign}/rider`, { method: 'PATCH', body: { riderId: sel.value ? +sel.value : null } }); }
      catch (e) { toast(e.message); }
      boardDirty = true; sel.blur();
    });
  }
  /* --- GCash proof check: cashier must view the image, then verify it or reject it as fake --- */
  { const st = document.createElement('style');
    st.textContent = '#proofModal{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:#3d2b2e99}#proofModal .box{background:#fff;border-radius:20px;padding:18px;max-width:460px;width:100%;max-height:94vh;overflow:auto}#proofModal img{width:100%;max-height:55vh;object-fit:contain;background:#f6f1f1;border-radius:12px}#proofModal .acts{display:flex;gap:10px;margin-top:12px}#proofModal .acts button{flex:1}#proofModal .bad{background:#b91c1c;color:#fff}';
    document.head.appendChild(st); }
  async function openProof(id) {
    const o = orders.find(x => x.id === id); if (!o) return;
    let url;
    try {
      const r = await fetch(`/api/orders/${id}/proof`, { headers: { Authorization: 'Bearer ' + S.token } });
      if (!r.ok) throw new Error('No payment proof was uploaded for this order');
      url = URL.createObjectURL(await r.blob());
    } catch (e) { return toast(e.message); }
    const el = document.createElement('div'); el.id = 'proofModal';
    el.innerHTML = `<div class="box"><h3>Order #${o.id} · ${esc(o.customer)}</h3><p>Amount due: <b>${peso(o.total)}</b>${o.gcashRef ? ` · Ref: <b>${esc(o.gcashRef)}</b>` : ''}</p><img src="${url}" alt="GCash payment proof"><p class="muted small">Check the amount, the receiver and the reference number before confirming.</p><div class="acts"><button class="btn bad" data-d="reject">Fake / invalid</button><button class="btn" data-d="approve">Payment verified</button></div><button type="button" class="link" data-d="close" style="margin-top:8px">Close</button></div>`;
    const close = () => { URL.revokeObjectURL(url); el.remove(); };
    el.onclick = e => { if (e.target === el) close(); };
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
      const d = b.dataset.d; if (d === 'close') return close();
      if (d === 'reject' && !confirm('Reject this proof as fake? The order will be cancelled and the customer alerted.')) return;
      b.disabled = true;
      try { await api(`/orders/${id}/payment`, { method: 'PATCH', body: { decision: d } }); toast(d === 'approve' ? 'Payment verified, sent to kitchen' : 'Order cancelled: fake proof'); close(); }
      catch (e) { toast(e.message); b.disabled = false; }
    });
    document.body.appendChild(el);
  }

  /* FIX: clicking a button (e.g. "Mark Ready") while the rider dropdown still has focus blurs the dropdown, and the old
     focusout handler re-rendered the board right then, replacing the button before the click landed, so the click was lost.
     Now the re-render waits until the press is finished. */
  let pressing = false;
  const flushBoard = () => { pressing = false; const a = document.activeElement; if (boardDirty && !(a && a.tagName === 'SELECT' && a.closest('#board'))) renderBoard(); };
  $('#board').addEventListener('pointerdown', e => { if (e.target.closest('button')) pressing = true; });
  document.addEventListener('pointerup', () => { if (pressing) setTimeout(flushBoard, 350); });
  document.addEventListener('pointercancel', () => { if (pressing) setTimeout(flushBoard, 350); });
  $('#board').addEventListener('click', e => { if (e.target.closest('button')) setTimeout(flushBoard, 0); });
  $('#board').addEventListener('focusout', () => setTimeout(() => { if (boardDirty && !pressing) renderBoard(); }, 0));

  /* minimal rider list for the cashier: see who is free, confirm a rider is back (no add / edit / remove here) */
  function renderRiderBar() {
    const bar = $('#riderBar'); bar.hidden = !riders.length;
    bar.innerHTML = riders.map(r => `<div class="rchip"><b>${esc(r.name)}</b><span class="rstate ${r.state.toLowerCase().replace(/\s/g, '-')}">${esc(r.state)}${r.orderId ? ' #' + r.orderId : ''}</span>${r.state === 'Returning' ? `<button type="button" class="btn sm" data-ret="${r.id}">Rider returned</button>` : ''}</div>`).join('');
    bar.querySelectorAll('[data-ret]').forEach(b => b.onclick = async () => {
      try { riders = await api(`/riders/${b.dataset.ret}/returned`, { method: 'PATCH' }); renderRiderBar(); renderBoard(); toast('Rider is back'); } catch (e) { toast(e.message); }
    });
  }
  $('#charge').onclick = async () => {
    $('#err').textContent = '';
    const items = Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
    if (!items.length) return ($('#err').textContent = 'Add at least one item.');
    const service = $('#service').value, table = $('#tableNo').value.trim(), seniorOn = $('#seniorOn').checked, seniorId = $('#seniorId').value.trim();
    if (service === 'dine-in' && !table) { $('#tableNo').focus(); return ($('#err').textContent = 'Enter the table number for this dine-in order.'); }
    const gcashRef = $('#gcashRef').value.trim();
    if ($('#payment').value === 'GCash' && gcashRef.length < 4) { $('#gcashRef').focus(); return ($('#err').textContent = 'Enter the GCash reference number to confirm the payment.'); }
    if (seniorOn && seniorId.length < 4) { $('#seniorId').focus(); return ($('#err').textContent = 'Enter the senior citizen ID number to give the discount.'); }
    try {
      await api('/orders', { method: 'POST', body: { items, customer: $('#custName').value.trim() || 'Walk-in', payment: $('#payment').value, gcashRef: $('#payment').value === 'GCash' ? gcashRef : undefined, service, table: service === 'dine-in' ? table : '', senior: seniorOn ? { id: seniorId } : undefined } });
      cart = {}; resetSaleExtras(); renderCart(); renderTiles(); toast('Sale sent to kitchen');
      if (matchMedia('(max-width:699px)').matches) setPane('menu');
    } catch (e) { $('#err').textContent = e.message; }
  };
  (async () => {
    try { menu = await api('/menu'); orders = (await api('/orders')).filter(o => !['Completed', 'Cancelled'].includes(o.status)); riders = await api('/riders'); } catch (e) { return $('#logout').click(); }
    render(); autoAccept(orders);
    connect(m => {
      if (m.type === 'menu') { menu = m.menu; renderTiles(); renderCart(); }
      if (m.type === 'riders') { riders = m.riders; renderRiderBar(); renderBoard(); }
      if (m.type === 'order') {
        const prev = orders.find(x => x.id === m.order.id);
        if (prev && m.order.status === 'Cancelled' && m.order.cancelReason === 'customer') { beep(); toast(`Order #${m.order.id} was cancelled by the customer`); }
        upsert(m.order); orders = orders.filter(o => !['Completed', 'Cancelled'].includes(o.status)); autoAccept([m.order]);
        if (m.isNew && m.order.source === 'Online') { fresh.add(m.order.id); beep(); toast(`New online order #${m.order.id} from ${m.order.customer}`); setTimeout(() => { fresh.delete(m.order.id); renderBoard(); }, 4000); }
        renderBoard();
      }
    });
  })();
}

/* ===== ADMIN ===== */
if (page === 'admin' && guard('admin')) {
  $('#iCat').innerHTML = CATS.map(c => `<option>${esc(c)}</option>`).join('');
  /* Simple bar chart (no library). horizontal = labels on the left, bars grow right. */
  function barChart(el, data, horizontal, opts = {}) {
    const max = Math.max(1, ...data.map(d => d.value));
    el.className = 'bars ' + (horizontal ? 'h' : 'v');
    if (!data.length || data.every(d => !d.value)) { el.innerHTML = `<p class="muted chart-empty">${opts.empty || 'No sales yet today.'}</p>`; return; }
    el.innerHTML = data.map((d, i) => {
      const pct = d.value ? Math.max(3, Math.round(d.value / max * 100)) : 0, cls = d.cls || 'c' + (i % 4);
      return horizontal
        ? `<div class="bar-row"><span class="bar-label" title="${esc(d.label)}">${esc(d.label)}</span><span class="bar-track"><span class="bar-fill ${cls}" title="${esc(d.label)}: ${d.value}" style="width:${pct}%"></span></span><b class="bar-val">${d.value}</b></div>`
        : `<div class="bar-col"><b class="bar-val">${d.value}</b><span class="bar-track"><span class="bar-fill ${cls}" title="${esc(d.label)}: ${d.value}" style="height:${pct}%"></span></span><span class="bar-label ${d.today ? 'is-today' : ''}">${esc(d.label)}</span></div>`;
    }).join('');
  }
  /* ---- Stats cards + cancelled-orders analytics (computed from the order list, no extra server call) ---- */
  const DAY = 864e5, startOfDay = t => new Date(t).setHours(0, 0, 0, 0);
  const CANCEL_WHY = { customer: ['Cancelled by customer', 'x-amber'], fake_proof: ['Fake GCash proof', 'x-red'] };
  let sales = null, cancelRange = '7d';
  const statCard = (k, icon, label, value, sub) => `<div class="stat ${k}"><i aria-hidden="true">${icon}</i><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  function renderStats() {
    const t0 = startOfDay(Date.now()), today = orders.filter(o => o.createdAt >= t0), canc = today.filter(o => o.status === 'Cancelled').length;
    const rate = today.length ? Math.round(canc / today.length * 100) : 0, s = sales;
    $('#stats').innerHTML =
      statCard('k-rose', '💰', "Today's sales", s ? peso(s.revenue) : '—', 'Cancelled orders not counted') +
      statCard('k-sage', '🧾', 'Orders today', s ? s.count : '—', 'Completed and in progress') +
      statCard('k-amber', '🛵', 'Online / In-store', s ? `${s.online} / ${s.pos}` : '—', 'Orders by channel') +
      statCard('k-red', '🚫', 'Cancelled today', canc, today.length ? `${rate}% of today's orders` : 'No orders yet today');
  }
  function renderCancelled() {
    const t0 = startOfDay(Date.now()), from = cancelRange === 'today' ? t0 : cancelRange === '7d' ? t0 - 6 * DAY : 0;
    const inRange = orders.filter(o => o.createdAt >= from), canc = inRange.filter(o => o.status === 'Cancelled');
    const lost = canc.reduce((t, o) => t + o.total, 0), rate = inRange.length ? Math.round(canc.length / inRange.length * 100) : 0;
    $('#cancelSummary').innerHTML = `<div><b>${canc.length}</b><span>Cancelled orders</span></div><div><b>${rate}%</b><span>Cancel rate (of ${inRange.length} orders)</span></div><div><b>${peso(lost)}</b><span>Sales lost</span></div>`;
    document.querySelectorAll('#cancelRange button').forEach(b => b.classList.toggle('on', b.dataset.r === cancelRange));
    // cancelled orders per day, last 7 days (by the day the order was placed)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t0); d.setDate(d.getDate() - i); const a = d.getTime(), b = new Date(a); b.setDate(b.getDate() + 1);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate(), cls: 'x-red', today: i === 0,
        value: orders.filter(o => o.status === 'Cancelled' && o.createdAt >= a && o.createdAt < b.getTime()).length });
    }
    barChart($('#chartCancelDays'), days, false, { empty: 'No cancelled orders in the last 7 days 🎉' });
    // why they were cancelled (selected range)
    const why = {};
    canc.forEach(o => { const [label, cls] = CANCEL_WHY[o.cancelReason] || ['Other reason', 'x-grey']; (why[label] ||= { label, cls, value: 0 }).value++; });
    barChart($('#chartCancelWhy'), Object.values(why).sort((x, y) => y.value - x.value), true, { empty: 'No cancelled orders in this period 🎉' });
  }
  document.querySelectorAll('#cancelRange button').forEach(b => b.onclick = () => { cancelRange = b.dataset.r; renderCancelled(); });
  async function loadStats() {
    try { sales = await api('/sales'); } catch (e) {}
    renderStats(); renderCancelled();
    barChart($('#chartTop'), ((sales && sales.top) || []).map(t => ({ label: t[0], value: t[1] })), true);
    barChart($('#chartChannel'), [{ label: 'Online', value: sales ? sales.online : 0 }, { label: 'In-store', value: sales ? sales.pos : 0 }], false);
  }
  /* ---- Long item lists: short orders show a plain list; longer ones collapse to a summary you can expand ---- */
  const openItems = new Set();   // remember which orders the admin expanded, so live updates do not close them
  const itemsBlock = o => {
    const kinds = o.items.length, pcs = o.items.reduce((t, i) => t + i.qty, 0);
    const rows = o.items.map(i => `<li><b>${i.qty}×</b><span>${esc(i.name)}</span></li>`).join('');
    if (kinds <= 3) return `<ul class="itemlist">${rows}</ul>`;
    const peek = o.items.slice(0, 2).map(i => `${i.qty}× ${esc(i.name)}`).join(', ');
    return `<details class="items" data-oid="${o.id}" ${openItems.has(o.id) ? 'open' : ''}><summary><span class="ic">${kinds} items · ${pcs} pcs</span><span class="peek">${peek}, +${kinds - 2} more</span></summary><ul class="itemlist scrolly">${rows}</ul></details>`;
  };
  document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.items[data-oid]')) { d.open ? openItems.add(+d.dataset.oid) : openItems.delete(+d.dataset.oid); } }, true);
  const stCls = st => 'st-' + String(st).toLowerCase().replace(/[^a-z]+/g, '-');
  const codWait = o => o.status === 'Pending' && o.source === 'Online' && !/gcash/i.test(o.payment || '');   // COD waiting for the cashier's "Mark as received"
  function renderMenu() {
    $('#menuTable').innerHTML = '<tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>' + menu.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.category)}</td><td>${peso(m.price)}</td><td class="${m.stock < 10 ? 'low' : ''}">${m.stock}</td><td><button class="btn ghost" data-e="${m.id}">Edit</button><button class="btn ghost" data-x="${m.id}">Delete</button></td></tr>`).join('');
    $('#menuTable').querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
      const m = menu.find(x => x.id == b.dataset.e);
      $('#itemId').value = m.id; $('#iName').value = m.name; $('#iCat').value = m.category; $('#iPrice').value = m.price; $('#iStock').value = m.stock;
      $('#formTitle').textContent = 'Edit menu item'; $('#cancelEdit').hidden = false; $('#iName').focus();
    });
    $('#menuTable').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      const m = menu.find(x => x.id == b.dataset.x);
      if (confirm(`Delete "${m.name}"?`)) try { menu = await api('/menu/' + m.id, { method: 'DELETE' }); renderMenu(); toast('Item deleted'); } catch (e) { toast(e.message); }
    });
  }
  /* ---- Delivery riders (admin assigns, cashier sends out) ---- */
  let riders = [];
  const riderPill = r => `<span class="rstate ${r.state.toLowerCase().replace(/\s/g, '-')}">${esc(r.state)}${r.orderId ? ' #' + r.orderId : ''}</span>`;
  function renderRiders() {
    const onDuty = riders.filter(r => r.onDuty), free = riders.filter(r => r.state === 'Free');
    $('#riderSummary').textContent = riders.length ? `${free.length} free · ${onDuty.length} on duty · ${riders.length} total` : '';
    $('#riderList').innerHTML = riders.length ? riders.map(r => `<div class="rider ${r.onDuty ? '' : 'off'}"><div class="rhead"><b>${esc(r.name)}</b>${riderPill(r)}</div><div class="muted small">${esc(r.phone) || 'No phone number yet'}</div><div class="ractions">${r.state === 'Returning' ? `<button type="button" class="btn sm" data-ret="${r.id}">Rider returned</button>` : ''}<button type="button" class="btn ghost sm" data-duty="${r.id}">${r.onDuty ? 'Go off duty' : 'Go on duty'}</button><button type="button" class="btn ghost sm" data-re="${r.id}">Edit</button><button type="button" class="btn ghost sm" data-rx="${r.id}">Remove</button></div></div>`).join('') : '<p class="muted">No riders yet. Add one below.</p>';
    $('#riderList').querySelectorAll('[data-duty]').forEach(b => b.onclick = async () => {
      const r = riders.find(x => x.id == b.dataset.duty);
      try { riders = await api('/riders/' + r.id, { method: 'PUT', body: { onDuty: !r.onDuty } }); renderRiders(); renderDeliveries(); } catch (e) { toast(e.message); }
    });
    $('#riderList').querySelectorAll('[data-ret]').forEach(b => b.onclick = async () => {
      try { riders = await api(`/riders/${b.dataset.ret}/returned`, { method: 'PATCH' }); renderRiders(); renderDeliveries(); toast('Rider is back'); } catch (e) { toast(e.message); }
    });
    $('#riderList').querySelectorAll('[data-re]').forEach(b => b.onclick = () => {
      const r = riders.find(x => x.id == b.dataset.re);
      $('#rId').value = r.id; $('#rName').value = r.name; $('#rPhone').value = r.phone; $('#rSave').textContent = 'Save rider'; $('#rCancel').hidden = false; $('#rName').focus();
    });
    $('#riderList').querySelectorAll('[data-rx]').forEach(b => b.onclick = async () => {
      const r = riders.find(x => x.id == b.dataset.rx);
      if (confirm(`Remove ${r.name}?`)) try { riders = await api('/riders/' + r.id, { method: 'DELETE' }); renderRiders(); renderDeliveries(); toast('Rider removed'); } catch (e) { toast(e.message); }
    });
  }
  function renderDeliveries() {
    const list = orders.filter(o => o.type === 'delivery' && o.status !== 'Completed' && o.status !== 'Cancelled');
    $('#deliveryList').innerHTML = list.length ? list.map(o => {
      const opts = riders.filter(r => r.onDuty && (r.state === 'Free' || r.orderId === o.id)).map(r => `<option value="${r.id}" ${o.riderId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
      const wait = codWait(o), stage = o.dispatched ? 'Out for delivery' : wait ? 'COD · awaiting cashier' : o.status === 'Pending' ? 'Preparing' : o.status;
      const off = o.dispatched || wait;
      return `<div class="delivery"><div class="dhead"><b>#${o.id}</b><span class="stbadge ${stCls(o.dispatched ? 'Out for delivery' : wait ? 'Pending' : o.status)}">${esc(stage)}</span><span class="dtotal">${peso(o.total)}</span></div><div class="dwho">👤 ${esc(o.customer)}</div><div class="muted small">📍 ${esc(o.address)}</div>${itemsBlock(o)}<select data-assign="${o.id}" ${off ? 'disabled' : ''} aria-label="Assign rider to order ${o.id}"><option value="">${riders.some(r => r.onDuty && r.state === 'Free') || o.riderId ? '— Assign rider —' : 'No free rider right now'}</option>${opts}</select>${o.dispatched ? '<div class="muted small">Rider is locked while the order is out for delivery.</div>' : ''}${wait ? '<div class="muted small">⏳ Cash on delivery: the cashier must mark it received first. The customer can still cancel.</div>' : ''}</div>`;
    }).join('') : '<p class="muted">No active delivery orders.</p>';
    $('#deliveryList').querySelectorAll('[data-assign]').forEach(sel => sel.onchange = async () => {
      const cur = orders.find(x => x.id == sel.dataset.assign);
      if (cur && cur.dispatched) { toast('Rider is locked: order is already out for delivery'); renderDeliveries(); return; }
      try { await api(`/orders/${sel.dataset.assign}/rider`, { method: 'PATCH', body: { riderId: sel.value ? +sel.value : null } }); }
      catch (e) { toast(e.message); renderDeliveries(); }
    });
  }
  const riderReset = () => { $('#riderForm').reset(); $('#rId').value = ''; $('#rSave').textContent = 'Add rider'; $('#rCancel').hidden = true; };
  $('#rCancel').onclick = riderReset;
  $('#riderForm').onsubmit = async e => {
    e.preventDefault(); $('#rErr').textContent = '';
    const id = $('#rId').value, body = { name: $('#rName').value, phone: $('#rPhone').value };
    try { riders = await api(id ? '/riders/' + id : '/riders', { method: id ? 'PUT' : 'POST', body }); renderRiders(); renderDeliveries(); riderReset(); toast('Rider saved'); }
    catch (er) { $('#rErr').textContent = er.message; }
  };

  const WHY_SHORT = { customer: 'by customer', fake_proof: 'fake GCash proof' };
  const statusCell = o => { const label = o.dispatched && o.status === 'Ready' ? 'Out for delivery' : o.status;
    return `<span class="stbadge ${stCls(label)}">${esc(label)}</span>${o.status === 'Cancelled' && WHY_SHORT[o.cancelReason] ? `<div class="muted small">${WHY_SHORT[o.cancelReason]}</div>` : ''}`; };
  function renderOrders() {
    $('#orderTable').innerHTML = '<tr><th>#</th><th>Source</th><th>Customer</th><th>Items</th><th>Total</th><th>Rider</th><th>Status</th></tr>' + orders.slice(0, 30).map(o => `<tr><td>${o.id}</td><td>${esc(o.source)} · ${esc(o.type)}</td><td>${esc(o.customer)}${svcTags(o) ? `<div class="svcs">${svcTags(o)}</div>` : ''}</td><td>${itemsBlock(o)}</td><td>${peso(o.total)}</td><td>${o.type === 'delivery' ? esc(o.riderName || 'Unassigned') : '—'}</td><td>${statusCell(o)}</td></tr>`).join('');
  }
  /* ---- Sales report: export to CSV (opens neatly in Excel) and import it back later ----
     One row per item sold, so Excel can filter / pivot it. Order-level columns repeat on every row of an order
     (Order Total only on the first row, so a SUM does not double count). The same file can be imported again. */
  const CSV_COLS = ['Order ID', 'Date', 'Time', 'Channel', 'Order Type', 'Service', 'Table', 'Customer', 'Email', 'Payment', 'GCash Ref', 'Status', 'Cancel Reason', 'Address', 'Rider', 'Note', 'Item', 'Qty', 'Unit Price', 'Line Total', 'Subtotal', 'Discount', 'Senior ID', 'Order Total', 'Item ID', 'Created At (ms)'];
  const pad2 = n => String(n).padStart(2, '0');
  const dStr = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const tStr = t => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
  const safeText = v => { v = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };   // stops Excel treating text as a formula
  const asText = v => (v === '' || v == null ? '' : `="${String(v).replace(/"/g, '')}"`);                     // long numbers stay exact (no 1.2E+12)
  const csvCell = v => { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const reportMsg = (m, bad) => { const el = $('#reportMsg'); el.textContent = m || ''; el.classList.toggle('bad', !!bad); };

  async function exportCsv() {
    const fromV = $('#expFrom').value, toV = $('#expTo').value;
    const from = fromV ? new Date(fromV + 'T00:00:00').getTime() : 0, to = toV ? new Date(toV + 'T23:59:59.999').getTime() : Infinity;
    const inRange = orders.filter(o => o.createdAt >= from && o.createdAt <= to);
    const list = inRange.filter(o => ['Completed', 'Cancelled'].includes(o.status)).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);   // finished orders only
    const open = inRange.length - list.length, clear = $('#expClear').checked;
    if (!list.length) return reportMsg(open ? 'Only orders still in progress are in that range. Finish them first.' : 'No orders in that date range.', true);
    if (clear && !confirm(`Export ${list.length} finished orders to the Sales-Report folder and REMOVE them from the admin sales?\n\nThe file keeps every order. Use "Import selected" any time to bring them back.`)) return;
    const lines = [CSV_COLS.map(csvCell).join(',')];
    list.forEach(o => o.items.forEach((i, k) => lines.push([
      o.id, dStr(o.createdAt), tStr(o.createdAt), o.source, o.type, o.service || '', safeText(o.table), safeText(o.customer), safeText(o.email), safeText(o.payment), asText(o.gcashRef),
      o.status, o.cancelReason || '', safeText(o.address), safeText(o.riderName), safeText(o.note), safeText(i.name), i.qty,
      Number(i.price).toFixed(2), (i.price * i.qty).toFixed(2), k === 0 ? Number(o.subtotal != null ? o.subtotal : o.items.reduce((t, x) => t + x.price * x.qty, 0)).toFixed(2) : '',
      k === 0 && o.discount ? Number(o.discount.amount).toFixed(2) : '', k === 0 && o.discount ? asText(o.discount.idNumber) : '', k === 0 ? Number(o.total).toFixed(2) : '', i.id == null ? '' : i.id, asText(o.createdAt)
    ].map(csvCell).join(','))));
    $('#expBtn').disabled = true;
    try {   // the server saves it straight into the Sales-Report folder (nothing is downloaded to the browser's Downloads)
      const r = await api('/reports/save', { method: 'POST', body: { csv: lines.join('\r\n') + '\r\n', archiveIds: clear ? list.map(o => o.id) : undefined, label: fromV || toV ? `${fromV || 'start'}_to_${toV || 'today'}` : '' } });
      if (r.removed) { orders = await api('/orders'); renderOrders(); renderDeliveries(); loadStats(); }   // they are in the file now, so they leave the sales
      reportMsg(`Saved ${list.length} orders to ${r.folder}/${r.name}.` + (r.removed ? ` ${r.removed} orders were removed from the sales (import the file to bring them back).` : '') + (open ? ` ${open} order${open === 1 ? '' : 's'} still in progress stayed.` : ''));
      toast(r.removed ? 'Exported and cleared from sales' : 'Sales report saved'); loadReportFiles(r.name);
    } catch (e) { reportMsg(e.message || 'Could not save the report.', true); }
    finally { $('#expBtn').disabled = false; }
  }
  /* files that are in the Sales-Report folder (the only place imports can come from) */
  async function loadReportFiles(select) {
    const sel = $('#impSelect');
    try {
      const r = await api('/reports');
      sel.innerHTML = r.files.length ? r.files.map(f => `<option value="${esc(f.name)}">${esc(f.name)} · ${new Date(f.modified).toLocaleString()}</option>`).join('') : '<option value="">No reports in the Sales-Report folder yet</option>';
      if (select) sel.value = select;
      $('#impBtn').disabled = !r.files.length;
    } catch (e) { sel.innerHTML = '<option value="">Could not read the Sales-Report folder</option>'; $('#impBtn').disabled = true; }
  }

  function parseCsv(text) {
    text = text.replace(/^\ufeff/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const count = ch => first.split(ch).length - 1;
    const delim = [',', ';', '\t'].sort((x, y) => count(y) - count(x))[0];   // Excel in some regions saves with ; instead of ,
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f === '') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  const cellOf = v => { v = String(v == null ? '' : v).trim(); const m = /^="(.*)"$/.exec(v); return m ? m[1] : v; };
  const textOf = v => { v = cellOf(v); return /^'[=+\-@]/.test(v) ? v.slice(1) : v; };
  const numOf = v => {
    v = cellOf(v).replace(/[₱\s]/g, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, '');   // 1,250.00
    else if (/,/.test(v) && !/\./.test(v)) v = v.replace(',', '.');      // 12,5 (comma decimal)
    else v = v.replace(/,/g, '');
    const n = parseFloat(v); return Number.isFinite(n) ? n : 0;
  };
  function whenOf(dateS, timeS) {
    dateS = cellOf(dateS); timeS = cellOf(timeS); let y, m, d, a;
    if ((a = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateS))) { y = +a[1]; m = +a[2]; d = +a[3]; }
    else if ((a = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(dateS))) { const p = +a[1], r = +a[2]; y = +a[3] < 100 ? 2000 + +a[3] : +a[3]; if (p > 12) { d = p; m = r; } else { m = p; d = r; } }
    else return 0;
    let h = 0, mi = 0, sec = 0; const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(timeS);
    if (t) { h = +t[1]; mi = +t[2]; sec = +(t[3] || 0); if (t[4]) { const pm = /pm/i.test(t[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } }
    return new Date(y, m - 1, d, h, mi, sec).getTime();
  }
  function rowsToOrders(rows) {
    if (!rows.length) throw new Error('The file is empty.');
    const head = rows[0].map(h => cellOf(h).toLowerCase()), ix = n => head.indexOf(n.toLowerCase());
    if (['order id', 'item', 'qty'].some(n => ix(n) < 0)) throw new Error('This is not a Hello Kaffi sales export (the Order ID, Item and Qty columns are missing).');
    const groups = new Map();
    rows.slice(1).forEach(r => {
      if (r.every(c => !String(c).trim())) return;
      const g = n => (ix(n) < 0 ? '' : r[ix(n)]);
      const id = Math.floor(numOf(g('Order ID'))), msRaw = cellOf(g('Created At (ms)'));
      let ms = /^\d{10,}$/.test(msRaw) ? +msRaw : 0;   // an Excel-mangled value like 1.79E+12 is ignored; Date + Time are used instead
      if (!ms) ms = whenOf(g('Date'), g('Time'));
      const key = id + '|' + ms;
      let o = groups.get(key);
      if (!o) groups.set(key, o = { id, createdAt: ms, source: textOf(g('Channel')), type: textOf(g('Order Type')), service: textOf(g('Service')), table: textOf(g('Table')), customer: textOf(g('Customer')), email: textOf(g('Email')),
        payment: textOf(g('Payment')), gcashRef: textOf(g('GCash Ref')), status: textOf(g('Status')), cancelReason: textOf(g('Cancel Reason')), address: textOf(g('Address')),
        riderName: textOf(g('Rider')), note: textOf(g('Note')), items: [], total: 0, sum: 0, subtotal: 0, discountAmount: 0, seniorId: '' });
      const qty = Math.floor(numOf(g('Qty'))), line = numOf(g('Line Total')), price = numOf(g('Unit Price')) || (qty ? line / qty : 0);
      o.items.push({ id: Math.floor(numOf(g('Item ID'))), name: textOf(g('Item')), price, qty }); o.sum += line || price * qty;
      const t = numOf(g('Order Total')); if (t) o.total = t;
      const sb = numOf(g('Subtotal')); if (sb) o.subtotal = sb;
      const dc = numOf(g('Discount')); if (dc) { o.discountAmount = dc; o.seniorId = textOf(g('Senior ID')); }
    });
    return [...groups.values()].map(({ discountAmount, seniorId, ...o }) => ({ ...o, total: o.total || o.sum, discount: discountAmount ? { amount: discountAmount, idNumber: seniorId } : null }));
  }
  async function importCsv(name) {
    reportMsg('');
    if (!name) return reportMsg('Choose a file from the Sales-Report folder first.', true);
    $('#impBtn').disabled = true;
    try {
      const resp = await fetch('/api/reports/' + encodeURIComponent(name), { headers: { Authorization: 'Bearer ' + S.token } });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || 'Could not read that file.');
      const text = await resp.text();
      if (text.includes('\ufffd')) reportMsg('Some characters look garbled. Save the file in Excel as "CSV UTF-8" next time.', true);
      const list = rowsToOrders(parseCsv(text));
      if (!list.length) throw new Error('No orders found in the file.');
      const times = list.map(o => o.createdAt).filter(Boolean).sort((a, b) => a - b);
      const range = times.length ? ` from ${dStr(times[0])} to ${dStr(times[times.length - 1])}` : '';
      if (!confirm(`Import ${list.length} orders${range} from\n${name}?\n\nOrders already in the system are skipped, so nothing is counted twice. Only finished (Completed / Cancelled) orders are imported.`)) return;
      const r = await api('/orders/import', { method: 'POST', body: { orders: list } });
      orders = await api('/orders'); renderOrders(); renderDeliveries(); loadStats();
      const bits = [`${r.added} imported`]; if (r.duplicates) bits.push(`${r.duplicates} already existed`); if (r.renumbered) bits.push(`${r.renumbered} got a new order number`); if (r.skipped) bits.push(`${r.skipped} skipped (in progress or unreadable)`);
      reportMsg('Done: ' + bits.join(', ') + '.'); toast('Sales report imported');
    } catch (e) { reportMsg(e.message || 'Import failed.', true); }
    finally { $('#impBtn').disabled = !$('#impSelect').value; }
  }
  $('#expBtn').onclick = exportCsv;
  $('#impBtn').onclick = () => importCsv($('#impSelect').value);
  $('#refreshFiles').onclick = () => { loadReportFiles(); reportMsg(''); };
  loadReportFiles();
  const reset = () => { $('#itemForm').reset(); $('#itemId').value = ''; $('#formTitle').textContent = 'Add menu item'; $('#cancelEdit').hidden = true; };
  $('#cancelEdit').onclick = reset;
  $('#itemForm').onsubmit = async e => {
    e.preventDefault(); $('#err').textContent = '';
    const body = { name: $('#iName').value, category: $('#iCat').value, price: $('#iPrice').value, stock: $('#iStock').value }, id = $('#itemId').value;
    try { menu = await api(id ? '/menu/' + id : '/menu', { method: id ? 'PUT' : 'POST', body }); renderMenu(); reset(); toast('Menu saved'); }
    catch (er) { $('#err').textContent = er.message; }
  };
  (async () => {
    try { menu = await api('/menu'); orders = await api('/orders'); riders = await api('/riders'); } catch (e) { return $('#logout').click(); }
    renderMenu(); renderOrders(); renderRiders(); renderDeliveries(); loadStats();
    connect(m => {
      if (m.type === 'menu') { menu = m.menu; renderMenu(); }
      if (m.type === 'order') { upsert(m.order); renderOrders(); renderDeliveries(); loadStats(); }
      if (m.type === 'riders') { riders = m.riders; renderRiders(); renderDeliveries(); }
    });
  })();
}