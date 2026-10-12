/* Hello Kaffi - customer portal */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Number(n).toFixed(2);

/* Per-item photos. Photo name = item name lowercased, "&" -> "and", punctuation -> "-"
   (e.g. "Set C - Good for 3-4" -> set-c-good-for-3-4). An exact-name photo wins; otherwise sizes share the plain name
   ("Kiwi Fruit Soda - Large" uses kiwi-fruit-soda). Items with no photo show the category photo, then a pink gradient.

   PHOTOS is the list of photos that really exist in images/items/ (slug -> file name). Only files on this list are
   requested, so the console shows no 404s. It works with no setup: when you add a photo, either
     (a) add one line to BUILT_IN below, e.g.  'taro-milktea': 'taro-milktea.jpg',   or
     (b) run "node make-photo-list.js" (or double-click update-photos.bat), then set USE_INDEX_JSON = true below. */
const slug = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const jpg = (...names) => Object.fromEntries(names.map(n => [n, n + '.jpg']));
const BUILT_IN = {
  ...jpg('1-5l-soda', '2-pcs-wings-and-pasta', 'add-on-unli-baby-back-ribs-and-hungarian-sausage', 'add-on-unli-fries', 'add-on-unli-juice',
    'add-on-unli-pasta-and-fries', 'baby-back-ribs-and-pasta', 'baby-back-ribs-and-rice', 'bacsilog', 'baked-penne', 'beef-nachos',
    'beer-in-can', 'budget-meal-2-pcs-pork-bbq-and-rice', 'budget-meal-2-pcs-wings-and-rice', 'budget-meal-korean-chicken-rice-bowl',
    'creamy-carbonara', 'fish-fillet-rice', 'flavored-fries', 'fried-chicken-wings', 'hungariansilog', 'juice-in-can', 'juice-pitcher',
    'kids-choice-spaghetti', 'lechon-kare-kare-rice', 'lechon-kawali-rice', 'lechon-pares-rice', 'mojos-and-dip', 'pasta-ala-romana',
    'pork-liempo-rice', 'pork-tonkatsu-rice', 'salisbury-steak', 'set-a-good-for-2', 'set-b-good-for-4-5', 'set-c-good-for-3-4',
    'set-d-good-for-5-6', 'soda-in-bottle', 'soda-in-can', 'spamsilog', 'tocilog', 'tuna-pesto', 'unli-wings-drinks-and-rice',
    'unli-wings-pasta-drinks-and-rice'),
  'green-apple-fruit-soda': 'green-apple-fruit-soda.webp',
  'kiwi-fruit-soda': 'kiwi-fruit-soda.webp',
  'lychee-fruit-soda': 'lychee-fruit-soda.webp',
  'strawberry-fruit-soda': 'strawberry-fruit-soda.webp',
  // New unique photos (cropped from the AI-generated sheets). Same names as the menu items.
  ...jpg('beef-nachos', 'fries-overload', 'strawberry-waffle', 'belgian-waffle-double', 'nutella-filled-waffle',
    'chicken-and-waffles', 'chicken-fillet-sandwich', 'quarter-pounder-beef-burger-with-cheese',
    'bacon-egg-and-waffles', 'club-house-sandwich'),
  // Iced coffee photos (one per menu item; sizes have their own photo)
  ...jpg('iced-americano-small', 'iced-americano-large', 'iced-cafe-latte-small',
    'iced-cafe-latte-large', 'iced-hazelnut-coffee-small', 'iced-hazelnut-coffee-large',
    'iced-caramel-macchiato-small', 'iced-caramel-macchiato-large', 'iced-cafe-dark-mocha-small',
    'iced-cafe-dark-mocha-large', 'iced-matcha-latte-large', 'iced-strawberry-matcha-large',
    'iced-choconut-latte-large', 'iced-oreo-latte-large', 'iced-dirty-matcha-large'),
  // Hot coffee photos (one per menu item; sizes have their own photo)
  ...jpg('hot-americano-small', 'hot-americano-large', 'hot-cafe-latte-small',
    'hot-cafe-latte-large', 'hot-hazelnut-coffee-small', 'hot-hazelnut-coffee-large',
    'hot-caramel-macchiato-small', 'hot-caramel-macchiato-large', 'hot-cafe-dark-mocha-small',
    'hot-cafe-dark-mocha-large', 'hot-matcha-latte-small', 'hot-matcha-latte-large',
    'hot-dirty-matcha-small', 'hot-dirty-matcha-large'),
  // Milktea photos (printed labels removed from the images)
  ...jpg('oreo-cheesecake-dark-choco-milktea', 'oreo-cheesecake-red-velvet-milktea', 'strawberry-cheesecake-milktea',
    'matcha-creamcheese-milktea', 'okinawa-creamcheese-milktea', 'real-creamcheese-nutella-milktea',
    'wintermelon-milktea-small', 'wintermelon-milktea-large', 'okinawa-milktea-small',
    'okinawa-milktea-large', 'taro-milktea-small', 'taro-milktea-large',
    'strawberry-milktea-small', 'strawberry-milktea-large', 'chocolate-milktea-small',
    'chocolate-milktea-large')
};
let PHOTOS = { ...BUILT_IN };
// Optional: set USE_INDEX_JSON to true if you use make-photo-list.js; images/items/index.json then adds to / overrides the list above.
// Leave it false otherwise (a missing index.json would log one 404).
const USE_INDEX_JSON = false;
const photosReady = !USE_INDEX_JSON ? Promise.resolve() : fetch('images/items/index.json', { cache: 'no-cache' })
  .then(r => r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null)
  .then(j => { if (j && typeof j === 'object') PHOTOS = { ...BUILT_IN, ...j }; })
  .catch(() => {});
