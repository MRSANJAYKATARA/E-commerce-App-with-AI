/* ExamLegacy — student app: boot, shell, screens, purchase & AI flows. */
window.EL = window.EL || {};
EL.state = { config: {}, unread: 0, products: [], categories: [] };

(function () {
  var money = EL.money;

  /** Re-typeset STEM equations inside `el` after AI answers are injected. */
  function typeset(el) {
    try {
      if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
        MathJax.typesetPromise([el]).catch(function () {});
      }
    } catch (e) {}
  }

  /* ================= boot ================= */
  async function boot() {
    EL.ui.theme.apply();
    buildShell();
    EL.auth.onChange(function () { EL.ui.dispatch(); refreshUnread(); });
    try { EL.state.config = (await EL.api.get('/config')).config || {}; } catch (e) { EL.state.offline = true; }
    if (EL.state.offline) { showOfflineBanner(); }
    defineRoutes();
    EL.ui.start();
    try {
      await EL.auth.init();
    } catch (e) {
      EL.ui.toast('Sign-in unavailable. Check Firebase config.', 'err');
    }
    refreshUnread();
    setInterval(refreshUnread, 30000);
  }

  function buildShell() {
    document.body.innerHTML =
      '<div class="app">' +
        '<header class="topbar">' +
          '<div class="brand"><div class="brand-mark">EL</div>' +
            '<div class="brand-name">ExamLegacy<small>' + EL.esc(EL.state.config.brand_powered_by || 'SANJAYXLEGACY') + '</small></div>' +
          '</div>' +
          '<button class="icon-btn" id="btn-theme" aria-label="Toggle theme">' + EL.ui.icon('moon') + '</button>' +
          '<button class="icon-btn" id="btn-notif" aria-label="Notifications">' + EL.ui.icon('bell') + '<span class="dot hide" id="notif-dot"></span></button>' +
        '</header>' +
        '<nav class="siderail" id="siderail"></nav>' +
        '<main class="content" id="content"></main>' +
        '<nav class="bottomnav" id="bottomnav"></nav>' +
      '</div>';

    // Side rail (desktop)
    EL.qs('#siderail').innerHTML =
      '<div class="rail-brand"><div class="brand-mark">EL</div><div class="brand-name">ExamLegacy<small>' + EL.esc(EL.state.config.brand_powered_by || '') + '</small></div></div>' +
      EL.ui.NAV.map(function (n) {
        return '<button class="railitem" data-nav="' + n.name + '">' + EL.ui.icon(n.icon) + '<span>' + n.label + '</span></button>';
      }).join('');
    EL.qsa('#siderail [data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { EL.ui.navigate(b.getAttribute('data-nav')); });
    });

    EL.qs('#btn-theme').addEventListener('click', cycleTheme);
    EL.qs('#btn-notif').addEventListener('click', function () { EL.ui.navigate('notifications'); });
  }

  function cycleTheme() {
    var order = ['light', 'dark', 'system'];
    var cur = EL.ui.theme.get();
    var next = order[(order.indexOf(cur) + 1) % order.length];
    EL.ui.theme.set(next);
    EL.ui.toast('Appearance: ' + next);
  }

  /* Honest connectivity banner (shown when the API backend is unreachable). */
  function showOfflineBanner() {
    var bar = document.createElement('div');
    bar.className = 'alert info';
    bar.style.cssText = 'margin:12px 16px 0;border-radius:14px';
    bar.innerHTML = EL.ui.icon('triangle-exclamation') +
      '<div><strong>Preview mode.</strong> The PHP/MySQL backend isn\'t running in this sandbox, so live data, sign-in, purchases and AI are unavailable here. Deploy with a PHP+MySQL host and your Firebase/Cashfree/Gemini credentials to enable them. <a href="docs/DEPLOYMENT.md">Deployment guide →</a></div>';
    var content = EL.qs('#content');
    if (content && content.parentNode) { content.parentNode.insertBefore(bar, content); }
  }

  async function refreshUnread() {
    if (!EL.auth.user()) { EL.state.unread = 0; EL.ui.NAV && EL.qs('#notif-dot') && EL.qs('#notif-dot').classList.add('hide'); return; }
    try {
      var n = await EL.api.get('/notifications');
      EL.state.unread = n.unread || 0;
      var dot = EL.qs('#notif-dot');
      if (dot) dot.classList.toggle('hide', EL.state.unread === 0);
      EL.ui.dispatch && renderNavBadges();
    } catch (e) {}
  }
  function renderNavBadges() {
    var nav = EL.qs('#bottomnav');
    if (!nav) return;
    var cur = EL.ui.current().name;
    var unread = EL.state.unread || 0;
    EL.qsa('[data-nav]', nav).forEach(function (b) {
      var name = b.getAttribute('data-nav');
      var existing = EL.qs('.badge', b);
      if (name === 'support' && unread > 0) {
        if (existing) existing.textContent = unread;
        else b.insertAdjacentHTML('beforeend', '<span class="badge">' + unread + '</span>');
      } else if (existing) existing.remove();
    });
  }

  /* ================= auth guard ================= */
  function requireAuth() {
    if (EL.auth.user()) return true;
    renderAuth();
    return false;
  }

  /* ================= routes ================= */
  function defineRoutes() {
    EL.ui.def('home', screenHome);
    EL.ui.def('store', screenStore);
    EL.ui.def('product', screenProduct);
    EL.ui.def('library', function (c) { if (requireAuth()) screenLibrary(c); });
    EL.ui.def('study', function (c) { if (requireAuth()) screenStudy(c); });
    EL.ui.def('support', function (c) { if (requireAuth()) screenSupport(c); });
    EL.ui.def('account', function (c) { if (requireAuth()) screenAccount(c); });
    EL.ui.def('notifications', function (c) { if (requireAuth()) screenNotifications(c); });
    EL.ui.def('payreturn', screenPayReturn);
  }

  /* ================= HOME ================= */
  async function screenHome(c) {
    c.innerHTML =
      '<section class="hero">' +
        '<div class="kicker">' + EL.ui.icon('graduation-cap') + ' Learn · Practice · Master</div>' +
        '<h1>Premium study material that actually gets you results.</h1>' +
        '<p>Buy exam-focused PDFs, read them in a secure in-app viewer, and supercharge revision with an AI tutor trained on your own material.</p>' +
        '<div class="cta">' +
          '<button class="btn lg" data-go="store">Browse the Store ' + EL.ui.icon('arrow-right') + '</button>' +
          (EL.auth.user() ? '' : '<button class="btn ghost lg" id="hero-signin">Sign in with Google</button>') +
        '</div>' +
        '<div class="promo" id="promo">' +
          '<div class="promo-top">' +
            '<span class="promo-tag">' + EL.ui.icon('bolt') + ' 2026/27 Exam Accelerator</span>' +
            '<span class="promo-badge">Sprint season</span>' +
          '</div>' +
          '<div class="promo-title">NEET · JEE · Boards · UPSC — your fast lane starts now.</div>' +
          '<div class="promo-sub">Handpicked notes, PYQs and mock-test PDFs with instant, secure in-app access.</div>' +
          '<div class="chips promo-chips">' +
            ['NEET', 'JEE', 'Boards', 'UPSC'].map(function (cat) {
              return '<button class="chip" data-quick="' + cat + '">' + cat + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="featurerow mt-24">' +
        feature('shield-halved', 'Secure library', 'Your purchased PDFs are private, watermarked, and never exposed at a public link.') +
        feature('robot', 'Study AI', 'Ask questions, generate MCQs, notes, flashcards and mock tests from your own PDFs.') +
        feature('wallet', 'Wallet & Credits', 'A store wallet for purchases and separate AI credits — tracked transparently.') +
      '</div>' +
      '<div class="section mt-24"><h2>Featured material</h2><span class="more" data-go="store">View all</span></div>' +
      '<div id="featured">' + EL.ui.loading(4) + '</div>';

    EL.qsa('[data-go]', c).forEach(function (b) { b.addEventListener('click', function () { EL.ui.navigate(b.getAttribute('data-go')); }); });
    EL.qsa('[data-quick]', c).forEach(function (b) {
      b.addEventListener('click', function () { EL.ui.navigate('store', { cat: b.getAttribute('data-quick') }); });
    });
    var si = EL.qs('#hero-signin', c); if (si) si.addEventListener('click', signIn);

    try {
      var products = (await EL.api.get('/products?limit=8')).products || [];
      EL.state.products = products;
      EL.qs('#featured', c).innerHTML = products.length
        ? '<div class="grid cols-2">' + products.slice(0, 8).map(productCard).join('') + '</div>'
        : EL.ui.empty({ icon: 'box-open', title: 'No material published yet', text: 'Check back soon.' });
      bindProductCards(c);
      } catch (e) {
        EL.qs('#featured', c).innerHTML = EL.state.offline
          ? EL.ui.empty({ icon: 'cloud', title: 'Catalog loads once the backend is connected', text: 'This preview has no live data.' })
          : EL.ui.errorBox(e.message);
      }
  }

  function feature(ic, t, p) {
    return '<div class="feature"><div class="ic">' + EL.ui.icon(ic) + '</div><h4>' + EL.esc(t) + '</h4><p>' + EL.esc(p) + '</p></div>';
  }

  function productCard(p) {
    var tags = '';
    if (p.is_vip) tags += '<span class="tag vip">VIP</span>';
    if (p.owned) tags += '<span class="tag owned">Owned</span>';
    else if (p.discount_pct > 0) tags += '<span class="tag">-' + p.discount_pct + '%</span>';
    var thumb = p.thumbnail_url
      ? '<img src="' + EL.esc(p.thumbnail_url) + '" alt="' + EL.esc(p.title) + '" loading="lazy">'
      : '<div class="ph">' + EL.ui.icon('book') + '</div>';
    return '<div class="card tap pcard" data-slug="' + EL.esc(p.slug) + '">' +
      '<div class="thumb">' + tags + thumb + '</div>' +
      '<h3>' + EL.esc(p.title) + '</h3>' +
      '<div class="row"><div class="price">' +
        (p.mrp_paise > p.price_paise ? '<s>' + money(p.mrp_paise, p.currency) + '</s>' : '') +
        money(p.price_paise, p.currency) + '</div>' +
      (p.owned ? '<span class="badge green">In library</span>' : '') +
      '</div></div>';
  }

  function bindProductCards(root) {
    EL.qsa('.pcard[data-slug]', root).forEach(function (card) {
      card.addEventListener('click', function () { EL.ui.navigate('product', { slug: card.getAttribute('data-slug') }); });
    });
  }

  /* ================= STORE ================= */
  async function screenStore(c) {
    c.innerHTML =
      '<div class="searchbar">' + EL.ui.icon('search') + '<input id="store-q" type="search" placeholder="Search PDFs, topics, exams…" aria-label="Search"></div>' +
      '<div class="chips mt-16" id="cats"></div>' +
      '<div class="section"><h2>All material</h2></div>' +
      '<div id="results">' + EL.ui.loading(8) + '</div>';
    var state = { q: '', cat: (params && params.cat) || 'All' };

    async function load() {
      var host = EL.qs('#results', c);
      host.innerHTML = EL.ui.loading(8);
      try {
        var q = state.q ? '&search=' + encodeURIComponent(state.q) : '';
        var cat = state.cat && state.cat !== 'All' ? '&category=' + encodeURIComponent(state.cat) : '';
        var items = (await EL.api.get('/products?limit=60' + q + cat)).products || [];
        host.innerHTML = items.length
          ? '<div class="grid cols-2">' + items.map(productCard).join('') + '</div>'
          : EL.ui.empty({ icon: 'magnifying-glass', title: 'No results', text: 'Try a different search or category.' });
        bindProductCards(host);
      } catch (e) {
        host.innerHTML = EL.state.offline
          ? EL.ui.empty({ icon: 'cloud', title: 'Store unavailable in preview', text: 'Connect the PHP/MySQL backend to load the catalog.' })
          : EL.ui.errorBox(e.message);
      }
    }
    try {
      EL.state.categories = (await EL.api.get('/categories')).categories || [];
    } catch (e) {}
    // Deep-link (e.g. home quick chips): fall back to the full catalog when
    // the requested category doesn't exist yet.
    if (state.cat !== 'All' && EL.state.categories.indexOf(state.cat) === -1) state.cat = 'All';
    EL.qs('#cats', c).innerHTML = ['All'].concat(EL.state.categories).map(function (cat) {
      return '<button class="chip ' + (cat === state.cat ? 'active' : '') + '" data-cat="' + EL.esc(cat) + '">' + EL.esc(cat) + '</button>';
    }).join('');
    EL.qsa('#cats [data-cat]', c).forEach(function (b) {
      b.addEventListener('click', function () {
        EL.qsa('#cats .chip', c).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); state.cat = b.getAttribute('data-cat'); load();
      });
    });
    var deb;
    EL.qs('#store-q', c).addEventListener('input', function (e) {
      clearTimeout(deb); state.q = e.target.value.trim();
      deb = setTimeout(load, 300);
    });
    load();
  }

  /* ================= PRODUCT ================= */
  async function screenProduct(c, params) {
    c.innerHTML = '<div class="grid cols-2">' + EL.ui.loading(2) + '</div>';
    var p;
    try { p = (await EL.api.get('/products/' + encodeURIComponent(params.slug))).product; }
    catch (e) { c.innerHTML = EL.ui.errorBox(e.message); return; }
    if (!p) { c.innerHTML = EL.ui.empty({ icon: 'box-open', title: 'Not found' }); return; }

    c.innerHTML =
      '<div class="grid" style="grid-template-columns:1fr;gap:20px">' +
        '<div class="card pad-0" style="overflow:hidden">' +
          (p.thumbnail_url ? '<img src="' + EL.esc(p.thumbnail_url) + '" alt="' + EL.esc(p.title) + '">' :
            '<div class="empty"><div class="ic">' + EL.ui.icon('book') + '</div></div>') +
        '</div>' +
        '<div>' +
          (p.is_vip ? '<span class="badge amber">VIP</span> ' : '') +
          '<span class="badge slate">' + EL.esc(p.category) + '</span>' +
          '<h1 style="font-size:1.5rem;font-weight:800;letter-spacing:-0.02em;margin:10px 0 4px">' + EL.esc(p.title) + '</h1>' +
          (p.subtitle ? '<p class="dim">' + EL.esc(p.subtitle) + '</p>' : '') +
          '<div class="flex center gap-8 mt-8"><span class="price" style="font-size:1.5rem">' + money(p.price_paise, p.currency) + '</span>' +
            (p.mrp_paise > p.price_paise ? '<s class="muted">' + money(p.mrp_paise, p.currency) + '</s>' : '') + '</div>' +
          '<div class="tiny muted mt-8">' + p.page_count + ' pages · ' + EL.bytes(p.file_size_bytes) + ' · ' + EL.esc(p.language) + '</div>' +
          '<div id="buy" class="mt-16"></div>' +
          '<div class="divider"></div>' +
          '<h3 class="b">About this material</h3>' +
          '<p class="dim" style="white-space:pre-wrap">' + EL.esc(p.description || '') + '</p>' +
        '</div>' +
      '</div>';

    renderBuyButton(p);
  }

  function renderBuyButton(p) {
    var host = EL.qs('#buy'); if (!host) return;
    if (p.owned) {
      host.innerHTML = '<button class="btn block lg" id="read-btn">' + EL.ui.icon('book-open') + ' Read in secure viewer</button>';
      EL.qs('#read-btn').addEventListener('click', function () { EL.viewer.open(p.id, p.title); });
      return;
    }
    if (!EL.auth.user()) {
      host.innerHTML = '<button class="btn block lg" id="signin-btn">Sign in to purchase</button>';
      EL.qs('#signin-btn').addEventListener('click', signIn);
      return;
    }
    host.innerHTML = '<button class="btn block lg" id="buy-btn">' + EL.ui.icon('bag-shopping') + ' Buy now · ' + money(p.price_paise, p.currency) + '</button>';
    EL.qs('#buy-btn').addEventListener('click', function () { openBuySheet([p]); });
  }

  /* ================= BUY / PAYMENTS ================= */
  async function openBuySheet(products) {
    var total = products.reduce(function (s, p) { return s + p.price_paise; }, 0);
    var wallet = 0;
    try { wallet = (await EL.api.get('/wallet')).balance_paise; } catch (e) {}
    var canWallet = wallet >= total;

    var body =
      '<div class="card"><div class="flex between center"><span class="dim">Items</span><span class="b">' + products.length + '</span></div>' +
      '<div class="flex between center mt-8"><span class="dim">Total</span><span class="b" style="font-size:1.2rem">' + money(total) + '</span></div>' +
      '<div class="flex between center mt-8"><span class="dim">Wallet balance</span><span class="b">' + money(wallet) + '</span></div></div>' +
      '<div class="field mt-16"><label>Payment method</label>' +
      '<div class="segmented" id="pay-method" style="width:100%">' +
        '<button data-m="wallet" ' + (canWallet ? '' : 'disabled') + ' style="flex:1">Wallet</button>' +
        '<button data-m="cashfree" class="active" style="flex:1">Card / UPI</button>' +
        '<button data-m="split" ' + (canWallet ? '' : 'disabled') + ' style="flex:1">Split</button>' +
      '</div></div>' +
      '<div class="field hide" id="split-field"><label>Amount from wallet (paise)</label>' +
      '<input class="input" id="split-amt" type="number" min="0" max="' + Math.min(wallet, total) + '" value="' + Math.min(wallet, total) + '"></div>' +
      '<div class="tiny muted">Payments are verified securely on the server. Your browser never confirms a payment on its own.</div>';

    var method = 'cashfree';
    var sheet = EL.ui.sheet({
      title: 'Checkout', sub: products.map(function (p) { return p.title; }).join(', '),
      body: body,
      actions: [{ label: 'Pay ' + money(total), variant: '', onClick: function () { return doPay(); } }]
    });
    EL.qsa('#pay-method button', sheet.el).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        EL.qsa('#pay-method button', sheet.el).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); method = b.getAttribute('data-m');
        EL.qs('#split-field', sheet.el).classList.toggle('hide', method !== 'split');
      });
    });

    async function doPay() {
      try {
        var payload = { product_ids: products.map(function (p) { return p.id; }), method: method };
        if (method === 'split') payload.wallet_paise = parseInt(EL.qs('#split-amt', sheet.el).value || '0', 10);
        var res = await EL.api.post('/orders', payload);
        if (res.order.status === 'paid') {
          sheet.close(); EL.ui.toast('Purchase complete! Added to your library.', 'ok');
          EL.ui.navigate('library');
        } else if (res.payment && res.payment.payment_session_id) {
          sheet.close();
          await launchGateway(res.payment, 'order');
        } else {
          sheet.close(); EL.ui.toast('Order created. Complete payment to continue.');
          EL.ui.navigate('account');
        }
      } catch (e) { EL.ui.toast(e.message, 'err'); }
    }
  }

  /* Load Cashfree JS SDK on demand and launch checkout in a modal, then poll verify. */
  function loadCashfree() {
    return new Promise(function (resolve, reject) {
      if (window.Cashfree) return resolve(window.Cashfree);
      var s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = function () { window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Cashfree SDK failed')); };
      s.onerror = function () { reject(new Error('Could not load payment SDK')); };
      document.head.appendChild(s);
    });
  }

  async function launchGateway(payment, kind) {
    EL.ui.toast('Opening secure payment…');
    try {
      var Cashfree = await loadCashfree();
      var mode = (EL.state.config.cashfree_env === 'production') ? 'production' : 'sandbox';
      var cf = new Cashfree({ mode: mode });
      cf.checkout({ paymentSessionId: payment.payment_session_id, redirectTarget: '_modal' });
      // Poll server-side verification (browser callback is not the authority).
      var tries = 0;
      var timer = setInterval(async function () {
        tries++;
        try {
          var r = await EL.api.post('/payments/verify', { intent_id: payment.intent_id });
          if (r.status === 'paid') {
            clearInterval(timer);
            EL.ui.toast('Payment verified!', 'ok');
            await EL.auth.refreshProfile();
            if (kind === 'order') EL.ui.navigate('library');
            else EL.ui.navigate('account');
          } else if (r.status === 'failed' || tries > 60) {
            clearInterval(timer); EL.ui.toast('Payment not completed.', 'err');
          }
        } catch (e) { /* keep polling */ }
      }, 2500);
    } catch (e) {
      EL.ui.toast(e.message, 'err');
    }
  }

  function screenPayReturn(c) {
    // Used if the gateway redirects back. We rely on server verification.
    c.innerHTML = '<div class="empty"><div class="spinner" style="margin:0 auto 12px"></div><h3>Confirming your payment…</h3><p>We are verifying with the payment provider.</p></div>';
    setTimeout(function () { EL.ui.navigate('account'); }, 2500);
  }

  /* ================= LIBRARY ================= */
  async function screenLibrary(c) {
    c.innerHTML = '<div class="section"><h2>My Library</h2></div>' + EL.ui.loading(6);
    try {
      var items = (await EL.api.get('/library')).items || [];
      if (!items.length) {
        c.innerHTML = '<div class="section"><h2>My Library</h2></div>' +
          EL.ui.empty({ icon: 'book', title: 'Your library is empty', text: 'Purchased PDFs appear here securely.', actionLabel: 'Browse the Store', action: 'store' });
        var b = EL.qs('[data-act]', c); if (b) b.addEventListener('click', function () { EL.ui.navigate('store'); });
        return;
      }
      c.innerHTML = '<div class="section"><h2>My Library</h2><span class="tiny muted">' + items.length + ' documents</span></div>' +
        '<div class="card pad-0">' + items.map(function (it) {
          return '<div class="rowitem" data-read="' + it.product_id + '" data-title="' + EL.esc(it.title) + '">' +
            '<div class="lead">' + EL.ui.icon('book') + '</div>' +
            '<div class="grow"><div class="t">' + EL.esc(it.title) + '</div>' +
            '<div class="s">' + it.page_count + ' pages · ' + (it.expires_at ? 'expires ' + new Date(it.expires_at).toLocaleDateString() : 'lifetime') + '</div></div>' +
            '<div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>';
        }).join('') + '</div>';
      EL.qsa('[data-read]', c).forEach(function (r) {
        r.addEventListener('click', function () { EL.viewer.open(parseInt(r.getAttribute('data-read'), 10), r.getAttribute('data-title')); });
      });
    } catch (e) { c.innerHTML = EL.ui.errorBox(e.message); }
  }

  /* ================= STUDY AI ================= */
  async function screenStudy(c) {
    var credits = 0;
    try { credits = (await EL.api.get('/credits')).balance; } catch (e) {}
    c.innerHTML =
      '<div class="section"><h2>Study AI</h2><span class="badge blue" id="credits-badge">' + credits + ' credits</span></div>' +
      '<div class="card">' +
        '<div class="field"><label>Study source</label>' +
          '<div class="segmented" id="src-tabs" style="width:100%">' +
            '<button data-src="library" class="active" style="flex:1">My PDFs</button>' +
            '<button data-src="upload" style="flex:1">Upload</button>' +
            '<button data-src="text" style="flex:1">Paste text</button>' +
          '</div></div>' +
        '<div id="src-panel"></div>' +
        '<div class="field"><label>Task</label><select class="input" id="task">' +
          ['concept:Explain concept', 'solve:Solve question', 'mcq:Make MCQs', 'short:Short answer', 'long:Long answer',
           'exam:Exam answer', 'notes:Notes', 'revision:Quick revision', 'flashcards:Flashcards', 'mock:Mock test', 'weak:Weak topics', 'analyze:Analyze']
            .map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label>Your question / instruction</label><textarea class="input" id="q" placeholder="e.g. Explain Newton&#39;s second law with an example"></textarea></div>' +
        '<button class="btn block" id="ask">' + EL.ui.icon('robot') + ' Ask Study AI</button>' +
      '</div>' +
      '<div id="answer" class="mt-16"></div>';

    var source = { type: 'library', product_id: 0, document_id: 0, text: '' };
    var panel = EL.qs('#src-panel', c);

    async function renderPanel() {
      if (source.type === 'library') {
        panel.innerHTML = '<div class="field"><label>Choose a purchased PDF</label><select class="input" id="lib-sel"><option value="">Loading…</option></select></div>';
        try {
          var items = (await EL.api.get('/library')).items || [];
          EL.qs('#lib-sel', panel).innerHTML = items.length
            ? items.map(function (it) { return '<option value="' + it.product_id + '">' + EL.esc(it.title) + '</option>'; }).join('')
            : '<option value="">No purchased PDFs — buy one first</option>';
        } catch (e) { EL.qs('#lib-sel', panel).innerHTML = '<option value="">Could not load library</option>'; }
      } else if (source.type === 'upload') {
        panel.innerHTML = '<div class="field"><label>Upload a PDF or image (max 15MB)</label><input class="input" id="up" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></div>' +
          '<div class="tiny muted" id="up-status">Your upload is private and used only by you.</div>';
        EL.qs('#up', panel).addEventListener('change', async function (e) {
          var f = e.target.files[0]; if (!f) return;
          EL.qs('#up-status', panel).textContent = 'Uploading…';
          try {
            var doc = await EL.api.upload('/uploads', f, 'file');
            source.document_id = doc.id; source.type = 'upload';
            EL.qs('#up-status', panel).textContent = 'Ready: ' + doc.filename;
          } catch (err) { EL.qs('#up-status', panel).textContent = err.message; }
        });
      } else {
        panel.innerHTML = '<div class="field"><label>Paste study text</label><textarea class="input" id="paste" placeholder="Paste notes or a passage…"></textarea></div>';
      }
    }
    EL.qsa('#src-tabs button', c).forEach(function (b) {
      b.addEventListener('click', function () {
        EL.qsa('#src-tabs button', c).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); source.type = b.getAttribute('data-src'); renderPanel();
      });
    });
    renderPanel();

    EL.qs('#ask', c).addEventListener('click', async function () {
      var q = EL.qs('#q', c).value.trim();
      var payload = { question: q, task: EL.qs('#task', c).value, source_type: source.type };
      if (source.type === 'library') {
        payload.product_id = parseInt(EL.qs('#lib-sel', panel).value || '0', 10);
        if (!payload.product_id) { EL.ui.toast('Choose a PDF from your library', 'err'); return; }
      } else if (source.type === 'upload') {
        payload.document_id = source.document_id;
        if (!payload.document_id) { EL.ui.toast('Upload a file first', 'err'); return; }
      } else {
        payload.text = EL.qs('#paste', c).value;
      }
      var out = EL.qs('#answer', c);
      out.innerHTML = '<div class="card"><div class="flex center gap-12"><div class="spinner"></div><span class="dim">Study AI is thinking…</span></div></div>';
      EL.qs('#ask', c).disabled = true;
      try {
        var r = await EL.api.post('/ai/study', payload);
        out.innerHTML = '<div class="card"><div class="flex between center" style="margin-bottom:8px">' +
          '<span class="badge blue">' + EL.esc(r.task) + '</span><span class="tiny muted">-' + r.credits_spent + ' credits · ' + r.balance + ' left</span></div>' +
          '<div style="white-space:pre-wrap">' + EL.esc(r.answer) + '</div></div>';
        EL.qs('#credits-badge', c).textContent = r.balance + ' credits';
        typeset(out);
      } catch (e) {
        out.innerHTML = EL.ui.errorBox(e.message);
      } finally { EL.qs('#ask', c).disabled = false; }
    });
  }

  /* ================= SUPPORT ================= */
  async function screenSupport(c) {
    c.innerHTML =
      '<div class="section"><h2>Support Center</h2></div>' +
      '<div class="segmented" id="sup-tabs" style="width:100%;margin-bottom:16px">' +
        '<button data-tab="ai" class="active" style="flex:1">AI Help</button>' +
        '<button data-tab="human" style="flex:1">Talk to a human</button>' +
      '</div>' +
      '<div id="sup-panel"></div>';
    var tab = 'ai';
    var panel = EL.qs('#sup-panel', c);
    EL.qsa('#sup-tabs button', c).forEach(function (b) {
      b.addEventListener('click', function () {
        EL.qsa('#sup-tabs button', c).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); tab = b.getAttribute('data-tab'); renderSupport();
      });
    });
    function renderSupport() {
      if (tab === 'ai') renderSupportAi();
      else renderHuman();
    }
    function renderSupportAi() {
      panel.innerHTML =
        '<div class="card">' +
          '<div class="field"><label>Ask Support AI (account, orders, payments, wallet, PDF access)</label>' +
          '<textarea class="input" id="sup-q" placeholder="e.g. Why can&#39;t I open my PDF?"></textarea></div>' +
          '<button class="btn block" id="sup-ask">' + EL.ui.icon('headset') + ' Ask Support AI</button>' +
          '<div class="divider"></div>' +
          '<div class="field"><label>Or ask Help AI for general guidance</label>' +
          '<input class="input" id="help-q" placeholder="e.g. How does the Wallet work?"></div>' +
          '<button class="btn soft block" id="help-ask">' + EL.ui.icon('circle-question') + ' Ask Help AI</button>' +
        '</div><div id="sup-out" class="mt-16"></div>';
      EL.qs('#sup-ask', panel).addEventListener('click', async function () {
        var q = EL.qs('#sup-q', panel).value.trim(); if (!q) return;
        await askAi('/ai/support', { message: q }, panel);
      });
      EL.qs('#help-ask', panel).addEventListener('click', async function () {
        var q = EL.qs('#help-q', panel).value.trim(); if (!q) return;
        await askAi('/ai/help', { message: q }, panel);
      });
    }
    async function askAi(path, body, root) {
      var out = EL.qs('#sup-out', root);
      out.innerHTML = '<div class="card"><div class="flex center gap-12"><div class="spinner"></div><span class="dim">Thinking…</span></div></div>';
      try {
        var r = await EL.api.post(path, body);
        out.innerHTML = '<div class="card" style="white-space:pre-wrap">' + EL.esc(r.answer) + '</div>';
        typeset(out);
      } catch (e) { out.innerHTML = EL.ui.errorBox(e.message); }
    }
    async function renderHuman() {
      panel.innerHTML = EL.ui.loading(2);
      try {
        var threads = (await EL.api.get('/support')).threads || [];
        var list = threads.map(function (t) {
          return '<div class="rowitem" data-thread="' + t.id + '"><div class="lead">' + EL.ui.icon('comment-dots') + '</div>' +
            '<div class="grow"><div class="t">' + EL.esc(t.subject) + '</div><div class="s">' + statusLabel(t.status) + ' · ' + EL.esc(t.last_message || '') + '</div></div>' +
            '<div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>';
        }).join('');
        panel.innerHTML =
          '<button class="btn block mb-3" id="new-thread" style="width:100%;margin-bottom:12px">' + EL.ui.icon('plus') + ' New conversation</button>' +
          (threads.length ? '<div class="card pad-0">' + list + '</div>' : EL.ui.empty({ icon: 'comments', title: 'No conversations yet', text: 'Start one and our team will reply here.' }));
        EL.qs('#new-thread', panel).addEventListener('click', openNewThread);
        EL.qsa('[data-thread]', panel).forEach(function (r) {
          r.addEventListener('click', function () { openThread(parseInt(r.getAttribute('data-thread'), 10)); });
        });
      } catch (e) { panel.innerHTML = EL.ui.errorBox(e.message); }
    }
    function openNewThread() {
      var s = EL.ui.sheet({
        title: 'New support request', sub: 'Our team replies inside the app.',
        body: '<div class="field"><label>Subject</label><input class="input" id="nt-subj" placeholder="Brief topic"></div>' +
              '<div class="field"><label>Describe your issue</label><textarea class="input" id="nt-msg"></textarea></div>',
        actions: [{ label: 'Send', onClick: async function () {
          try {
            await EL.api.post('/support', { subject: EL.qs('#nt-subj', s.el).value, message: EL.qs('#nt-msg', s.el).value });
            EL.ui.toast('Request sent', 'ok'); renderHuman();
          } catch (e) { EL.ui.toast(e.message, 'err'); }
        } }]
      });
    }
    async function openThread(id) {
      var s = EL.ui.sheet({ title: 'Conversation', sub: '', body: '<div id="thr-msgs" style="max-height:50vh;overflow:auto"></div>' +
        '<div class="flex gap-8 mt-16"><input class="input" id="thr-in" placeholder="Type a reply…"><button class="btn" id="thr-send">Send</button></div>' });
      async function load() {
        try {
          var data = await EL.api.get('/support/' + id);
          EL.qs('.sub', s.el).textContent = data.thread.subject + ' · ' + statusLabel(data.thread.status);
          EL.qs('#thr-msgs', s.el).innerHTML = data.messages.map(function (m) {
            var mine = m.sender === 'user';
            return '<div style="margin:8px 0;text-align:' + (mine ? 'right' : 'left') + '">' +
              '<span class="badge ' + (mine ? 'blue' : (m.sender === 'admin' ? 'green' : 'slate')) + '">' + m.sender + '</span> ' +
              '<div class="card" style="display:inline-block;max-width:80%;text-align:left;white-space:pre-wrap">' + EL.esc(m.body) + '</div></div>';
          }).join('');
          EL.qs('#thr-msgs', s.el).scrollTop = 999999;
        } catch (e) { EL.ui.toast(e.message, 'err'); }
      }
      EL.qs('#thr-send', s.el).addEventListener('click', async function () {
        var v = EL.qs('#thr-in', s.el).value.trim(); if (!v) return;
        try { await EL.api.post('/support/' + id + '/messages', { message: v }); EL.qs('#thr-in', s.el).value = ''; load(); }
        catch (e) { EL.ui.toast(e.message, 'err'); }
      });
      load();
    }
    renderSupport();
  }
  function statusLabel(s) {
    return ({ open: 'Open', waiting_admin: 'Waiting for admin', waiting_user: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' })[s] || s;
  }

  /* ================= ACCOUNT ================= */
  async function screenAccount(c) {
    var u = EL.auth.profile() || {};
    c.innerHTML =
      '<div class="card" style="display:flex;align-items:center;gap:14px">' +
        '<div class="dp-wrap">' +
          (u.avatar_url ? '<img class="dp" src="' + EL.esc(u.avatar_url) + '" alt="Profile photo">' :
            '<div class="lead dp dp-placeholder">' + EL.ui.icon('user') + '</div>') +
          '<button class="dp-badge" id="dp-btn" title="Change profile picture" aria-label="Change profile picture">' + EL.ui.icon('camera') + '</button>' +
        '</div>' +
        '<input type="file" id="dp-input" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">' +
        '<div class="grow"><div class="b" style="font-size:1.1rem">' + EL.esc(u.name || '') + '</div>' +
        '<div class="tiny muted">' + EL.esc(u.email || '') + '</div>' +
        (u.vip_active ? '<span class="badge amber mt-8">VIP PASS</span>' : '') + '</div>' +
      '</div>' +
      '<div class="grid cols-2 mt-16" id="balances"></div>' +
      '<div class="section"><h2>Account</h2></div>' +
      '<div class="card pad-0" id="acct-menu"></div>';

    try {
      var w = await EL.api.get('/wallet'); var cr = await EL.api.get('/credits');
      EL.qs('#balances', c).innerHTML =
        statCard('wallet', 'Store Wallet', money(w.balance_paise), 'primary') +
        statCard('coins', 'AI Credits', String(cr.balance), 'accent');
      EL.qs('[data-open="wallet"]', c).addEventListener('click', openWalletSheet);
      EL.qs('[data-open="credits"]', c).addEventListener('click', openCreditsSheet);
    } catch (e) {}

    // Profile picture (DP): one-click camera badge -> upload -> instant sync.
    EL.qs('#dp-btn', c).addEventListener('click', function () { EL.qs('#dp-input', c).click(); });
    EL.qs('#dp-input', c).addEventListener('change', async function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { EL.ui.toast('Photo must be under 2 MB', 'err'); return; }
      EL.ui.toast('Uploading photo…');
      try {
        await EL.api.upload('/me/avatar', f, 'file');
        await EL.auth.refreshProfile();
        EL.ui.toast('Profile photo updated');
        EL.ui.navigate('account');
      } catch (err) { EL.ui.toast(err.message, 'err'); }
    });

    var menu = [
      { icon: 'book', label: 'My Library', go: 'library' },
      { icon: 'crown', label: 'VIP PASS', act: 'vip' },
      { icon: 'palette', label: 'Appearance', act: 'appearance' },
      { icon: 'bell', label: 'Notifications', go: 'notifications' },
      { icon: 'id-card', label: 'Edit profile', act: 'profile' },
      { icon: 'shield-halved', label: 'Privacy & Security', act: 'privacy' },
      { icon: 'circle-question', label: 'Help & Support', go: 'support' },
      { icon: 'circle-info', label: 'About & Legal', act: 'about' }
    ];
    EL.qs('#acct-menu', c).innerHTML = menu.map(function (m) {
      return '<div class="rowitem" ' + (m.go ? 'data-go="' + m.go + '"' : 'data-act="' + m.act + '"') + '>' +
        '<div class="lead">' + EL.ui.icon(m.icon) + '</div><div class="grow"><div class="t">' + m.label + '</div></div>' +
        '<div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>';
    }).join('') +
    '<div class="rowitem" data-act="signout"><div class="lead" style="background:rgba(239,68,68,.12);color:var(--danger)">' + EL.ui.icon('right-from-bracket') + '</div>' +
    '<div class="grow"><div class="t" style="color:var(--danger)">Sign out</div></div></div>';

    EL.qsa('[data-go]', c).forEach(function (b) { b.addEventListener('click', function () { EL.ui.navigate(b.getAttribute('data-go')); }); });
    EL.qsa('[data-act]', c).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'vip') openVipSheet();
        else if (a === 'appearance') openAppearanceSheet();
        else if (a === 'profile') openProfileSheet();
        else if (a === 'privacy') openInfoSheet('Privacy & Security', 'Your data is private. Purchased PDFs are never exposed at public URLs and are watermarked to your account. Financial records are stored securely server-side. We only expose the minimum information needed to run your account.');
        else if (a === 'about') openAboutSheet();
        else if (a === 'signout') EL.auth.signOut().then(function () { EL.ui.toast('Signed out'); EL.ui.navigate('home'); });
      });
    });
  }

  function statCard(icon, label, value, tone) {
    var color = tone === 'accent' ? 'var(--accent)' : 'var(--primary)';
    var bg = tone === 'accent' ? 'var(--accent-soft)' : 'var(--primary-soft)';
    return '<div class="card" data-open="' + (label.indexOf('Wallet') >= 0 ? 'wallet' : 'credits') + '" style="cursor:pointer">' +
      '<div class="stat"><div class="ic" style="background:' + bg + ';color:' + color + '">' + EL.ui.icon(icon) + '</div>' +
      '<div><div class="v mono">' + EL.esc(value) + '</div><div class="l">' + label + '</div></div></div></div>';
  }

  async function openWalletSheet() {
    var data;
    try { data = await EL.api.get('/wallet'); } catch (e) { return EL.ui.toast(e.message, 'err'); }
    var s = EL.ui.sheet({
      title: 'Store Wallet', sub: 'For ExamLegacy purchases only. No withdrawals or transfers.',
      body: '<div class="card"><div class="tiny muted">Balance</div><div class="mono" style="font-size:1.8rem;font-weight:700">' + money(data.balance_paise) + '</div></div>' +
        '<div class="field mt-16"><label>Recharge amount (₹)</label><input class="input" id="rc-amt" type="number" min="10" max="5000" value="100"></div>' +
        '<button class="btn block" id="rc-btn">' + EL.ui.icon('credit-card') + ' Recharge via Card / UPI</button>' +
        '<div class="section"><h2>History</h2></div><div id="w-hist"></div>',
      actions: [{ label: 'Close', variant: 'ghost', onClick: function () {} }]
    });
    renderHistory(EL.qs('#w-hist', s.el), data.history, 'wallet');
    EL.qs('#rc-btn', s.el).addEventListener('click', async function () {
      var amt = Math.round(parseFloat(EL.qs('#rc-amt', s.el).value || '0') * 100);
      try {
        var intent = await EL.api.post('/wallet/recharge', { amount_paise: amt });
        s.close(); await launchGateway(intent, 'recharge');
      } catch (e) { EL.ui.toast(e.message, 'err'); }
    });
  }

  async function openCreditsSheet() {
    var data, packs = [];
    try { data = await EL.api.get('/credits'); packs = (await EL.api.get('/credits/packs')).packs || []; }
    catch (e) { return EL.ui.toast(e.message, 'err'); }
    var s = EL.ui.sheet({
      title: 'AI Credits', sub: 'Separate from your Store Wallet. Used by Study AI and Support AI.',
      body: '<div class="card"><div class="tiny muted">Balance</div><div class="mono" style="font-size:1.8rem;font-weight:700">' + data.balance + ' credits</div></div>' +
        '<div class="section"><h2>Buy a pack</h2></div>' +
        packs.map(function (p) {
          return '<div class="rowitem" data-pack="' + p.id + '"><div class="lead">' + EL.ui.icon('coins') + '</div>' +
            '<div class="grow"><div class="t">' + EL.esc(p.name) + '</div><div class="s">' + (p.credits + p.bonus_credits) + ' credits' + (p.bonus_credits ? ' (incl. ' + p.bonus_credits + ' bonus)' : '') + '</div></div>' +
            '<div class="b">' + money(p.price_paise, p.currency) + '</div></div>';
        }).join('') +
        '<div class="section"><h2>History</h2></div><div id="c-hist"></div>',
      actions: [{ label: 'Close', variant: 'ghost', onClick: function () {} }]
    });
    renderHistory(EL.qs('#c-hist', s.el), data.history, 'credits');
    EL.qsa('[data-pack]', s.el).forEach(function (r) {
      r.addEventListener('click', async function () {
        try { var intent = await EL.api.post('/credits/purchase', { pack_id: parseInt(r.getAttribute('data-pack'), 10) }); s.close(); await launchGateway(intent, 'credits'); }
        catch (e) { EL.ui.toast(e.message, 'err'); }
      });
    });
  }

  async function openVipSheet() {
    var plans = [];
    try { plans = (await EL.api.get('/vip/plans')).plans || []; } catch (e) { return EL.ui.toast(e.message, 'err'); }
    var s = EL.ui.sheet({
      title: 'VIP PASS', sub: 'Premium AI + VIP PDFs + premium benefits.',
      body: plans.map(function (p) {
        var b = p.benefits || {};
        var perks = [b.vip_pdfs ? 'VIP PDFs' : null, b.member_discount_pct ? b.member_discount_pct + '% member discount' : null, b.priority_support ? 'Priority support' : null, b.early_access ? 'Early access' : null].filter(Boolean);
        var fu = (p.fair_use && p.fair_use.note) ? p.fair_use.note : '';
        return '<div class="card" style="margin-bottom:12px">' +
          '<div class="flex between center"><div class="b">' + EL.esc(p.name) + '</div><div class="price">' + money(p.price_paise, p.currency) + '</div></div>' +
          '<div class="tiny muted mt-8">' + perks.join(' · ') + '</div>' +
          (fu ? '<div class="tiny muted mt-8">' + EL.esc(fu) + '</div>' : '') +
          '<button class="btn block sm mt-16" data-vip="' + p.id + '">Choose ' + EL.esc(p.interval) + '</button></div>';
      }).join(''),
      actions: [{ label: 'Close', variant: 'ghost', onClick: function () {} }]
    });
    EL.qsa('[data-vip]', s.el).forEach(function (b) {
      b.addEventListener('click', async function () {
        try { var intent = await EL.api.post('/vip/purchase', { plan_id: parseInt(b.getAttribute('data-vip'), 10) }); s.close(); await launchGateway(intent, 'vip'); }
        catch (e) { EL.ui.toast(e.message, 'err'); }
      });
    });
  }

  function openAppearanceSheet() {
    var s = EL.ui.sheet({
      title: 'Appearance', sub: 'Choose light, dark, or match your device.',
      body: '<div class="segmented" id="theme-pick" style="width:100%">' +
        ['light', 'dark', 'system'].map(function (t) {
          return '<button data-t="' + t + '" class="' + (EL.ui.theme.get() === t ? 'active' : '') + '" style="flex:1">' + t + '</button>';
        }).join('') + '</div>',
      actions: [{ label: 'Done', onClick: function () {} }]
    });
    EL.qsa('#theme-pick button', s.el).forEach(function (b) {
      b.addEventListener('click', function () {
        EL.qsa('#theme-pick button', s.el).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); EL.ui.theme.set(b.getAttribute('data-t'));
      });
    });
  }

  function openProfileSheet() {
    var u = EL.auth.profile() || {};
    var s = EL.ui.sheet({
      title: 'Edit profile', body:
        '<div class="field"><label>Name</label><input class="input" id="pf-name" value="' + EL.esc(u.name || '') + '"></div>' +
        '<div class="field"><label>Phone (used for payments)</label><input class="input" id="pf-phone" value="' + EL.esc(u.phone || '') + '"></div>',
      actions: [{ label: 'Save', onClick: async function () {
        try { await EL.api.post('/me', { name: EL.qs('#pf-name', s.el).value, phone: EL.qs('#pf-phone', s.el).value });
          await EL.auth.refreshProfile(); EL.ui.toast('Profile updated', 'ok'); }
        catch (e) { EL.ui.toast(e.message, 'err'); }
      } }]
    });
  }

  function openInfoSheet(title, text) {
    EL.ui.sheet({ title: title, body: '<p class="dim" style="white-space:pre-wrap">' + EL.esc(text) + '</p>',
      actions: [{ label: 'Close', onClick: function () {} }] });
  }

  function openAboutSheet() {
    var cfg = EL.state.config || {};
    var links = [
      cfg.support_email ? ['envelope', 'Support email', 'mailto:' + cfg.support_email] : null,
      cfg.telegram ? ['telegram', 'Telegram', cfg.telegram] : null,
      cfg.telegram_channel ? ['paper-plane', 'Telegram channel', cfg.telegram_channel] : null,
      cfg.instagram ? ['instagram', 'Instagram', cfg.instagram] : null,
      cfg.youtube ? ['youtube', 'YouTube', cfg.youtube] : null,
      cfg.whatsapp_channel ? ['whatsapp', 'WhatsApp channel', cfg.whatsapp_channel] : null
    ].filter(Boolean);
    var body =
      '<div class="card"><div class="flex center gap-12"><div class="brand-mark" style="width:44px;height:44px">EL</div>' +
      '<div><div class="b">ExamLegacy</div><div class="tiny muted">' + EL.esc(cfg.brand_powered_by || 'SANJAYXLEGACY') + ' Powered By</div></div></div>' +
      '<p class="dim small mt-16">A premium digital education platform: secure PDF store, private library, in-app viewer and an AI study tutor.</p></div>' +
      '<div class="section"><h2>Connect</h2></div><div class="card pad-0">' +
      links.map(function (l) {
        return '<a class="rowitem" href="' + EL.esc(l[2]) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' +
          '<div class="lead">' + EL.ui.icon('brands', 'fab fa-' + l[0]) + '</div><div class="grow"><div class="t">' + l[1] + '</div></div>' +
          '<div class="chev">' + EL.ui.icon('arrow-up-right-from-square') + '</div></a>';
      }).join('') + '</div>' +
      (cfg.whatsapp_support_enabled && cfg.whatsapp_support_link ?
        '<a class="btn block mt-16" href="' + EL.esc(cfg.whatsapp_support_link) + '" target="_blank" rel="noopener">' + EL.ui.icon('whatsapp', 'fab') + ' WhatsApp Support</a>' : '') +
      '<div class="section"><h2>Legal</h2></div>' +
      '<div class="card pad-0">' +
        '<div class="rowitem" data-legal="terms"><div class="lead">' + EL.ui.icon('file-contract') + '</div><div class="grow"><div class="t">Terms of Service</div></div><div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>' +
        '<div class="rowitem" data-legal="privacy"><div class="lead">' + EL.ui.icon('user-shield') + '</div><div class="grow"><div class="t">Privacy Policy</div></div><div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>' +
        '<div class="rowitem" data-legal="refund"><div class="lead">' + EL.ui.icon('rotate-left') + '</div><div class="grow"><div class="t">Refund Policy</div></div><div class="chev">' + EL.ui.icon('chevron-right') + '</div></div>' +
      '</div>';
    var s = EL.ui.sheet({ title: 'About', body: body, actions: [{ label: 'Close', onClick: function () {} }] });
    EL.qsa('[data-legal]', s.el).forEach(function (r) {
      r.addEventListener('click', function () {
        var k = r.getAttribute('data-legal');
        openInfoSheet(k === 'terms' ? 'Terms of Service' : k === 'privacy' ? 'Privacy Policy' : 'Refund Policy',
          'This is a placeholder policy text for the first release. Replace with your official policy. Purchases grant a personal, non-transferable license to read the material within ExamLegacy. Refunds are handled case-by-case and credited to your store wallet.');
      });
    });
  }

  function renderHistory(host, rows, kind) {
    if (!host) return;
    if (!rows || !rows.length) { host.innerHTML = '<div class="tiny muted">No transactions yet.</div>'; return; }
    host.innerHTML = '<div class="card pad-0">' + rows.map(function (t) {
      var isCredit = (kind === 'wallet') ? t.amount_paise > 0 : t.amount > 0;
      var amt = kind === 'wallet' ? money(Math.abs(t.amount_paise)) : Math.abs(t.amount) + ' cr';
      return '<div class="rowitem" style="cursor:default"><div class="lead">' + EL.ui.icon(t.type === 'purchase' || t.type === 'usage' ? 'arrow-up' : 'arrow-down') + '</div>' +
        '<div class="grow"><div class="t">' + EL.esc(t.type) + '</div><div class="s">' + EL.esc(t.description || '') + ' · ' + new Date(t.created_at).toLocaleString() + '</div></div>' +
        '<div class="b mono" style="color:' + (isCredit ? 'var(--success)' : 'var(--text)') + '">' + (isCredit ? '+' : '−') + amt + '</div></div>';
    }).join('') + '</div>';
  }

  /* ================= NOTIFICATIONS ================= */
  async function screenNotifications(c) {
    c.innerHTML = '<div class="section"><h2>Notifications</h2><span class="more" id="mark-all">Mark all read</span></div><div id="notif-list">' + EL.ui.loading(4) + '</div>';
    try {
      var data = await EL.api.get('/notifications');
      var list = data.notifications || [];
      EL.qs('#notif-list', c).innerHTML = list.length
        ? '<div class="card pad-0">' + list.map(function (n) {
            return '<div class="rowitem" style="cursor:default;' + (n.is_read ? '' : 'background:var(--primary-soft)') + '">' +
              '<div class="lead">' + EL.ui.icon(notifIcon(n.category)) + '</div>' +
              '<div class="grow"><div class="t">' + EL.esc(n.title) + '</div><div class="s">' + EL.esc(n.body || '') + '</div>' +
              '<div class="tiny muted">' + new Date(n.created_at).toLocaleString() + '</div></div></div>';
          }).join('') + '</div>'
        : EL.ui.empty({ icon: 'bell-slash', title: 'No notifications' });
      EL.qs('#mark-all', c).addEventListener('click', async function () {
        await EL.api.post('/notifications/read-all', {}); EL.ui.dispatch(); refreshUnread();
      });
      refreshUnread();
    } catch (e) { EL.qs('#notif-list', c).innerHTML = EL.ui.errorBox(e.message); }
  }
  function notifIcon(cat) {
    return ({ account: 'user', purchase: 'bag-shopping', payment: 'credit-card', order: 'receipt', pdf: 'book', support: 'headset', product: 'tag', system: 'gear' })[cat] || 'bell';
  }

  /* ================= AUTH SCREEN ================= */
  function renderAuth() {
    var c = EL.qs('#content');
    c.innerHTML =
      '<div class="auth"><div class="panel">' +
        '<div class="mark">EL</div>' +
        '<h1>Welcome to ExamLegacy</h1>' +
        '<p>Sign in with Google to access your library, wallet, AI credits and Study AI.</p>' +
        '<button class="btn block lg" id="auth-google">' + EL.ui.icon('brands', 'fab fa-google') + ' Continue with Google</button>' +
        '<div class="fine">By continuing you agree to our Terms and Privacy Policy.<br>' + EL.esc(EL.state.config.brand_powered_by || 'SANJAYXLEGACY') + ' Powered By</div>' +
      '</div></div>';
    EL.qs('#auth-google', c).addEventListener('click', signIn);
  }

  async function signIn() {
    try { await EL.auth.signInWithGoogle(); EL.ui.toast('Welcome!', 'ok'); EL.ui.navigate('home'); }
    catch (e) { EL.ui.toast(e.message || 'Sign-in failed', 'err'); }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
