/* ===== EDIT THIS BLOCK: Hello Kaffi's own GCash details ===== */
const GCASH = {
  name:   'Hello Kaffi',
  number: '0981 314 8038',          // your real GCash number
  qrFile: 'gcash.jpg',             // QR image saved in the customer-portal (served) folder
  qrData: ''                        // OPTIONAL bulletproof mode: paste a data:image/png;base64,... string here
};

/* Hello Kaffi - customer page add-on (menu.html). Load AFTER script.js.
   1) Terms checkbox gates "Continue with Google"
   2) COD disabled above PHP 500 for delivery (Terms section 5)
   3) GCash pay-to box (QR, number, amount) + proof upload, sent with the order
   4) Alert when an order is cancelled because of a fake proof */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const COD_LIMIT = 500;
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };

  /* ================= 1. Terms gate on login ================= */
  const agree = $('#agreeTerms'), gbtn = $('#googleBtn'), terr = $('#termsErr');
  if (agree && gbtn) {
    /* layout fix: checkbox + "I have read the Terms and Conditions" on ONE centered line */
    const row = agree.closest('label') || agree.parentElement;
    const st = document.createElement('style');
    st.textContent = `
      #${row.id || (row.id = 'termsRow')}{display:flex !important;flex-flow:row nowrap !important;justify-content:center !important;
        align-items:center !important;gap:8px !important;width:100% !important;margin:12px 0 !important;text-align:center !important}
      #${row.id} > *{flex:0 0 auto !important;width:auto !important;max-width:none !important;margin:0 !important;white-space:nowrap}
      #${row.id} input[type="checkbox"]{width:18px !important;height:18px !important;cursor:pointer}
      #termsErr{text-align:center}`;
    document.head.appendChild(st);
    gbtn.disabled = !agree.checked;
    agree.addEventListener('change', () => { gbtn.disabled = !agree.checked; if (terr) terr.textContent = ''; });
    document.addEventListener('click', e => {               // capture phase: runs before script.js
      if (e.target.closest('#googleBtn') && !agree.checked) {
        e.stopImmediatePropagation(); e.preventDefault();
        if (terr) terr.textContent = 'Please tick "I have read the Terms and Conditions" first.';
      }
    }, true);
  }

  /* ================= 2 + 3. Checkout ================= */
  const pay = $('#payment'), box = $('#proofBox'), file = $('#proof'), prev = $('#proofPreview'),
        ref = $('#gcashRef'), err = $('#err'), addr = $('#address'), totalEl = $('#cartTotal');
  let proofData = '';

  const isGcash = () => !!pay && pay.value === 'GCash';
  const mode    = () => document.querySelector('input[name="otype"]:checked')?.value || 'pickup';
  const showErr = m => { if (err) err.textContent = m; };
  const total   = () => parseFloat((totalEl?.textContent || '').replace(/[^\d.]/g, '')) || 0;

  /* ---------- QR finder: tries many likely paths in parallel, uses the first that loads ---------- */
  const QR_BASES   = [...new Set([GCASH.qrFile, 'gcash-qr.png', 'gcash-qr.jpg', 'gcash-qr.jpeg', 'gcash-qr.webp', 'gcash-qr.png.png'])];
  const QR_FOLDERS = ['', '/', 'images/', '/images/', 'assets/', '/assets/', 'public/', '/public/'];
  const QR_PATHS   = [...new Set(QR_FOLDERS.flatMap(f => QR_BASES.map(b => (/^(\/|https?:|data:)/.test(b) ? b : f + b))))];

  const probe = url => new Promise(ok => {
    const i = new Image();
    i.onload  = () => ok(i.naturalWidth > 0 ? url : null);
    i.onerror = () => ok(null);
    i.src = url + (url.startsWith('data:') ? '' : (url.includes('?') ? '&' : '?') + 'v=' + Date.now()); // bypass cached failures
  });

  async function findQr() {
    if (GCASH.qrData) return GCASH.qrData;
    // 1) fast path: the file you configured (no 404 spam when it exists)
    for (const u of [GCASH.qrFile, '/' + GCASH.qrFile.replace(/^\//, '')]) {
      if (await probe(u)) return u;
    }
    // 2) fallback: search other likely names/folders
    const hits = await Promise.all(QR_PATHS.map(probe));
    const found = hits.find(Boolean) || '';
    if (found) console.info('[Hello Kaffi] GCash QR found at:', found, '- set GCASH.qrFile to this');
    else console.warn('[Hello Kaffi] GCash QR not found. Set GCASH.qrFile to the right file name. Tried:', QR_PATHS);
    return found;
  }

  /* ---------- GCash pay-to box ---------- */
  const setAmt = () => { const a = $('#gcashAmt'); if (a) a.textContent = '₱' + total().toFixed(2); };

  if (box) {
    const info = document.createElement('div');
    info.style.cssText = 'text-align:center;background:#fff;border:2px dashed #f6a5c4;border-radius:16px;padding:14px;margin-bottom:10px';
    info.innerHTML = `
      <p style="margin:0 0 8px;font-weight:600">Pay to Hello Kaffi GCash</p>
      <p id="gcashQrLoading" class="small" style="margin:0 0 8px">Loading QR code…</p>
      <img id="gcashQr" hidden alt="Hello Kaffi GCash QR code" style="width:200px;max-width:100%;border-radius:12px;cursor:zoom-in">
      <p id="gcashNoQr" hidden class="small">QR code not available. Please use the number below.</p>
      <p style="margin:8px 0 0"><b>${GCASH.name}</b></p>
      <p style="margin:2px 0 8px;font-size:18px;letter-spacing:.5px"><b id="gcashNum">${GCASH.number}</b></p>
      <p style="margin:0 0 8px">Amount to send: <b id="gcashAmt"></b></p>
      <button type="button" id="copyGcash" class="link">Copy number</button>
      <span id="saveSep"> · </span><a id="saveQr" download="hello-kaffi-gcash-qr" class="link">Save QR</a>`;
    box.prepend(info);

    const qr = info.querySelector('#gcashQr'), loading = info.querySelector('#gcashQrLoading'),
          noQr = info.querySelector('#gcashNoQr'), save = info.querySelector('#saveQr'), sep = info.querySelector('#saveSep');
    save.hidden = sep.hidden = true;

    findQr().then(src => {
      loading.hidden = true;
      if (!src) { noQr.hidden = false; return; }
      qr.src = src; qr.hidden = false;
      save.href = src; save.hidden = sep.hidden = false;
    });

    qr.onclick = () => { qr.style.width = qr.style.width === '300px' ? '200px' : '300px'; };   // tap to enlarge for scanning
    info.querySelector('#copyGcash').onclick = async e => {
      const b = e.currentTarget;
      try {
        await navigator.clipboard.writeText(GCASH.number.replace(/\s/g, ''));
        b.textContent = 'Copied!'; setTimeout(() => (b.textContent = 'Copy number'), 1500);
      } catch (_) { b.textContent = 'Copy failed'; setTimeout(() => (b.textContent = 'Copy number'), 1500); }
    };
  }

  function syncPay() { if (box) box.hidden = !isGcash(); setAmt(); showErr(''); }

  function syncCod() {                                     // COD not allowed above PHP 500 on delivery
    if (!pay) return;
    const cod = pay.querySelector('option[value="COD"]') ||
                [...pay.options].find(o => o.value !== 'GCash' && /cash|pay on/i.test(o.textContent));
    if (!cod) return;
    const delivery = mode() === 'delivery';
    const over = total() > COD_LIMIT && delivery;
    cod.disabled = over;
    cod.textContent = !delivery ? 'Pay on pick-up'
                    : over      ? 'Cash on delivery (max ₱500)'
                    :             'Cash on delivery';
    if (over && pay.value === 'COD') { pay.value = 'GCash'; syncPay(); }
  }

  if (pay) {
    pay.addEventListener('change', syncPay);
    if (totalEl) new MutationObserver(() => { syncCod(); setAmt(); }).observe(totalEl, { childList: true, characterData: true, subtree: true });
    syncPay(); syncCod();
  }

  /* ---------- Proof upload: shrink in browser (max 1280px JPEG) ---------- */
  const shrink = f => new Promise((ok, no) => {
    const img = new Image(), u = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(u); no(new Error('That file is not a readable image')); };
    img.src = u;
  });

  if (file) file.addEventListener('change', async () => {
    proofData = ''; if (prev) prev.hidden = true; file.classList.remove('invalid'); showErr('');
    const f = file.files[0]; if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { file.value = ''; return showErr('Please upload a PNG, JPG or WebP image'); }
    try { proofData = await shrink(f); if (prev) { prev.src = proofData; prev.hidden = false; } }
    catch (e) { file.value = ''; showErr(e.message); }
  });

  /* ---------- Validate BEFORE script.js sends the order ---------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('#placeOrder')) return;
    const delivery = mode() === 'delivery';
    let msg = '';
    if (delivery && addr && !addr.value.trim()) { addr.hidden = false; addr.classList.add('invalid'); addr.focus(); msg = 'Delivery address required'; }
    else if (!isGcash() && delivery && total() > COD_LIMIT) msg = 'Cash on delivery is only for orders of ₱500 or less. Please choose GCash.';
    else if (isGcash() && !proofData) { if (file) file.classList.add('invalid'); msg = 'Please upload your GCash proof of payment'; }
    else if (isGcash() && ref && !ref.value.trim()) { ref.focus(); msg = 'Please enter your GCash reference number'; }
    if (msg) { e.stopImmediatePropagation(); e.preventDefault(); showErr(msg); }
  }, true);

  const clearAddrErr = () => { if (addr) addr.classList.remove('invalid'); showErr(''); };
  if (addr) addr.addEventListener('input', clearAddrErr);
  document.querySelectorAll('input[name="otype"]').forEach(r => r.addEventListener('change', () => { clearAddrErr(); syncCod(); }));

  /* ================= fetch hook: attach proof, watch order lists ================= */
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const isOrderPost = /\/api\/orders\/?$/.test(url) && method === 'POST';

    if (isOrderPost && typeof init.body === 'string' && $('#placeOrder')) {
      try {
        const b = JSON.parse(init.body);
        if (isGcash()) { b.payment = 'GCash'; b.proof = proofData; b.gcashRef = ref ? ref.value.trim() : ''; }
        init = { ...init, body: JSON.stringify(b) };
      } catch (_) {}
    }

    const res = await realFetch(input, init);

    /* 401 = the server no longer accepts this login token (e.g. the server restarted or the session expired).
       This is a sign-in problem, not an image problem: ask the customer to sign in again. */
    if (res.status === 401 && /\/api\//.test(url) && !/\/auth\//.test(url)) {
      showErr('Your session expired. Please sign in again, then place your order.');
      const t = $('#toast');
      if (t) { t.textContent = 'Session expired. Please sign in again.'; t.classList.add('show'); }
      if (!window.__hkExpired) { window.__hkExpired = true; setTimeout(() => { const lo = $('#logout'); if (lo) lo.click(); window.__hkExpired = false; }, 1500); }
    }

    if (isOrderPost && res.ok) {
      proofData = '';
      if (file) file.value = '';
      if (ref) ref.value = '';
      if (prev) prev.hidden = true;
    }
    if (/\/api\/orders/.test(url) && method === 'GET') {
      res.clone().json().then(d => alertCancelled(Array.isArray(d) ? d : d.orders || [])).catch(() => {});
    }
    return res;
  };

  /* live updates: server pushes the cancelled order over the WebSocket */
  const RealWS = window.WebSocket;
  window.WebSocket = function (...a) {
    const ws = new RealWS(...a);
    ws.addEventListener('message', e => {
      try { const m = JSON.parse(e.data); if (m.type === 'order') alertCancelled([m.order]); } catch (_) {}
    });
    return ws;
  };
  window.WebSocket.prototype = RealWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => (window.WebSocket[k] = RealWS[k]));

  /* ================= 4. Alert: order cancelled because of a fake proof ================= */
  const seen = new Set(store.get('hk_alerted', []));
  function alertCancelled(list) {
    list.filter(o => o && o.status === 'Cancelled' && o.cancelReason === 'fake_proof' && !seen.has(o.id)).forEach(o => {
      seen.add(o.id); store.set('hk_alerted', [...seen]);
      const el = document.createElement('div');
      el.setAttribute('role', 'alertdialog');
      el.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;padding:20px;background:#3d2b2e99';
      el.innerHTML = `<div style="background:#fff;border:2px solid #fca5a5;border-radius:22px;padding:22px 24px;max-width:380px;width:100%">
        <h3 style="margin:0 0 8px;color:#b91c1c">Order #${o.id} cancelled</h3>
        <p style="margin:0 0 16px">We could not verify the GCash proof of payment you sent, so your order was cancelled. Fake or edited images are not accepted. You can place a new order and upload your real receipt.</p>
        <button class="primary" style="width:100%">OK</button></div>`;
      el.querySelector('button').onclick = () => el.remove();
      document.body.appendChild(el);
    });
  }
})();