const itemBg = m => {
  const full = slug(m.name);
  const base = slug(m.name.replace(/\s*\([^)]*\)\s*$/, '').split(/\s+[-\u2013]\s+/)[0]) || full;
  const f = PHOTOS[full] || PHOTOS[base];
  const urls = [];
  if (f) urls.push(`url("images/items/${encodeURIComponent(f)}")`);
  urls.push(`url("images/tabs/${TABIMG[m.category] || 'promos'}.jpg")`);
  urls.push('linear-gradient(#fdeaf1,#fff)');   // soft pink so a card is never blank when no photo exists
  return urls.join(',');
};

/* Live Server (port 5500) can't run the API, so talk to the Node server on port 3000 instead.
   When the site is opened at http://localhost:3000 these are empty and everything stays same-origin. */
const DEV = location.port === '5500';
const API_BASE = DEV ? 'http://localhost:3000' : '';
const WS_HOST = DEV ? 'localhost:3000' : location.host;
const CATS = ['Unlimited promos', 'Wings', 'Pasta', 'Rice Meals', 'Group Meals', 'Snacks & Sandwiches', 'Iced Coffee', 'Hot Coffee', 'Milkteas', 'Sodas & Drinks'];
const KITTY = '<img class="kitty-ico" src="hello-kitty.png" alt="">';
const EMOJI = { 'Unlimited promos': KITTY, Wings: '🍗', Pasta: '🍝', 'Rice Meals': '🍚', 'Group Meals': '🍽️', 'Snacks & Sandwiches': '🍟', 'Iced Coffee': '🧊', 'Hot Coffee': '☕', Milkteas: '🧋', 'Sodas & Drinks': '🥤' };
const NOTES = { 'Unlimited promos': 'Unlimited is good for 2 hours. Strictly no leftovers, so order only what you can finish. Rice is required on the first serving, the whole table picks the same unli set, and unli cannot be mixed with à la carte. Kids 3 ft and below eat free, 3 to 4 ft get 50% off, and a birthday celebrant is free with 5 paying adults.' };
const TABIMG = { 'Unlimited promos': 'promos', Wings: 'wings', Pasta: 'pasta', 'Rice Meals': 'rice-meals', 'Group Meals': 'group-meals', 'Snacks & Sandwiches': 'snacks', 'Iced Coffee': 'iced-coffee', 'Hot Coffee': 'hot-coffee', Milkteas: 'milkteas', 'Sodas & Drinks': 'soda' };
/* Order tracking (status only, no GPS): the steps differ for pickup and delivery orders. */
const PICKUP_STEPS = ['Received', 'Preparing', 'Ready', 'Picked up'];
const DELIVERY_STEPS = ['Received', 'Preparing', 'Ready', 'Out for delivery', 'Delivered'];
const isDelivery = o => o.type === 'delivery';
// which step the order is on right now
const trackAt = o => o.status === 'Completed' ? (isDelivery(o) ? 4 : 3)
  : o.status === 'Ready' ? (isDelivery(o) && o.dispatched ? 3 : 2) : o.status === 'Preparing' ? 1 : 0;
// plain-language line shown under the steps
const trackMsg = o => {
  if (o.status === 'Cancelled' && o.cancelReason === 'customer') return 'You cancelled this order.';
  if (o.status === 'Cancelled') return o.cancelReason === 'fake_proof' ? 'Cancelled: we could not verify your GCash proof of payment. You can place a new order with your real receipt.' : 'This order was cancelled.';
  if (o.status === 'Payment Retry') return 'We could not verify your GCash proof. Please send your real receipt again below. This is your last chance.';
  if (o.status === 'Payment Review') return 'We received your order. The cashier is checking your GCash payment.';
  if (o.status === 'Completed') return isDelivery(o) ? 'Delivered. Enjoy your meal!' : 'Picked up. Enjoy your meal!';
  if (o.status === 'Ready') {
    if (!isDelivery(o)) return 'Your order is ready for pickup.';
    if (o.dispatched) return `${o.riderName || 'Your rider'} is on the way with your order.`;
    return o.riderName ? `Your order is ready. ${o.riderName} is picking it up.` : 'Your order is ready. We are getting a rider for you.';
  }
  if (o.status === 'Preparing') return 'We are preparing your order.';
  return canCancel(o) ? 'We got your order. You can cancel it until the cashier marks it as received.' : 'We received your order.';
};
/* Cash-on-delivery orders: the customer may cancel until the cashier presses "Mark as received" (status leaves 'Pending'). */
const isCod = o => !/gcash/i.test(o.payment || '');
const canCancel = o => isCod(o) && o.status === 'Pending';
{ const st = document.createElement('style');   // COD order style + cancel box
  st.textContent = '.order.cod{border-left:6px solid #f59e0b;background:#fffdf5}.cod-tag{display:inline-block;margin-left:8px;padding:1px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;letter-spacing:.3px;text-transform:uppercase}.cod-box{margin-top:10px;padding:12px;border:2px dashed #f59e0b;border-radius:14px;background:#fff8e6;color:#92400e;font-size:13px}.cod-box button{width:100%;margin-top:8px;padding:10px;border:2px solid #b91c1c;border-radius:12px;background:#fff;color:#b91c1c;font-weight:600}.cod-box button:hover{background:#b91c1c;color:#fff}.cod-box button:disabled{opacity:.5;cursor:wait}';
  document.head.appendChild(st); }
{ const st = document.createElement('style');   // small extra styling for the longer delivery tracker
  st.textContent = '.retry-box{margin-top:10px;padding:12px;border:2px dashed #f6a5c4;border-radius:14px;background:#fff}.retry-box input{display:block;width:100%;margin:6px 0}.retry-box .primary{width:100%}.order.cancelled{border-color:#fca5a5;background:#fff5f5}.order.cancelled .track-msg{color:#b91c1c}.cancelled-badge{display:inline-block;margin-top:6px;padding:6px 16px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-weight:600;font-size:13px}.order .steps div{font-size:12px;line-height:1.25;display:grid;place-items:center;min-width:0}.order.delivery .steps{gap:4px}.track-msg{margin:10px 2px 0;color:var(--soft);font-size:13.5px}@media(max-width:560px){.order.delivery .steps{flex-direction:column;gap:6px}.order.delivery .steps div{display:block;text-align:left;padding:8px 14px;font-size:13.5px}}';
  document.head.appendChild(st); }
