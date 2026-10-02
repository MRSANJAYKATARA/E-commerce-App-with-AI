/* ExamLegacy — Admin dashboard. Firebase Google Sign-In + admin role required.
   All data comes from the verified /api/admin endpoints. No client-side trust. */
(function () {
  var API = '/api';
  var admin = null;
  var section = 'dashboard';

  /* ---------- helpers ---------- */
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function money(p,c){c=c||'INR';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format((p||0)/100);}catch(e){return '₹'+((p||0)/100).toFixed(2);}}
  function qs(s,r){return (r||document).querySelector(s);}
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function icon(n,cls){return '<i class="'+(cls?cls+' ':'')+'fas fa-'+n+'"></i>';}

  function applyTheme(){
    var pref=localStorage.getItem('el_theme')||'system';
    var dark=pref==='dark'||(pref==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  }

  var adminApp = null;
  var adminAuth = null;
  var SUPERADMIN_EMAIL = 'sanjaykatara59927@gmail.com';
  var SUPERADMIN_UID = '2RyGoMqyjqcXiBrp5gH1VdSLWx72';

  function getAdminAuth() {
    if (adminAuth) return adminAuth;
    if (typeof firebase === 'undefined') return null;
    var fbConfig = (window.EL && window.EL.FIREBASE_CONFIG) || {};
    try {
      if (firebase.apps && firebase.apps.length) {
        var existing = firebase.apps.find(function(a){return a.name === 'ExamLegacyAdminApp';});
        if (existing) { adminApp = existing; adminAuth = adminApp.auth(); return adminAuth; }
      }
      adminApp = firebase.initializeApp(fbConfig, 'ExamLegacyAdminApp');
    } catch(e) {
      try { adminApp = firebase.app('ExamLegacyAdminApp'); } catch(err) { adminApp = firebase.app(); }
    }
    adminAuth = adminApp.auth();
    return adminAuth;
  }

  function isSuperadmin(email, uid) {
    if (uid && uid === SUPERADMIN_UID) return true;
    if (email && email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) return true;
    return false;
  }

  async function token(){
    var secret = localStorage.getItem('el_admin_secret');
    if (secret) return secret;
    var auth = getAdminAuth();
    if (auth && auth.currentUser) {
      try { return await auth.currentUser.getIdToken(); } catch(e){}
    }
    return null;
  }
  async function api(method,path,body,isForm){
    var headers={};
    var t=await token();
    if(t) {
      headers['Authorization']='Bearer '+t;
      headers['X-Admin-Token']=t;
    }
    var opts={method:method,headers:headers};
    if(isForm){opts.body=body;}
    else if(body!==undefined&&method!=='GET'){headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
    var res=await fetch(API+path,opts);
    var text=await res.text(); var data=null;
    try{data=text?JSON.parse(text):{};}catch(e){data={ok:false,error:{message:'Bad response'}};}
    if(!res.ok||data.ok===false){var e=new Error((data.error&&data.error.message)||('Error '+res.status));e.status=res.status;throw e;}
    return data.data!==undefined?data.data:data;
  }
  function upload(path,file,field){
    var fd=new FormData(); fd.append(field||'file',file);
    return api('POST',path,fd,true);
  }

  function toast(msg,type){
    var host=qs('.toasts')||(function(){var h=document.createElement('div');h.className='toasts';document.body.appendChild(h);return h;})();
    var t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;host.appendChild(t);
    setTimeout(function(){t.remove();},2600);
  }
  function modal(title,bodyHTML,footerHTML){
    var scrim=document.createElement('div');scrim.className='scrim';
    var m=document.createElement('div');m.className='modal';m.setAttribute('role','dialog');
    m.innerHTML='<div class="row between" style="margin-bottom:6px"><h2>'+esc(title)+'</h2><button class="iconbtn" data-x>'+icon('xmark')+'</button></div><div class="mbody"></div>'+(footerHTML||'');
    qs('.mbody',m).innerHTML=bodyHTML;
    function close(){m.classList.remove('show');scrim.classList.remove('show');setTimeout(function(){m.remove();scrim.remove();},220);}
    qs('[data-x]',m).addEventListener('click',close);
    scrim.addEventListener('click',close);
    document.body.appendChild(scrim);document.body.appendChild(m);
    requestAnimationFrame(function(){scrim.classList.add('show');m.classList.add('show');});
    return {el:m,close:close,body:qs('.mbody',m)};
  }
  function confirmDialog(title,msg,danger){
    return new Promise(function(resolve){
      var m=modal(title,'<p class="dim">'+esc(msg)+'</p>',
        '<div class="row gap8" style="justify-content:flex-end;margin-top:14px">'+
        '<button class="btn ghost" data-no>Cancel</button><button class="btn '+(danger?'danger':'')+'" data-yes>Confirm</button></div>');
      qs('[data-no]',m.el).addEventListener('click',function(){resolve(false);m.close();});
      qs('[data-yes]',m.el).addEventListener('click',function(){resolve(true);m.close();});
    });
  }

  async function verifyAdminKey(key){
    try{
      var res=await fetch(API+'/admin/stats',{headers:{'Authorization':'Bearer '+key,'X-Admin-Token':key}});
      var data=await res.json();
      if(res.ok && data.ok){
        localStorage.setItem('el_admin_secret',key);
        admin={role:'admin',name:'Super Admin',email:'admin@examlegacy.com'};
        try {
          var me = await fetch(API+'/me',{headers:{'Authorization':'Bearer '+key,'X-Admin-Token':key}}).then(r=>r.json());
          if(me.ok && me.data && me.data.user) admin = me.data.user;
        } catch(e){}
        renderShell();
        return true;
      }
    }catch(e){}
    return false;
  }

  function setupNativeAppProtection() {
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend', function (e) { e.preventDefault(); }, { passive: false });
    var lastTouchTime = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouchTime <= 300) {
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea') e.preventDefault();
      }
      lastTouchTime = now;
    }, { passive: false });
    window.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function (e) {
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      return false;
    });
    window.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      var isInput = tag === 'input' || tag === 'textarea';
      var key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === '+' || key === '-' || key === '=' || key === '0')) e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p' || key === 'u')) e.preventDefault();
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))) e.preventDefault();
    });
  }

  /* ---------- boot ---------- */
  async function boot(){
    setupNativeAppProtection();
    applyTheme();
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || /localhost|127\.0\.0\.1/.test(location.hostname))) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
    var savedSecret = localStorage.getItem('el_admin_secret');
    if (savedSecret) {
      try {
        var me = await api('GET', '/me');
        if (me && me.user && me.user.role === 'admin') {
          admin = me.user;
          renderShell();
          return;
        }
      } catch (e) {
        localStorage.removeItem('el_admin_secret');
      }
    }
    showLogin();
  }

  function showLogin(err){
    document.body.innerHTML=
      '<div class="login"><div class="box" style="background:var(--surface);border:1px solid var(--border);border-radius:24px;box-shadow:var(--shadow-md);padding:36px 26px;max-width:420px">'+
      '<img class="mark" src="/assets/img/logo.svg" alt="ExamLegacy" width="84" height="84">'+
      '<h1 style="font-size:1.45rem;font-weight:800;margin:14px 0 4px">Control Center</h1>'+
      '<div style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;letter-spacing:0.05em;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;margin-bottom:14px">SUPERADMIN SECURE PORTAL</div>'+
      '<p style="color:var(--text-2);font-size:0.86rem;margin-bottom:20px;line-height:1.5">Independent ID &amp; Password Login.<br><span class="tiny muted">Protected from Google session issues.</span></p>'+
      (err?'<div class="badge red" style="display:block;padding:10px;font-size:0.82rem;margin-bottom:16px;text-align:left;border-radius:10px;line-height:1.4">'+esc(err)+'</div>':'')+
      '<form id="adm-login-form" style="text-align:left;display:flex;flex-direction:column;gap:12px">'+
        '<div>'+
          '<label style="font-size:0.78rem;font-weight:700;color:var(--text-2);margin-bottom:5px;display:block">Admin Email</label>'+
          '<input type="email" id="adm-email" class="input" value="' + esc(SUPERADMIN_EMAIL) + '" required autocomplete="username" placeholder="sanjaykatara59927@gmail.com" style="width:100%;font-size:0.92rem;padding:11px 13px">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:0.78rem;font-weight:700;color:var(--text-2);margin-bottom:5px;display:block">Admin Password</label>'+
          '<div style="position:relative">'+
            '<input type="password" id="adm-password" class="input" required autocomplete="current-password" placeholder="Enter your admin password" style="width:100%;font-size:0.92rem;padding:11px 40px 11px 13px">'+
            '<button type="button" id="adm-toggle-pwd" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-3);cursor:pointer;padding:4px">'+
              '<i class="fas fa-eye" id="adm-pwd-icon"></i>'+
            '</button>'+
          '</div>'+
        '</div>'+
        '<button type="submit" class="btn block" id="adm-submit" style="margin-top:8px;padding:12px;font-weight:700;font-size:0.95rem">'+
          '<i class="fas fa-shield-halved" style="margin-right:6px"></i> Sign In to Control Center'+
        '</button>'+
      '</form>'+
      '<div class="tiny muted" style="margin-top:22px;letter-spacing:0.03em">ExamLegacy · Powered by SANJAYXLEGACY</div>'+
      '</div></div>';

    var form = qs('#adm-login-form');
    var toggleBtn = qs('#adm-toggle-pwd');
    var pwdInput = qs('#adm-password');
    var pwdIcon = qs('#adm-pwd-icon');

    if (toggleBtn && pwdInput && pwdIcon) {
      toggleBtn.addEventListener('click', function () {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          pwdIcon.className = 'fas fa-eye-slash';
        } else {
          pwdInput.type = 'password';
          pwdIcon.className = 'fas fa-eye';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = (qs('#adm-email').value || '').trim();
        var password = (qs('#adm-password').value || '').trim();
        var btn = qs('#adm-submit');
        if (!email || !password) {
          toast('Please enter email and password', 'err');
          return;
        }
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></div> Verifying…';
        try {
          var res = await fetch(API + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
          });
          var data = await res.json();
          if (!res.ok || !data.ok) {
            var msg = (data && data.error && data.error.message) || 'Login failed';
            throw new Error(msg);
          }
          var token = data.data.token;
          localStorage.setItem('el_admin_secret', token);
          admin = data.data.user;
          toast('Welcome, Superadmin!', 'ok');
          renderShell();
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-shield-halved" style="margin-right:6px"></i> Sign In to Control Center';
          toast(err.message || 'Invalid credentials', 'err');
          showLogin(err.message);
        }
      });
    }
  }

  var NAV_GROUPS = [
    {
      group: 'Overview',
      items: [
        {id:'dashboard',label:'Dashboard',icon:'gauge-high'},
        {id:'products',label:'Products & Materials',icon:'book'},
        {id:'orders',label:'Orders & Sales',icon:'receipt'},
        {id:'users',label:'Users & Balances',icon:'users'}
      ]
    },
    {
      group: 'Operations',
      items: [
        {id:'support',label:'Study Arena & Support',icon:'headset'},
        {id:'notifications',label:'Push Broadcasts',icon:'bell'},
        {id:'vip',label:'VIP Pass Plans',icon:'crown'},
        {id:'packs',label:'AI Credit Packs',icon:'coins'}
      ]
    },
    {
      group: 'System',
      items: [
        {id:'settings',label:'Platform Settings',icon:'gear'},
        {id:'audit',label:'Security & Audit Log',icon:'shield-halved'}
      ]
    }
  ];

  function renderShell(){
    var uName = (admin && admin.name) || 'Sanjay Katara';
    var uEmail = (admin && admin.email) || SUPERADMIN_EMAIL;

    var navHtml = NAV_GROUPS.map(function(grp){
      var items = grp.items.map(function(s){
        return '<button data-sec="'+s.id+'">'+icon(s.icon)+'<span>'+esc(s.label)+'</span></button>';
      }).join('');
      return '<div class="nav-group-label">'+esc(grp.group)+'</div>' + items;
    }).join('');

    document.body.innerHTML=
      '<div class="shell">'+
      '<aside class="sidebar" id="sidebar">'+
        '<div class="logo"><img class="m" src="/assets/img/mark.svg" alt=""><div><div style="font-weight:800;font-size:1.05rem;line-height:1.2">ExamLegacy</div><div style="font-size:0.7rem;color:var(--text-3);font-weight:600">Pro Control Center</div></div></div>'+
        '<nav class="nav" id="nav">'+navHtml+'</nav>'+
        '<div class="side-foot">'+
          '<div class="side-user">'+
            '<div class="av">SK</div>'+
            '<div class="info">'+
              '<div class="name">'+esc(uName)+'</div>'+
              '<div class="email">'+esc(uEmail)+'</div>'+
            '</div>'+
            '<button class="iconbtn" id="side-signout" title="Sign out" style="width:30px;height:30px;border-radius:8px">'+icon('right-from-bracket')+'</button>'+
          '</div>'+
        '</div>'+
      '</aside>'+
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column">'+
        '<div class="topbar">'+
          '<button class="iconbtn hamb" id="hamb">'+icon('bars')+'</button>'+
          '<h1 id="sec-title">Dashboard</h1>'+
          '<span class="status-pill"><span class="status-dot"></span> Hybrid DB · Online</span>'+
          '<span class="superadmin-tag"><i class="fas fa-crown"></i> SUPERADMIN</span>'+
          '<div style="flex:1"></div>'+
          '<button class="iconbtn" id="theme-btn" title="Toggle appearance">'+icon('moon')+'</button>'+
          '<button class="iconbtn" id="signout" title="Sign out">'+icon('right-from-bracket')+'</button>'+
        '</div>'+
        '<main class="main" id="main"></main>'+
      '</div></div><div class="toasts"></div>';

    qsa('#nav [data-sec]').forEach(function(b){
      b.addEventListener('click',function(){
        go(b.getAttribute('data-sec'));
        qs('#sidebar').classList.remove('open');
      });
    });
    qs('#hamb').addEventListener('click',function(){qs('#sidebar').classList.toggle('open');});
    qs('#theme-btn').addEventListener('click',function(){
      var o=['light','dark','system'];
      var c=localStorage.getItem('el_theme')||'system';
      localStorage.setItem('el_theme',o[(o.indexOf(c)+1)%o.length]);
      applyTheme();
    });

    function doSignOut(){
      localStorage.removeItem('el_admin_secret');
      var auth = getAdminAuth();
      if(auth) auth.signOut().catch(function(){});
      location.reload();
    }
    qs('#signout').addEventListener('click', doSignOut);
    var sideSignOut = qs('#side-signout');
    if (sideSignOut) sideSignOut.addEventListener('click', doSignOut);

    go('dashboard');
  }

  function go(id){
    section=id;
    qsa('#nav [data-sec]').forEach(function(b){
      b.classList.toggle('active',b.getAttribute('data-sec')===id);
    });
    var allItems = [];
    NAV_GROUPS.forEach(function(g){ allItems = allItems.concat(g.items); });
    var s = allItems.filter(function(x){return x.id===id;})[0];
    if(s) qs('#sec-title').textContent = s.label;
    ({
      dashboard:dashboard, products:products, orders:orders, users:users,
      support:support, notifications:notifications, vip:vip, packs:packs,
      settings:settings, audit:audit
    })[id]();
  }

  /* ---------- Dashboard ---------- */
  async function dashboard(){
    var m=qs('#main'); m.innerHTML='<div class="stats" id="st">'+Array(5).fill('<div class="stat"><div class="skel" style="height:34px"></div></div>').join('')+'</div><div class="card"><h3>Recent activity</h3><div id="recent"><div class="spinner"></div></div></div>';
    try{
      var st=(await api('GET','/admin/stats')).stats;
      qs('#st').innerHTML=[
        ['users','Users',st.users_total],['user-check','Active',st.users_active],
        ['receipt','Paid orders',st.orders_paid],['clock','Pending',st.orders_pending],
        ['indian-rupee-sign','Revenue',money(st.revenue_paise)]
      ].map(function(x){return '<div class="stat"><div class="ic">'+icon(x[0])+'</div><div class="v mono">'+esc(x[2])+'</div><div class="l">'+x[1]+'</div></div>';}).join('');
    }catch(e){qs('#st').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    try{
      var logs=(await api('GET','/admin/audit')).logs||[];
      qs('#recent').innerHTML=logs.length?('<table><thead><tr><th>Action</th><th>Actor</th><th>Entity</th><th>When</th></tr></thead><tbody>'+
        logs.slice(0,12).map(function(l){return '<tr><td>'+esc(l.action)+'</td><td>'+esc(l.actor_name||l.actor_email||'system')+'</td><td>'+esc(l.entity)+' '+(l.entity_id?('#'+l.entity_id):'')+'</td><td class="tiny muted">'+new Date(l.created_at).toLocaleString()+'</td></tr>';}).join('')+'</tbody></table>'):'<div class="muted">No activity yet.</div>';
    }catch(e){qs('#recent').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
  }

  /* ---------- Products ---------- */
  async function products(){
    var m=qs('#main');
    m.innerHTML='<div class="row between mb12"><input class="input" id="pq" placeholder="Search products…" style="max-width:280px"><button class="btn" id="add-p">'+icon('plus')+' New product</button></div><div class="card pad0"><div class="tablewrap" id="pt"><div class="spinner"></div></div></div>';
    var rows=[];
    async function load(){
      try{rows=(await api('GET','/admin/products')).products||[];draw();}catch(e){qs('#pt').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    }
    function draw(){
      var q=(qs('#pq').value||'').toLowerCase();
      var list=rows.filter(function(p){return !q||p.title.toLowerCase().indexOf(q)>=0;});
      qs('#pt').innerHTML=list.length?('<table><thead><tr><th>Title</th><th>Category</th><th>Price</th><th>VIP</th><th>Status</th><th></th></tr></thead><tbody>'+
        list.map(function(p){return '<tr><td class="wrap">'+esc(p.title)+'</td><td>'+esc(p.category)+'</td><td class="mono">'+money(p.price_paise,p.currency)+'</td>'+
          '<td>'+(p.is_vip?'<span class="badge amber">VIP</span>':'')+'</td>'+
          '<td><span class="badge '+(p.is_published?'green':'slate')+'">'+(p.is_published?'published':'draft')+'</span></td>'+
          '<td style="white-space:nowrap"><button class="btn sm soft" data-edit="'+p.id+'">Edit</button> <button class="btn sm ghost" data-del="'+p.id+'">Unpublish</button></td></tr>';}).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No products.</div>';
      qsa('[data-edit]').forEach(function(b){b.addEventListener('click',function(){editProduct(rows.filter(function(p){return p.id==b.getAttribute('data-edit');})[0]);});});
      qsa('[data-del]').forEach(function(b){b.addEventListener('click',async function(){
        if(await confirmDialog('Unpublish product?','It will no longer be visible in the store. Existing owners keep access.',true)){
          try{await api('DELETE','/admin/products/'+b.getAttribute('data-del'));toast('Unpublished','ok');load();}catch(e){toast(e.message,'err');}
        }});});
    }
    qs('#pq').addEventListener('input',draw);
    qs('#add-p').addEventListener('click',function(){editProduct(null);});
    load();
  }
  function editProduct(p){
    var m=modal(p?'Edit product':'New product',
      '<div class="grid2">'+
      '<div class="field"><label>Title</label><input class="input" id="f-title" value="'+esc(p?p.title:'')+'"></div>'+
      '<div class="field"><label>Slug</label><input class="input" id="f-slug" value="'+esc(p?p.slug:'')+'"></div>'+
      '<div class="field"><label>Subtitle</label><input class="input" id="f-sub" value="'+esc(p?p.subtitle:'')+'"></div>'+
      '<div class="field"><label>Category</label><input class="input" id="f-cat" value="'+esc(p?p.category:'')+'"></div>'+
      '<div class="field"><label>Language</label><input class="input" id="f-lang" value="'+(esc(p?p.language:'English'))+'"></div>'+
      '<div class="field"><label>Price (₹)</label><input class="input" id="f-price" type="number" value="'+(p?(p.price_paise/100):0)+'"></div>'+
      '<div class="field"><label>MRP (₹)</label><input class="input" id="f-mrp" type="number" value="'+(p?(p.mrp_paise/100):0)+'"></div>'+
      '<div class="field"><label>Pages</label><input class="input" id="f-pages" type="number" value="'+(p?p.page_count:0)+'"></div>'+
      '<div class="field"><label>Access duration (days, 0=lifetime)</label><input class="input" id="f-days" type="number" value="'+(p?p.access_duration_days:0)+'"></div>'+
      '</div>'+
      '<div class="field"><label>Description</label><textarea id="f-desc" rows="3">'+esc(p?p.description:'')+'</textarea></div>'+
      '<div class="grid2">'+
      '<label class="row gap8"><input type="checkbox" id="f-pub" '+(p&&p.is_published?'checked':'')+'> Published</label>'+
      '<label class="row gap8"><input type="checkbox" id="f-vip" '+(p&&p.is_vip?'checked':'')+'> VIP</label>'+
      '<label class="row gap8"><input type="checkbox" id="f-dl" '+(p&&p.download_allowed?'checked':'')+'> Allow download</label>'+
      '</div>'+
      '<div class="divider" style="height:1px;background:var(--border);margin:12px 0"></div>'+
      '<div class="grid2">'+
      '<div class="field"><label>PDF file</label><input type="file" id="f-pdf" accept="application/pdf"><div class="tiny muted" id="pdf-st">'+(p?'current: '+esc(p.pdf_path):'required')+'</div></div>'+
      '<div class="field"><label>Cover image</label><input type="file" id="f-cover" accept="image/*"><div class="tiny muted" id="cover-st">'+(p&&p.thumbnail_path?'current: '+esc(p.thumbnail_path):'optional')+'</div></div>'+
      '</div>',
      '<div class="row gap8" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-cancel>Cancel</button><button class="btn" data-save>Save</button></div>');
    qs('[data-cancel]',m.el).addEventListener('click',m.close);
    qs('[data-save]',m.el).addEventListener('click',async function(){
      try{
        var pdfPath=p?p.pdf_path:''; var cover=p?p.thumbnail_path:null; var size=p?p.file_size_bytes:0; var sha=p?p.pdf_sha256:null;
        var pdfFile=qs('#f-pdf').files[0];
        if(pdfFile){var r=await upload('/admin/products/upload-pdf',pdfFile,'file');pdfPath=r.pdf_path;size=r.file_size_bytes;sha=r.pdf_sha256;qs('#pdf-st').textContent='uploaded';}
        var coverFile=qs('#f-cover').files[0];
        if(coverFile){var rc=await upload('/admin/products/upload-cover',coverFile,'file');cover=rc.thumbnail_path;qs('#cover-st').textContent='uploaded';}
        if(!pdfPath){toast('A PDF file is required','err');return;}
        var body={title:qs('#f-title').value,slug:qs('#f-slug').value||slugify(qs('#f-title').value),subtitle:qs('#f-sub').value,
          category:qs('#f-cat').value||'General',language:qs('#f-lang').value||'English',
          price_paise:Math.round(parseFloat(qs('#f-price').value||'0')*100),mrp_paise:Math.round(parseFloat(qs('#f-mrp').value||'0')*100),
          page_count:parseInt(qs('#f-pages').value||'0',10),access_duration_days:parseInt(qs('#f-days').value||'0',10),
          description:qs('#f-desc').value,is_published:qs('#f-pub').checked?1:0,is_vip:qs('#f-vip').checked?1:0,download_allowed:qs('#f-dl').checked?1:0,
          pdf_path:pdfPath,thumbnail_path:cover,file_size_bytes:size,pdf_sha256:sha,currency:'INR'};
        if(p) await api('PATCH','/admin/products/'+p.id,body); else await api('POST','/admin/products',body);
        toast('Saved','ok'); m.close(); go('products');
      }catch(e){toast(e.message,'err');}
    });
  }
  function slugify(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,60)+'-'+Math.random().toString(36).slice(2,6);}

  /* ---------- Orders ---------- */
  async function orders(){
    var m=qs('#main');
    m.innerHTML='<div class="row gap8 mb12" id="ofilter">'+['all','pending','paid','failed','refunded'].map(function(s,i){return '<button class="btn sm '+(i===0?'':'ghost')+'" data-f="'+s+'">'+s+'</button>';}).join('')+'</div><div class="card pad0"><div class="tablewrap" id="ot"><div class="spinner"></div></div></div>';
    var filter='all';
    async function load(){
      qs('#ot').innerHTML='<div class="spinner"></div>';
      try{var list=(await api('GET','/admin/orders'+(filter!=='all'?('?status='+filter):''))).orders||[];
        qs('#ot').innerHTML=list.length?('<table><thead><tr><th>Code</th><th>Status</th><th>Method</th><th>Total</th><th>Items</th><th>Date</th><th></th></tr></thead><tbody>'+
          list.map(function(o){return '<tr><td class="mono">'+esc(o.order_code)+'</td><td>'+statusBadge(o.status)+'</td><td>'+esc(o.payment_method)+'</td><td class="mono">'+money(o.total_paise,o.currency)+'</td><td>'+o.items.length+'</td><td class="tiny muted">'+new Date(o.created_at).toLocaleString()+'</td>'+
            '<td style="white-space:nowrap"><button class="btn sm soft" data-view="'+o.id+'">View</button>'+(o.status==='paid'?' <button class="btn sm danger" data-refund="'+o.id+'">Refund</button>':'')+'</td></tr>';}).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No orders.</div>';
        qsa('[data-view]').forEach(function(b){b.addEventListener('click',function(){viewOrder(list.filter(function(o){return o.id==b.getAttribute('data-view');})[0]);});});
        qsa('[data-refund]').forEach(function(b){b.addEventListener('click',async function(){
          if(await confirmDialog('Refund order?','Credits the total to the user wallet and revokes PDF access.',true)){
            try{await api('POST','/admin/orders/'+b.getAttribute('data-refund')+'/refund',{});toast('Refunded','ok');load();}catch(e){toast(e.message,'err');}
          }});});
      }catch(e){qs('#ot').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    }
    qsa('#ofilter [data-f]').forEach(function(b){b.addEventListener('click',function(){filter=b.getAttribute('data-f');qsa('#ofilter .btn').forEach(function(x){x.classList.add('ghost');});b.classList.remove('ghost');load();});});
    load();
  }
  function viewOrder(o){
    modal('Order '+o.order_code,
      '<div class="row between"><span class="dim">Status</span>'+statusBadge(o.status)+'</div>'+
      '<div class="row between mt8"><span class="dim">Method</span><span>'+esc(o.payment_method)+'</span></div>'+
      '<div class="row between mt8"><span class="dim">Total</span><span class="b mono">'+money(o.total_paise,o.currency)+'</span></div>'+
      '<div class="row between mt8"><span class="dim">Wallet applied</span><span class="mono">'+money(o.wallet_applied_paise)+'</span></div>'+
      '<div class="divider" style="height:1px;background:var(--border);margin:12px 0"></div>'+
      '<h3>Items</h3>'+(o.items||[]).map(function(it){return '<div class="row between"><span>'+esc(it.title)+'</span><span class="mono">'+money(it.price_paise)+'</span></div>';}).join(''),
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-x>Close</button></div>');
  }
  function statusBadge(s){var map={paid:'green',pending:'amber',failed:'red',refunded:'slate',cancelled:'red'};return '<span class="badge '+(map[s]||'slate')+'">'+esc(s)+'</span>';}

  /* ---------- Users ---------- */
  async function users(){
    var m=qs('#main');
    m.innerHTML='<div class="row gap8 mb12"><input class="input" id="uq" placeholder="Search name/email/phone…" style="max-width:300px"></div><div class="card pad0"><div class="tablewrap" id="ut"><div class="spinner"></div></div></div>';
    var rows=[];
    async function load(){
      try{rows=(await api('GET','/admin/users')).users||[];draw();}catch(e){qs('#ut').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    }
    function draw(){
      var q=(qs('#uq').value||'').toLowerCase();
      var list=rows.filter(function(u){return !q||(u.name||'').toLowerCase().indexOf(q)>=0||(u.email||'').toLowerCase().indexOf(q)>=0;});
      qs('#ut').innerHTML=list.length?('<table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Wallet</th><th>Credits</th><th>VIP</th><th></th></tr></thead><tbody>'+
        list.map(function(u){return '<tr><td class="wrap">'+esc(u.name)+(u.role==='admin'?' <span class="badge blue">admin</span>':'')+'</td><td class="wrap">'+esc(u.email)+'</td>'+
          '<td><span class="badge '+(u.status==='active'?'green':(u.status==='suspended'?'amber':'red'))+'">'+esc(u.status)+'</span></td>'+
          '<td class="mono">'+money(u.wallet_balance_paise)+'</td><td class="mono">'+u.ai_credit_balance+'</td>'+
          '<td>'+(u.vip_active?'<span class="badge amber">VIP</span>':'')+'</td>'+
          '<td><button class="btn sm soft" data-user="'+u.id+'">Manage</button></td></tr>';}).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No users.</div>';
      qsa('[data-user]').forEach(function(b){b.addEventListener('click',function(){manageUser(list.filter(function(u){return u.id==b.getAttribute('data-user');})[0]);});});
    }
    qs('#uq').addEventListener('input',draw);
    load();
  }
  async function manageUser(u){
    var full, allProducts = [];
    try {
      var r = await Promise.all([
        api('GET', '/admin/users/' + u.id),
        api('GET', '/admin/products').catch(function(){ return { products: [] }; })
      ]);
      full = r[0].user;
      allProducts = (r[1] && r[1].products) || [];
    } catch(e) { return toast(e.message, 'err'); }

    var productOptions = '<option value="">-- Choose Product to Grant/Revoke --</option>' +
      allProducts.map(function(p){
        return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.title) + ' (' + money(p.price_paise) + ')</option>';
      }).join('');

    var m = modal('Manage ' + full.name,
      '<div class="grid2">'+
      '<div class="card"><div class="tiny muted">Store Wallet</div><div class="b mono" id="m-wbal" style="font-size:1.3rem;margin:4px 0 8px">'+money(full.wallet_balance_paise)+'</div>'+
        '<div class="row gap8"><input class="input" id="wa" type="number" placeholder="± paise (e.g. 5000 = ₹50)"><button class="btn sm" id="wa-apply">Adjust</button></div>'+
        '<div class="row gap8 mt8">'+
          '<button class="btn sm ghost" data-wquick="5000">+₹50</button>'+
          '<button class="btn sm ghost" data-wquick="10000">+₹100</button>'+
          '<button class="btn sm ghost" data-wquick="50000">+₹500</button>'+
          '<button class="btn sm ghost" data-wquick="-5000">-₹50</button>'+
        '</div>'+
      '</div>'+
      '<div class="card"><div class="tiny muted">AI Credits Balance</div><div class="b mono" id="m-cbal" style="font-size:1.3rem;margin:4px 0 8px">'+full.ai_credit_balance+'</div>'+
        '<div class="row gap8"><input class="input" id="ca" type="number" placeholder="± credits"><button class="btn sm" id="ca-apply">Adjust</button></div>'+
        '<div class="row gap8 mt8">'+
          '<button class="btn sm ghost" data-cquick="50">+50</button>'+
          '<button class="btn sm ghost" data-cquick="100">+100</button>'+
          '<button class="btn sm ghost" data-cquick="500">+500</button>'+
          '<button class="btn sm ghost" data-cquick="-50">-50</button>'+
        '</div>'+
      '</div>'+
      '</div>'+
      '<div class="card"><h3>Account status</h3><div class="row gap8">'+
        '<button class="btn sm '+(full.status==='active'?'':'ghost')+'" data-status="active"><i class="fas fa-check"></i> Active</button>'+
        '<button class="btn sm '+(full.status==='suspended'?'':'ghost')+'" data-status="suspended"><i class="fas fa-ban"></i> Suspend</button>'+
        '<button class="btn sm '+(full.status==='disabled'?'':'ghost')+'" data-status="disabled"><i class="fas fa-user-xmark"></i> Disable</button>'+
      '</div></div>'+
      '<div class="card"><h3>PDF & Material Access</h3>'+
        '<div class="row gap8"><select class="input" id="ppid">'+productOptions+'</select><button class="btn sm soft" id="grant"><i class="fas fa-key"></i> Grant</button><button class="btn sm danger" id="revoke"><i class="fas fa-trash"></i> Revoke</button></div>'+
        '<div class="mt8 small" id="pdf-access-list">'+((full.pdf_access||[]).map(function(a){return '<div class="row between" style="padding:4px 0;border-bottom:1px solid var(--border)"><span>#'+a.id+' '+esc(a.title)+'</span><span class="badge '+(a.status==='active'?'green':'red')+'">'+a.status+'</span></div>';}).join('')||'<span class="muted">No current active licenses.</span>')+'</div>'+
      '</div>'+
      '<div class="card"><h3>VIP Pass Access</h3><div class="row gap8"><input class="input" id="vpid" type="number" placeholder="Plan ID (e.g. 1)"><button class="btn sm" id="grant-vip"><i class="fas fa-crown"></i> Grant VIP</button></div></div>'+
      '<div class="card"><h3>Direct In-App Notification</h3><input class="input" id="nt" placeholder="Notification Title"><textarea id="nb" rows="2" class="input mt8" placeholder="Message Body"></textarea><button class="btn sm soft mt8" id="send-n"><i class="fas fa-paper-plane"></i> Send Notification</button></div>',
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-x>Close</button></div>');

    qs('[data-x]',m.el).addEventListener('click',m.close);
    qsa('[data-status]',m.el).forEach(function(b){b.addEventListener('click',async function(){
      try{await api('POST','/admin/users/'+full.id+'/status',{status:b.getAttribute('data-status'),reason:'admin action'});toast('Status updated','ok');m.close();go('users');}catch(e){toast(e.message,'err');}
    });});

    async function adjustW(amt){
      try{
        var r=await api('POST','/admin/users/'+full.id+'/wallet',{amount_paise:amt,reason:'manual adjustment'});
        toast('New wallet balance '+money(r.balance_paise),'ok');
        full.wallet_balance_paise = r.balance_paise;
        qs('#m-wbal',m.el).textContent = money(r.balance_paise);
      }catch(e){toast(e.message,'err');}
    }
    qs('#wa-apply',m.el).addEventListener('click',function(){adjustW(parseInt(qs('#wa',m.el).value||'0',10));});
    qsa('[data-wquick]',m.el).forEach(function(b){b.addEventListener('click',function(){adjustW(parseInt(b.getAttribute('data-wquick'),10));});});

    async function adjustC(amt){
      try{
        var r=await api('POST','/admin/users/'+full.id+'/credits',{amount:amt,reason:'manual adjustment'});
        toast('New AI credits: '+r.balance,'ok');
        full.ai_credit_balance = r.balance;
        qs('#m-cbal',m.el).textContent = r.balance;
      }catch(e){toast(e.message,'err');}
    }
    qs('#ca-apply',m.el).addEventListener('click',function(){adjustC(parseInt(qs('#ca',m.el).value||'0',10));});
    qsa('[data-cquick]',m.el).forEach(function(b){b.addEventListener('click',function(){adjustC(parseInt(b.getAttribute('data-cquick'),10));});});

    qs('#grant',m.el).addEventListener('click',async function(){
      var pid = parseInt(qs('#ppid',m.el).value||'0',10);
      if(!pid){toast('Select a product to grant','err');return;}
      try{await api('POST','/admin/users/'+full.id+'/pdf/grant',{product_id:pid});toast('Access granted','ok');m.close();manageUser(u);}catch(e){toast(e.message,'err');}
    });
    qs('#revoke',m.el).addEventListener('click',async function(){
      var pid = parseInt(qs('#ppid',m.el).value||'0',10);
      if(!pid){toast('Select a product to revoke','err');return;}
      try{await api('POST','/admin/users/'+full.id+'/pdf/revoke',{product_id:pid});toast('Access revoked','ok');m.close();manageUser(u);}catch(e){toast(e.message,'err');}
    });
    qs('#grant-vip',m.el).addEventListener('click',async function(){try{await api('POST','/admin/users/'+full.id+'/vip',{plan_id:parseInt(qs('#vpid',m.el).value||'0',10)});toast('VIP granted','ok');}catch(e){toast(e.message,'err');}});
    qs('#send-n',m.el).addEventListener('click',async function(){try{await api('POST','/admin/notify',{user_id:full.id,category:'system',title:qs('#nt',m.el).value,body:qs('#nb',m.el).value});toast('Notification sent','ok');}catch(e){toast(e.message,'err');}});
  }

  /* ---------- Support ---------- */
  async function support(){
    var m=qs('#main');
    m.innerHTML='<div class="card pad0"><div class="tablewrap" id="st"><div class="spinner"></div></div></div>';
    try{
      var threads=(await api('GET','/admin/support')).threads||[];
      qs('#st').innerHTML=threads.length?('<table><thead><tr><th>ID</th><th>Subject</th><th>Status</th><th>Last</th><th></th></tr></thead><tbody>'+
        threads.map(function(t){return '<tr><td class="mono">'+t.id+'</td><td class="wrap">'+esc(t.subject)+'</td><td><span class="badge blue">'+esc(t.status)+'</span></td><td class="tiny muted">'+(t.last_message_at?new Date(t.last_message_at).toLocaleString():'')+'</td><td><button class="btn sm soft" data-t="'+t.id+'">Open</button></td></tr>';}).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No support threads.</div>';
      qsa('[data-t]').forEach(function(b){b.addEventListener('click',function(){openThread(parseInt(b.getAttribute('data-t'),10));});});
    }catch(e){qs('#st').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
  }
  async function openThread(id){
    var data;try{data=await api('GET','/admin/support/'+id);}catch(e){return toast(e.message,'err');}
    var m=modal('Conversation #'+id,
      '<div style="max-height:46vh;overflow:auto">'+(data.messages||[]).map(function(msg){
        var who=msg.sender==='admin'?'You':(msg.sender==='user'?'User':'AI');
        return '<div class="card" style="margin-bottom:8px"><div class="tiny muted">'+who+' · '+new Date(msg.created_at).toLocaleString()+'</div><div style="white-space:pre-wrap">'+esc(msg.body)+'</div></div>';
      }).join('')+'</div>'+
      '<div class="row gap8 mt8"><input class="input" id="reply" placeholder="Type a reply…"><button class="btn" id="send">Send</button></div>'+
      '<div class="row gap8 mt8">'+['resolved','waiting_user','closed','open'].map(function(s){return '<button class="btn sm ghost" data-st="'+s+'">'+s+'</button>';}).join('')+'</div>',
      '<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn ghost" data-x>Close</button></div>');
    qs('[data-x]',m.el).addEventListener('click',m.close);
    qs('#send',m.el).addEventListener('click',async function(){var v=qs('#reply',m.el).value.trim();if(!v)return;try{await api('POST','/admin/support/'+id+'/reply',{message:v});toast('Reply sent','ok');m.close();openThread(id);}catch(e){toast(e.message,'err');}});
    qsa('[data-st]',m.el).forEach(function(b){b.addEventListener('click',async function(){try{await api('POST','/admin/support/'+id+'/status',{status:b.getAttribute('data-st')});toast('Status set','ok');m.close();go('support');}catch(e){toast(e.message,'err');}});});
  }

  /* ---------- Notifications ---------- */
  async function notifications(){
    var m=qs('#main');
    m.innerHTML='<div class="grid2">'+
      '<div class="card"><h3>Notify a user</h3><input class="input" id="nu" type="number" placeholder="User ID"><input class="input mt8" id="nti" placeholder="Title"><textarea id="nb" rows="3" class="mt8" placeholder="Body"></textarea><button class="btn mt8" id="send-u">Send</button></div>'+
      '<div class="card"><h3>Broadcast to all users</h3><input class="input" id="bt" placeholder="Title"><textarea id="bb" rows="3" class="mt8" placeholder="Body"></textarea><button class="btn mt8" id="send-b">Broadcast</button></div>'+
      '</div>';
    qs('#send-u',m).addEventListener('click',async function(){try{await api('POST','/admin/notify',{user_id:parseInt(qs('#nu',m).value||'0',10),category:'system',title:qs('#nti',m).value,body:qs('#nb',m).value});toast('Sent','ok');}catch(e){toast(e.message,'err');}});
    qs('#send-b',m).addEventListener('click',async function(){try{await api('POST','/admin/broadcast',{category:'product',title:qs('#bt',m).value,body:qs('#bb',m).value});toast('Broadcast sent','ok');}catch(e){toast(e.message,'err');}});
  }

  /* ---------- VIP ---------- */
  async function vip(){
    var m=qs('#main');
    m.innerHTML='<div class="card pad0"><div class="tablewrap" id="vt"><div class="spinner"></div></div></div>';
    try{
      var plans=(await api('GET','/admin/vip/plans')).plans||[];
      qs('#vt').innerHTML='<table><thead><tr><th>Code</th><th>Name</th><th>Interval</th><th>Price</th><th>Active</th></tr></thead><tbody>'+
        plans.map(function(p){return '<tr><td class="mono">'+esc(p.code)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.interval)+'</td><td class="mono">'+money(p.price_paise)+'</td><td><span class="badge '+(p.is_active?'green':'slate')+'">'+(p.is_active?'yes':'no')+'</span></td></tr>';}).join('')+'</tbody></table>';
    }catch(e){qs('#vt').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
  }

  /* ---------- Settings ---------- */
  async function settings(){
    var m=qs('#main');
    m.innerHTML='<div class="card"><div id="sf"><div class="spinner"></div></div><button class="btn mt16" id="save-s">Save settings</button></div>';
    var s;try{s=(await api('GET','/admin/settings')).settings||{};}catch(e){return qs('#sf').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    var fields=['support_email','telegram','telegram_channel','instagram','youtube','whatsapp_channel','whatsapp_support_enabled','whatsapp_support_link','trial_ai_credits','ai_credit_cost_study','ai_credit_cost_support','ai_credit_cost_help','brand_powered_by'];
    qs('#sf').innerHTML='<div class="grid2">'+fields.map(function(f){
      var v=s[f]!==undefined?s[f]:'';
      if(f==='whatsapp_support_enabled')return '<div class="field"><label>'+f+'</label><select class="input" data-k="'+f+'"><option value="0"'+(v==='0'?' selected':'')+'>OFF (default)</option><option value="1"'+(v==='1'?' selected':'')+'>ON</option></select></div>';
      return '<div class="field"><label>'+f+'</label><input class="input" data-k="'+f+'" value="'+esc(v)+'"></div>';
    }).join('')+'</div><div class="tiny muted">WhatsApp Support is OFF by default. Destination is admin-configured only.</div>';
    qs('#save-s',m).addEventListener('click',async function(){
      var out={};qsa('[data-k]',m).forEach(function(el){out[el.getAttribute('data-k')]=el.value;});
      try{await api('POST','/admin/settings',{settings:out});toast('Settings saved','ok');}catch(e){toast(e.message,'err');}
    });
  }

  /* ---------- Credit packs ---------- */
  async function packs(){
    var m=qs('#main');
    m.innerHTML='<div class="row between mb12"><div class="dim small">AI credit bundles sold for cash — separate ledger from the Store Wallet.</div>'+
      '<button class="btn" id="add-pack">'+icon('plus')+' New pack</button></div>'+
      '<div class="card pad0"><div class="tablewrap" id="pkt"><div class="spinner"></div></div></div>';
    async function load(){
      try{
        var list=(await api('GET','/admin/credits/packs')).packs||[];
        qs('#pkt').innerHTML=list.length?('<table><thead><tr><th>Code</th><th>Name</th><th>Credits</th><th>Bonus</th><th>Price</th><th>Active</th><th></th></tr></thead><tbody>'+
          list.map(function(p){
            return '<tr><td class="mono">'+esc(p.code)+'</td><td>'+esc(p.name)+'</td><td>'+p.credits+'</td><td>'+(p.bonus_credits||0)+'</td>'+
            '<td class="mono">'+money(p.price_paise,p.currency)+'</td><td><span class="badge '+(p.is_active?'green':'slate')+'">'+(p.is_active?'yes':'no')+'</span></td>'+
            '<td style="white-space:nowrap"><button class="btn sm soft" data-edit="'+p.id+'">Edit</button> '+
            '<button class="btn sm ghost" data-arch="'+p.id+'">'+(p.is_active?'Archive':'Restore')+'</button></td></tr>';
          }).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No credit packs yet.</div>';
        qsa('[data-edit]',m).forEach(function(b){b.addEventListener('click',function(){
          edit(list.filter(function(x){return String(x.id)===String(b.getAttribute('data-edit'));})[0]);});});
        qsa('[data-arch]',m).forEach(function(b){b.addEventListener('click',async function(){
          var p=list.filter(function(x){return String(x.id)===String(b.getAttribute('data-arch'));})[0];
          try{await api('PATCH','/admin/credits/packs/'+p.id,{is_active:p.is_active?0:1});toast('Pack updated','ok');load();}
          catch(e){toast(e.message,'err');}
        });});
      }catch(e){qs('#pkt').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
    }
    function edit(p){
      var isNew=!p;
      p=p||{code:'',name:'',credits:100,bonus_credits:0,price_paise:19900,currency:'INR'};
      var mm=modal(isNew?'New credit pack':'Edit pack',
        '<div class="grid2">'+
        '<div class="field"><label>Name</label><input class="input" id="pk-name" value="'+esc(p.name)+'" placeholder="Starter 100"></div>'+
        '<div class="field"><label>Code</label><input class="input" id="pk-code" value="'+esc(p.code)+'" placeholder="pack_starter"'+(isNew?'':' disabled')+'></div>'+
        '<div class="field"><label>Credits</label><input class="input" id="pk-credits" type="number" min="1" value="'+p.credits+'"></div>'+
        '<div class="field"><label>Bonus credits</label><input class="input" id="pk-bonus" type="number" min="0" value="'+(p.bonus_credits||0)+'"></div>'+
        '<div class="field"><label>Price (₹)</label><input class="input" id="pk-price" type="number" min="1" step="0.01" value="'+((p.price_paise||0)/100)+'"></div>'+
        '</div><div class="tiny muted">Purchases settle server-side via Cashfree before credits are granted.</div>',
        '<div class="row gap8" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-cancel>Cancel</button><button class="btn" data-save>Save</button></div>');
      qs('[data-cancel]',mm.el).addEventListener('click',mm.close);
      qs('[data-save]',mm.el).addEventListener('click',async function(){
        var body={
          name:qs('#pk-name',mm.el).value.trim(),
          credits:parseInt(qs('#pk-credits',mm.el).value||'0',10),
          bonus_credits:parseInt(qs('#pk-bonus',mm.el).value||'0',10),
          price_paise:Math.round(parseFloat(qs('#pk-price',mm.el).value||'0')*100)
        };
        if(isNew)body.code=qs('#pk-code',mm.el).value.trim();
        if(!body.name||body.credits<=0||body.price_paise<=0){toast('Name, credits and price are required','err');return;}
        try{
          await api(isNew?'POST':'PATCH',isNew?'/admin/credits/packs':'/admin/credits/packs/'+p.id,body);
          toast('Pack saved','ok');mm.close();load();
        }catch(e){toast(e.message,'err');}
      });
    }
    qs('#add-pack',m).addEventListener('click',function(){edit(null);});
    load();
  }

  /* ---------- Audit ---------- */
  async function audit(){
    var m=qs('#main');
    m.innerHTML='<div class="card pad0"><div class="tablewrap" id="at"><div class="spinner"></div></div></div>';
    try{
      var logs=(await api('GET','/admin/audit')).logs||[];
      qs('#at').innerHTML=logs.length?('<table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>'+
        logs.map(function(l){return '<tr><td class="tiny muted">'+new Date(l.created_at).toLocaleString()+'</td><td class="wrap">'+esc(l.actor_name||l.actor_email||'system')+'</td><td>'+esc(l.action)+'</td><td>'+esc(l.entity)+' '+(l.entity_id?('#'+l.entity_id):'')+'</td></tr>';}).join('')+'</tbody></table>'):'<div class="muted" style="padding:16px">No audit entries.</div>';
    }catch(e){qs('#at').innerHTML='<div class="badge red">'+esc(e.message)+'</div>';}
  }

  document.addEventListener('DOMContentLoaded',boot);
})();