let session = JSON.parse(localStorage.getItem('hk_customer') || 'null');
let menu = [], orders = [], cat = CATS[0], cart = {}, ws, query = '';

/* Unlimited promos and their add-ons are DINE-IN ONLY: shown on the online menu (with price) as advertisement, but cannot be ordered online.
   The cashier POS still sells them. */
const dineInOnly = m => m.category === 'Unlimited promos' || /^add-on/i.test(String(m.name || '').trim());
{ const st = document.createElement('style');
  st.textContent = '.dinein{display:block;text-align:center;border:2px dashed var(--rose);background:var(--blush);color:var(--pink);border-radius:14px;padding:9px 14px;font-weight:600;font-size:14px}.card.addon .dinein{border-color:#d8e9b8;background:#f3f9e8;color:var(--leaf-d)}';
  document.head.appendChild(st); }
{ const h = decodeURIComponent(location.hash.slice(1)); if (CATS.includes(h)) cat = h; }   // landing page cards link to menu.html#Wings etc.

async function api(path, opts = {}) {
  const r = await fetch(API_BASE + '/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  if (path === '/orders' && (opts.method || 'GET') === 'POST') { try { showReceipt(d, opts.body || {}); } catch (_) {} setTimeout(refreshCod, 300); }   // receipt pops up right after a successful order
  return d;
}
/* ----- Order receipt: shown automatically after an order is placed (pickup AND delivery) ----- */
function showReceipt(o, sent) {
  if (!o || o.id == null) return;
  const type = (o.type || sent.type || 'pickup').toLowerCase(), delivery = type === 'delivery';
  const pay = String(o.payment || sent.payment || ''), gcash = /gcash/i.test(pay);
  const name = o.customer || (session && session.user && (session.user.name || session.user.fullName)) || 'Customer';
  const phone = o.phone || (session && session.user && session.user.phone) || '';
  const first = name.trim().split(/\s+/)[0];
  const d0 = new Date(o.createdAt || o.created || o.time || o.date || Date.now()), when = isNaN(d0) ? new Date() : d0;
  const items = (o.items || []).map(i => {
    const m = menu.find(x => x.id == i.id || x.name === i.name) || {};
    const price = i.price != null ? i.price : m.price;
    return { name: i.name || m.name, qty: i.qty, line: price != null ? price * i.qty : null };
  });
  const total = o.total != null ? o.total : items.reduce((s, i) => s + (i.line || 0), 0);
  const address = (o.address || sent.address || '').trim();
  const note = (o.note || sent.note || '').trim();
  const ref = o.gcashRef || sent.gcashRef || '';
  const payLabel = gcash ? 'GCash' : (delivery ? 'Cash on delivery' : 'Pay on pick-up');
  const payHint = gcash ? 'The cashier will check your payment before accepting the order.'
    : delivery ? 'Please prepare the exact amount for the rider.' : 'Pay at the counter when you pick up.';
  const where = delivery ? (address || 'Address not provided') : 'Pick up at the Hello Kaffi counter';

  document.getElementById('receiptModal')?.remove();
  const m = document.createElement('div');
  m.id = 'receiptModal'; m.className = 'receipt-overlay';
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Order receipt');
  m.innerHTML = `<div class="receipt">
    <button type="button" class="rc-x" data-rc="close" aria-label="Close receipt">✕</button>
    <img class="rc-kitty" src="hello-kitty.png" alt="" width="84" height="63">
    <h2 class="wordmark rc-brand">Hello Kaffi</h2>
    <p class="rc-thanks">${sent.__again ? 'Your Hello Kaffi receipt' : `Thank you, ${esc(first)}! Your order is in.`}</p>
    <div class="rc-meta"><span class="rc-no">Order #${esc(o.id)}</span><span class="rc-type ${delivery ? 'is-delivery' : 'is-pickup'}">${delivery ? 'Delivery' : 'Pickup'}</span></div>
    ${o.status === 'Cancelled' ? '<p class="rc-cancelled">This order was cancelled</p>' : ''}
    <dl class="rc-info">
      <div><dt>Name</dt><dd>${esc(name)}</dd></div>
      ${phone ? `<div><dt>Mobile</dt><dd>${esc(phone)}</dd></div>` : ''}
      <div><dt>Date</dt><dd>${esc(when.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))}</dd></div>
      <div><dt>${delivery ? 'Deliver to' : 'Pickup'}</dt><dd>${esc(where)}</dd></div>
      <div><dt>Payment</dt><dd>${esc(payLabel)}${gcash && ref ? `<small>Ref. ${esc(ref)}</small>` : ''}<small>${esc(payHint)}</small></dd></div>
    </dl>
    <div class="rc-sep"></div>
    <ul class="rc-items">${items.map(i => `<li><span>${esc(i.qty)} × ${esc(i.name)}</span><b>${i.line != null ? peso(i.line) : ''}</b></li>`).join('')}</ul>
    ${note ? `<p class="rc-note"><b>Note:</b> ${esc(note)}</p>` : ''}
    <div class="rc-total"><span>Total</span><b>${peso(total)}</b></div>
    <div class="rc-actions"><button type="button" class="primary" data-rc="orders">Track my order</button><button type="button" class="rc-ghost" data-rc="print">Print / save</button></div>
    <p class="rc-foot">♥ Salamat for ordering at Hello Kaffi ♥</p>
    <div class="rc-edge" aria-hidden="true"></div>
  </div>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', e => {
    const a = e.target.closest('[data-rc]');
    if (e.target === m || (a && (a.dataset.rc === 'orders' || a.dataset.rc === 'close'))) close();
    else if (a && a.dataset.rc === 'print') window.print();
  });
  m.querySelector('[data-rc=close]').focus();
}

/* ----- Hello Kaffi style confirm popup (replaces the browser's confirm box) ----- */
function hkConfirm({ title, msg, warn, okText = 'Yes', cancelText = 'No' }) {
  return new Promise(done => {
    const m = document.createElement('div'); m.className = 'receipt-overlay';
    m.setAttribute('role', 'alertdialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
    m.innerHTML = `<div class="receipt cf-card">
      <img class="rc-kitty" src="hello-kitty.png" alt="" width="84" height="63">
      <h2 class="cf-title">${esc(title)}</h2>
      <p class="cf-msg">${esc(msg || '')}</p>
      ${warn ? `<div class="cf-warn" role="alert"><b>⚠ Warning</b><span>${esc(warn)}</span></div>` : ''}
      <div class="rc-actions"><button type="button" class="primary" data-cf="no">${esc(cancelText)}</button><button type="button" class="cf-danger" data-cf="yes">${esc(okText)}</button></div>
      <div class="rc-edge" aria-hidden="true"></div></div>`;
    document.body.appendChild(m);
    const end = v => { m.remove(); document.removeEventListener('keydown', onKey); done(v); };
    const onKey = e => { if (e.key === 'Escape') end(false); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', e => { const b = e.target.closest('[data-cf]'); if (b) end(b.dataset.cf === 'yes'); else if (e.target === m) end(false); });
    m.querySelector('[data-cf=no]').focus();   // safest choice is the default
  });
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

/* If a category photo is missing (e.g. images/tabs/sodas.jpg), show the category emoji instead of a broken image */
window.tabFallback = img => {
  const s = document.createElement('span');
  s.className = 'tab-ico';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = EMOJI[img.dataset.c] || '🍴';
  img.replaceWith(s);
};

/* ----- Google sign-in via Firebase (see module script in menu.html) ----- */
$('#googleBtn').onclick = async () => {
  try {
    const idToken = await window.googleSignIn();
    session = await api('/auth/google', { method: 'POST', body: { idToken } });
    localStorage.setItem('hk_customer', JSON.stringify(session)); start();
  } catch (e) {
    session = null;
    toast(e.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled'
      : e.message === 'Failed to fetch' ? 'Server is not running. Run "npm start" first.'
      : (e.message || 'Google sign-in failed'));
  }
};
$('#logout').onclick = () => { localStorage.removeItem('hk_customer'); session = null; location.reload(); };

/* ----- Google sign-in: ask for the real name, mobile number and default address (every sign-in; pre-filled with what we saved) ----- */
function askProfile() {
  return new Promise(done => {
    const u = session.user, m = document.createElement('div');
    m.className = 'receipt-overlay'; m.id = 'profileModal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Confirm your details');
    m.innerHTML = `<form class="receipt pf-card" novalidate>
      <img class="rc-kitty" src="hello-kitty.png" alt="" width="84" height="63">
      <h2 class="wordmark rc-brand">Hello Kaffi</h2>
      <p class="rc-thanks">${u.hasProfile ? 'Welcome back! Please check your details.' : 'One last step before you order.'}</p>
      <p class="pf-why">Your Gmail name isn't always your real name. Our rider and cashier need your <b>real name</b> and contact details for delivery.</p>
      <label for="pfName">Full name (first and last)</label>
      <input id="pfName" autocomplete="name" maxlength="60" placeholder="e.g. Maria Santos" value="${esc(u.name)}">
      <label for="pfPhone">Mobile number</label>
      <input id="pfPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="09171234567" value="${esc(u.phone || '')}">
      <label for="pfAddr">Default delivery address</label>
      <textarea id="pfAddr" rows="3" maxlength="200" placeholder="House no., street, barangay, city">${esc(u.address || '')}</textarea>
      <p id="pfErr" class="err" role="alert"></p>
      <div class="rc-actions"><button type="submit" class="primary">Save and continue</button><button type="button" class="rc-ghost" id="pfOut">Sign out</button></div>
    </form>`;
    document.body.appendChild(m);
    const f = m.querySelector('form'), err = m.querySelector('#pfErr'), $$ = id => m.querySelector('#' + id);
    $$('pfName').focus(); $$('pfName').select();
    $$('pfOut').onclick = () => { m.remove(); $('#logout').click(); };
    f.onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const name = $$('pfName').value.trim().replace(/\s+/g, ' '), words = name.split(' ');
      if (name.length < 4 || words.length < 2 || !words.every(w => /^\p{L}[\p{L}.'’-]*$/u.test(w))) return (err.textContent = 'Please enter your real first and last name (letters only, no numbers).', $$('pfName').focus());
      if (!/^09\d{9}$/.test($$('pfPhone').value.replace(/[\s-]/g, '').replace(/^\+?63/, '0'))) return (err.textContent = 'Enter a valid mobile number, like 09171234567.', $$('pfPhone').focus());
      if ($$('pfAddr').value.trim().length < 10) return (err.textContent = 'Enter your complete delivery address.', $$('pfAddr').focus());
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      try {
        const d = await api('/profile', { method: 'POST', body: { name, phone: $$('pfPhone').value, address: $$('pfAddr').value } });
        session.user = d.user; localStorage.setItem('hk_customer', JSON.stringify(session)); m.remove(); done();
      } catch (x) { err.textContent = x.message; b.disabled = false; }
    };
  });
}

/* ----- Cash status note under the payment box (daily PHP 500 cap / 30-day pause after 3 cancels). Wording follows Pickup vs Delivery. ----- */
let codInfo = null;
const fmtDate = t => new Date(t).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
function renderCodNote() {
  const c = codInfo; if (!c) return;
  const sel = document.querySelector('[name=otype]:checked'), name = sel && sel.value === 'delivery' ? 'Cash on delivery' : 'Pay on pick-up';
  let n = document.getElementById('codNote'), w = document.getElementById('codWarn');
  if (!n) {
    n = document.createElement('p'); n.id = 'codNote'; n.className = 'small cod-note'; $('#payment').insertAdjacentElement('afterend', n);
    w = document.createElement('p'); w.id = 'codWarn'; w.className = 'small cod-warn'; n.insertAdjacentElement('afterend', w);
  }
  n.classList.toggle('bad', c.banned);
  n.textContent = c.banned ? `${name} is paused on your account until ${fmtDate(c.until)}. Please pay with GCash.`
    : `${name} today: ${peso(c.left)} left of ${peso(c.limit)} (cancelled orders still count).`;
  const left = c.maxCancels - c.cancels;   // strikes left before the 30-day pause
  w.hidden = c.banned || c.cancels < c.maxCancels - 1;
  w.textContent = w.hidden ? '' : `Heads up: you cancelled ${c.cancels} cash orders in the last 30 days. ${left === 1 ? 'One more cancelled order' : 'Another cancelled order'} and cash payment will be paused for 30 days (GCash only).`;
}
async function refreshCod() { try { codInfo = await api('/cod-status'); renderCodNote(); } catch (_) {} }

async function start() {
  $('#login').hidden = true;
  if (session.user.google && !session.user.confirmed) await askProfile();
  $('#app').hidden = false;
  $('#userName').textContent = session.user.name;
  await photosReady;
  try { menu = await api('/menu'); orders = await api('/orders/mine'); }
  catch (e) { return $('#logout').click(); } // expired session after server restart
  renderAll(); connect(); refreshCod();
}
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss' : 'ws') + '://' + WS_HOST + '/ws?token=' + session.token);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'menu') { menu = m.menu; renderMenu(); renderCart(); }
    if (m.type === 'order') {
      const i = orders.findIndex(o => o.id === m.order.id), before = i < 0 ? null : trackMsg(orders[i]);
      i < 0 ? orders.unshift(m.order) : orders[i] = m.order;
      if (!m.isNew && before !== trackMsg(m.order)) toast(`Order #${m.order.id}: ${trackMsg(m.order)}`);   // only when something actually changed
      renderOrders();
    }
  };
  ws.onclose = () => setTimeout(() => session && connect(), 2000);
}

document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
  $('#view-menu').hidden = b.dataset.view !== 'menu'; $('#view-orders').hidden = b.dataset.view !== 'orders';
});

/* ----- Menu search: looks across ALL categories; every word you type must match ----- */
$('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderMenu(); });
$('#search').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; query = ''; renderMenu(); } });
const matches = m => {
  const hay = [m.name, m.desc, m.category, m.price].join(' ').toLowerCase();
  return query.split(/\s+/).every(w => hay.includes(w));
};

function renderAll() { renderMenu(); renderCart(); renderOrders(); }
/* ----- variants: items that only differ by SIZE are shown as ONE card with size buttons ----- */
const SIZE_CORE = '(?:(?:party tray|sampler|tray|platter|bucket|box)\\s+)?(?:\\d+(?:\\.\\d+)?\\s*(?:pcs?|pieces?|oz|ml|liters?|litres?|l|g|kg)|solo|small|medium|regular|large|extra large|xl|jumbo|mini|single|double|triple|family|sharing|big|(?:half|full|party|family)?\\s*tray|(?:good )?for (?:\\d+(?:\\s*[-\\u2013]\\s*\\d+)?|one|two|three|four|five|six)|[sml])';
const SIZE_RE = new RegExp('^' + SIZE_CORE + '(?:\\s+(?:with|w/|\\+)\\s+[a-z][a-z ]*)?$', 'i');   // a size, optionally "...with Garlic Bread"
const splitVariant = name => {   // "Fried Chicken Wings - 6 pcs" or "Latte (Large)" -> { base, label }; dishes that merely share a name stay separate
  name = String(name || '').trim();
  const a = name.match(/^(.*\S)\s+[-\u2013\u2014]\s+([^\-\u2013\u2014]+)$/), b = name.match(/^(.*\S)\s*\(([^)]+)\)$/);
  const m = [a, b].find(x => x && SIZE_RE.test(x[2].trim()));
  return m ? { base: m[1].trim(), label: m[2].trim() } : null;
};
const baseName = m => (splitVariant(m.name) || { base: m.name }).base;
const baseSlug = m => slug(baseName(m));
const PLAIN_LABEL = { Pasta: 'Solo' };   // an item with no size in its name counts as this size when the same dish also has sized versions
function buildGroups(items) {
  const keyOf = (m, base) => m.category + '|' + base.toLowerCase(), sized = new Set();
  items.forEach(m => { const v = dineInOnly(m) ? null : splitVariant(m.name); if (v) sized.add(keyOf(m, v.base)); });
  const map = new Map(), out = [];
  items.forEach(m => {
    let v = dineInOnly(m) ? null : splitVariant(m.name);
    if (!v && !dineInOnly(m) && sized.has(keyOf(m, m.name.trim()))) v = { base: m.name.trim(), label: PLAIN_LABEL[m.category] || 'Regular' };
    if (!v) return out.push({ single: m });
    const key = keyOf(m, v.base);
    let g = map.get(key);
    if (!g) { g = { key, base: v.base, variants: [] }; map.set(key, g); out.push(g); }
    g.variants.push({ m, label: v.label });
  });
  return out.map(g => g.variants && g.variants.length < 2 ? { single: g.variants[0].m } : g)
    .map(g => { if (g.variants) g.variants.sort((a, b) => a.m.price - b.m.price); return g; });
}

/* Hello Kaffi Favorites: edit this list (use the item name without the size). Names that are not on the menu are skipped. */
const FAVORITES = ['Fried Chicken Wings', 'Creamy Carbonara', 'Baby Back Ribs and Pasta', 'Pork Tonkatsu Rice', 'Beef Nachos', 'Pasta Ala Romana'];
const BEST = new Set(FAVORITES.map(slug));
const isBest = m => BEST.has(baseSlug(m));
const STAR = 'images/hello-favorite.png';
const RIBBON = `<span class="fav"><img src="${STAR}" alt="">Favorite</span>`;
const baseBg = m => { const b = baseName(m); return PHOTOS[slug(b)] ? itemBg({ name: b, category: m.category }) : itemBg(m); };   // one photo for all sizes
const picked = {}, curVariant = g => g.variants.find(v => v.m.id === picked[g.key]) || g.variants.find(v => v.m.stock) || g.variants[0];
let GROUPS = {}, lastView = '';

const stockLine = m => `<span class="stock ${m.stock < 10 ? 'low' : ''}">${m.stock ? m.stock + ' left' : 'Sold out'}</span>`;
const addBtn = m => `<button data-add="${m.id}" ${m.stock ? '' : 'disabled'}>${m.stock ? 'Add to cart' : 'Sold out'}</button>`;
const singleCard = (m, searching, i) => `
    <article class="card ${m.name.startsWith('Add-on') ? 'addon' : ''}" data-k="${baseSlug(m)}" style="--bg:${esc(itemBg(m))};--i:${i}">
      ${searching ? `<span class="cat">${esc(m.category)}</span>` : ''}${isBest(m) ? RIBBON : ''}
      <h4>${esc(m.name)}</h4>${m.desc ? `<p class="desc">${esc(m.desc)}</p>` : ''}
      ${dineInOnly(m)
        ? `<div class="foot"><span class="price">${peso(m.price)}</span></div><span class="dinein">🍽️ Dine-in only</span>`
        : `<div class="foot"><span class="price">${peso(m.price)}</span>${stockLine(m)}</div>${addBtn(m)}`}</article>`;
const groupCard = (g, searching, i) => {
  const v = curVariant(g), m = v.m;
  return `
    <article class="card has-variants" data-g="${esc(g.key)}" data-k="${slug(g.base)}" style="--bg:${esc(baseBg(m))};--i:${i}">
      ${searching ? `<span class="cat">${esc(m.category)}</span>` : ''}${isBest(m) ? RIBBON : ''}
      <h4>${esc(g.base)}</h4>${m.desc ? `<p class="desc">${esc(m.desc)}</p>` : ''}
      <div class="sizes" role="group" aria-label="Choose a size">${g.variants.map(x => `<button type="button" class="size${x.m.id === m.id ? ' on' : ''}${x.m.stock ? '' : ' out'}" data-pick="${x.m.id}" aria-pressed="${x.m.id === m.id}">${esc(x.label)}</button>`).join('')}</div>
      <div class="foot"><span class="price">${peso(m.price)}</span>${stockLine(m)}</div>${addBtn(m)}</article>`;
};
function bindCards(root) {
  root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => changeQty(+b.dataset.add, 1));
  root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    const art = b.closest('.card'), g = GROUPS[art.dataset.g]; if (!g) return;
    picked[g.key] = +b.dataset.pick;
    $('#menuGrid').classList.remove('enter');
    art.insertAdjacentHTML('afterend', groupCard(g, !!query, art.style.getPropertyValue('--i') || 0));
    const n = art.nextElementSibling; art.remove(); bindCards(n);
    const on = n.querySelector('.size.on'); if (on) on.focus({ preventScroll: true });
  });
}
function jumpTo(c, key) {   // from a best-seller card: open its category and highlight the item
  cat = c; query = ''; $('#search').value = ''; renderMenu();
  const el = $('#menuGrid').querySelector(`[data-k="${key}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); }
}
function renderBest() {
  const box = $('#best'); if (!box) return;
  const cards = query ? [] : FAVORITES.map((n, i) => {
    const s = slug(n), ms = menu.filter(m => !dineInOnly(m) && baseSlug(m) === s); if (!ms.length) return '';
    const live = ms.filter(m => m.stock), from = Math.min(...(live.length ? live : ms).map(m => +m.price));
    return `<button type="button" class="best-card" data-best="${s}" data-cat="${esc(ms[0].category)}" style="--bg:${esc(baseBg(ms[0]))}"><img class="rank" src="${STAR}" alt=""><span class="best-name">${esc(baseName(ms[0]))}</span><span class="best-price">${ms.length > 1 ? 'from ' : ''}${peso(from)}</span></button>`;
  }).filter(Boolean);
  box.hidden = !cards.length; $('#bestRow').innerHTML = cards.join('');
  $('#bestRow').querySelectorAll('[data-best]').forEach(b => b.onclick = () => jumpTo(b.dataset.cat, b.dataset.best));
}
function renderMenu() {
  const searching = !!query;
  $('#tabs').innerHTML = CATS.map(c => `<button class="${!searching && c === cat ? 'active' : ''}" data-c="${esc(c)}"><img class="tab-img" src="images/tabs/${TABIMG[c]}.jpg" alt="" data-c="${esc(c)}" onerror="tabFallback(this)"> ${esc(c)}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { cat = b.dataset.c; query = ''; $('#search').value = ''; renderMenu(); });
  const items = searching ? menu.filter(matches) : menu.filter(m => m.category === cat);
  const groups = buildGroups(items);
  GROUPS = {}; groups.forEach(g => { if (g.variants) GROUPS[g.key] = g; });
  $('#catNote').innerHTML = searching
    ? `<p class="results">${groups.length} result${groups.length === 1 ? '' : 's'} for “${esc($('#search').value.trim())}”</p>`
    : `<div class="cat-title"><h3 class="wordmark">${esc(cat)}</h3><small>${groups.length} ${groups.length === 1 ? 'dish' : 'dishes'}</small></div>`
      + (NOTES[cat] ? `<p class="note">${esc(NOTES[cat])}</p>` : '') + (cat === 'Unlimited promos' ? '<p class="results">Unlimited promos are dine-in only and can’t be ordered online. Visit us to enjoy them!</p>' : '');
  const view = searching ? 'q:' + query : 'c:' + cat, grid = $('#menuGrid');
  grid.classList.toggle('enter', view !== lastView); lastView = view;   // entrance animation only when the list changes, not on live stock updates
  grid.innerHTML = groups.length ? groups.map((g, i) => g.variants ? groupCard(g, searching, i) : singleCard(g.single, searching, i)).join('') : `<p>${searching ? 'No items match your search.' : 'Nothing in this category yet.'}</p>`;
  bindCards(grid); renderBest();
}

function changeQty(id, d) {
  const m = menu.find(x => x.id === id); if (!m) return;
  if (dineInOnly(m)) return toast('Unlimited promos are dine-in only.');
  const q = Math.max(0, Math.min(m.stock, (cart[id] || 0) + d));
  q ? cart[id] = q : delete cart[id]; renderCart();
}
function renderCart() {
  // Drop anything removed from the menu or exceeding live stock.
  for (const id of Object.keys(cart)) { const m = menu.find(x => x.id == id); if (!m || !m.stock) delete cart[id]; else cart[id] = Math.min(cart[id], m.stock); }
  for (const id of Object.keys(cart)) { if (dineInOnly(menu.find(x => x.id == id))) delete cart[id]; }   // dine-in only items can never stay in an online cart
  const rows = Object.keys(cart).map(id => ({ m: menu.find(x => x.id == id), q: cart[id] }));
  $('#cartCount').textContent = rows.reduce((s, r) => s + r.q, 0);
  $('#cartTotal').textContent = peso(rows.reduce((s, r) => s + r.m.price * r.q, 0));
  $('#cartItems').innerHTML = rows.length ? rows.map(r => `
    <div class="line"><span>${esc(r.m.name)}</span><div class="qty"><button data-d="-1" data-id="${r.m.id}" aria-label="Remove one">−</button><b>${r.q}</b><button data-d="1" data-id="${r.m.id}" aria-label="Add one">+</button></div><b>${peso(r.m.price * r.q)}</b></div>`).join('') : '<p>Your cart is empty. Add something tasty.</p>';
  $('#cartItems').querySelectorAll('[data-id]').forEach(b => b.onclick = () => changeQty(+b.dataset.id, +b.dataset.d));
}
$('#cartFab').onclick = () => $('#cart').hidden = false;
$('#closeCart').onclick = () => $('#cart').hidden = true;
document.querySelectorAll('[name=otype]').forEach(r => r.onchange = () => {
  const del = document.querySelector('[name=otype]:checked').value === 'delivery';
  $('#address').hidden = !del;
  renderCodNote();
  if (del && !$('#address').value && session && session.user && session.user.address) $('#address').value = session.user.address;   // saved default address
});

$('#placeOrder').onclick = async () => {
  $('#err').textContent = '';
  renderCart();   // re-check right before sending
  const items = Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
  if (!items.length) return ($('#err').textContent = 'Add at least one item.');
  try {
    const o = await api('/orders', { method: 'POST', body: { items, type: document.querySelector('[name=otype]:checked').value, address: $('#address').value, note: $('#note').value, payment: $('#payment').value } });
    cart = {}; $('#note').value = ''; renderCart(); $('#cart').hidden = true;
    if (!orders.find(x => x.id === o.id)) orders.unshift(o);
    renderOrders(); toast(`Order #${o.id} placed!`); document.querySelector('[data-view=orders]').click();
  } catch (e) { $('#err').textContent = e.message; }
};

/* ----- one more chance: resend the GCash proof after the cashier rejected it ----- */
const retry = {};   // orderId -> { proof, name, ref } (kept so a live update does not wipe what the customer picked)
const shrinkImg = f => new Promise((ok, no) => {
  const img = new Image(), u = URL.createObjectURL(f);
  img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.8)); };
  img.onerror = () => { URL.revokeObjectURL(u); no(new Error('That file is not a readable image')); };
  img.src = u;
});
const retryForm = o => { const r = retry[o.id] || {};
  return `<div class="retry-box" data-retry="${o.id}"><p class="small"><b>Last chance:</b> pay <b>${peso(o.total)}</b> to Hello Kaffi's GCash, then send the reference number and a screenshot of your real receipt. If it can't be verified again, the order is cancelled.</p>
    <input class="retry-ref" placeholder="GCash reference number" inputmode="numeric" autocomplete="off" value="${esc(r.ref || o.gcashRef || '')}">
    <input class="retry-file" type="file" accept="image/png,image/jpeg,image/webp">
    <p class="small retry-name">${r.proof ? 'Selected: ' + esc(r.name) : ''}</p>
    <button type="button" class="primary retry-send">Send new proof</button><p class="err retry-err" role="alert"></p></div>`; };
document.addEventListener('input', e => { const b = e.target.closest('.retry-box'); if (b && e.target.classList.contains('retry-ref')) (retry[b.dataset.retry] ||= {}).ref = e.target.value; });
document.addEventListener('change', async e => {
  const b = e.target.closest('.retry-box'); if (!b || !e.target.classList.contains('retry-file')) return;
  const id = b.dataset.retry, f = e.target.files[0], err = b.querySelector('.retry-err'); err.textContent = '';
  if (!f) return;
  if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { e.target.value = ''; err.textContent = 'Please upload a PNG, JPG or WebP image'; return; }
  try { (retry[id] ||= {}).proof = await shrinkImg(f); retry[id].name = f.name; b.querySelector('.retry-name').textContent = 'Selected: ' + f.name; }
  catch (x) { e.target.value = ''; err.textContent = x.message; }
});
document.addEventListener('click', async e => {
  const btn = e.target.closest('.retry-send'); if (!btn) return;
  const b = btn.closest('.retry-box'), id = b.dataset.retry, err = b.querySelector('.retry-err'), r = retry[id] || {};
  const ref = (b.querySelector('.retry-ref').value || '').trim(); err.textContent = '';
  if (!r.proof) { err.textContent = 'Please choose your GCash receipt image'; return; }
  if (!ref) { err.textContent = 'Please enter your GCash reference number'; return; }
  btn.disabled = true;
  try { const o = await api(`/orders/${id}/proof`, { method: 'POST', body: { proof: r.proof, gcashRef: ref } });
    delete retry[id]; const i = orders.findIndex(x => x.id === o.id); if (i >= 0) orders[i] = o; renderOrders(); toast('New proof sent. The cashier will check it.'); }
  catch (x) { err.textContent = x.message; btn.disabled = false; }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-receipt]'); if (!b) return;
  const o = orders.find(x => x.id === +b.dataset.receipt); if (o) showReceipt(o, { __again: true });
});
document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-cancel]'); if (!btn) return;
  const id = +btn.dataset.cancel;
  await refreshCod();   // fresh count of cancelled cash orders
  const near = codInfo && !codInfo.banned && codInfo.cancels >= codInfo.maxCancels - 1, nth = codInfo ? codInfo.cancels + 1 : 0;
  const ok = await hkConfirm({
    title: `Cancel order #${id}?`, msg: 'This cannot be undone.',
    warn: near ? `Last warning: this will be your ${nth}${nth === 3 ? 'rd' : 'th'} cancelled cash order in 30 days. After this, Pay on pick-up and Cash on delivery will be paused for 30 days and you can only pay with GCash.` : '',
    okText: 'Yes, cancel order', cancelText: 'Keep my order' });
  if (!ok) return;
  btn.disabled = true;
  try { const o = await api(`/orders/${id}/cancel`, { method: 'PATCH' }); const i = orders.findIndex(x => x.id === o.id); if (i >= 0) orders[i] = o; renderOrders(); toast(`Order #${id} cancelled`); refreshCod(); }
  catch (x) {   // e.g. the cashier received it a moment ago: refresh so the button disappears
    toast(x.message);
    try { orders = await api('/orders/mine'); } catch (_) {}
    renderOrders();
  }
});

function renderOrders() {
  $('#orderList').innerHTML = orders.length ? orders.map(o => {
    const steps = isDelivery(o) ? DELIVERY_STEPS : PICKUP_STEPS, at = trackAt(o), done = o.status === 'Completed';
    return `<article class="order ${isDelivery(o) ? 'delivery' : ''} ${o.status === 'Cancelled' ? 'cancelled' : ''} ${isCod(o) ? 'cod' : ''}"><header><span>Order #${o.id} · ${esc(o.type)}${isCod(o) ? '<span class="cod-tag">Cash on delivery</span>' : ''}</span><span>${peso(o.total)}</span></header>
      <ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)}</li>`).join('')}</ul>
      ${o.status === 'Cancelled' ? `<div class="cancelled-badge">${o.cancelReason === 'customer' ? 'Cancelled by you' : 'Cancelled'}</div>` : `<div class="steps">${steps.map((s, i) => `<div class="${done || i < at ? 'done' : i === at ? 'now' : ''}">${s}</div>`).join('')}</div>`}
      <p class="track-msg">${esc(trackMsg(o))}</p>${o.status === 'Payment Retry' ? retryForm(o) : ''}<button type="button" class="see-receipt" data-receipt="${o.id}">🧾 See receipt</button>${canCancel(o) ? `<div class="cod-box">Changed your mind? You can cancel this cash-on-delivery order until the cashier marks it as received.<button type="button" data-cancel="${o.id}">Cancel order</button></div>` : ''}</article>`;
  }).join('') : '<p>No orders yet. Your next one will show up here live.</p>';
}

if (session) start();
else location.replace('login.html?next=' + encodeURIComponent('menu.html' + location.hash));   // not signed in: use the new login / create-account page