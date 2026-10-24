const app = document.getElementById('app');
const bar = document.getElementById('bar');
const menu = document.getElementById('menu');
const pickBtn = document.getElementById('pick');

// ---------- 图标：线稿 SVG（主站规则：界面不出现 emoji） ----------

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const WEATHERS = {
  sunny: ['晴天', svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>')],
  cloudy: ['多云', svg('<path d="M8 6.5a3.5 3.5 0 0 1 6.4-.9"/><path d="M4 7.5l1 .4M7 3l.4 1"/><path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 9.5 4.25 4.25 0 0 0 7 18z"/>')],
  rainy: ['下雨', svg('<path d="M7 15h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>')],
  stormy: ['打雷', svg('<path d="M7 15h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>')],
  rainbow: ['彩虹', svg('<path d="M2.5 17a9.5 9.5 0 0 1 19 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M9.5 17a2.5 2.5 0 0 1 5 0"/>')],
  snowy: ['下雪', svg('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>')],
};
const ICON = {
  x: svg('<path d="M6 6l12 12M18 6L6 18" stroke-width="2"/>'),
  camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  heartOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  drop: svg('<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
const CATEGORIES = {
  allergy: ['过敏', '千万别碰'],
  avoid: ['忌口', '不吃的'],
  love: ['最爱吃', '想哄 TA 的时候'],
  dislike: ['不太爱吃', '能吃但不喜欢'],
  habit: ['小习惯', '少冰、不要葱这类'],
};
const USERS = ['raven', 'billy'];
const other = (u) => (u === 'raven' ? 'billy' : 'raven');
const TABS = {
  home: ['HOME', '首页'], juice: ['JUICE', '果蔬汁'], ask: ['ASK', '每日一问'], plant: ['PLANT', '我们的植物'],
  map: ['MAP', '地图和愿望'], capsule: ['CAPSULE', '时光胶囊'], manual: ['MANUAL', '对方说明书'], year: ['YEAR', '恋爱年报'],
};

let me = null;
let names = { raven: 'Raven', billy: 'Billy' };
let R = null; // 配方数据 { juices, notes }，和主站 Wellness 同一份
const recipeById = (id) => R?.juices.find((r) => r.id === id);

// ---------- 小工具 ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const nm = (u) => esc(u === 'both' ? '我们俩' : names[u]);

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    me = null;
    renderLogin();
    throw new Error('请先登录');
  }
  if (!res.ok) throw new Error(data.error || '出错了');
  return data;
}
const post = (path, body = {}) => api(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const remove = (path) => api(path, { method: 'DELETE' });

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function fmtDay(day) {
  if (!day) return '';
  const [y, m, d] = day.split('-');
  return `${y !== todayStr().slice(0, 4) ? `${y}年` : ''}${Number(m)}月${Number(d)}日`;
}

// 居中弹窗：遮罩、×、Esc 都能关，打开时背景不滚；onOpen 可以在关之前读弹窗里的输入
function dialog(inner, { wide = false, onOk } = {}) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'mask';
    mask.innerHTML = `<div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <button class="close" type="button" aria-label="关闭">${ICON.x}</button>${inner}</div>`;
    const done = (v) => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      mask.remove();
      resolve(v);
    };
    const onKey = (e) => e.key === 'Escape' && done(false);
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('.close,[data-a=no]')) done(false);
      if (e.target.closest('[data-a=ok]')) done(onOk ? onOk(mask) : true);
    });
    document.addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    document.body.appendChild(mask);
    mask.querySelector('input')?.focus();
  });
}
const confirmBox = (title, text, okLabel) => dialog(`<h3>${esc(title)}</h3><p>${esc(text)}</p>
  <div class="acts"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">${esc(okLabel)}</button></div>`);

// 整块重画时保住滚动位置，点了东西不跳到顶部
function paint(html) {
  const y = scrollY;
  app.innerHTML = html;
  scrollTo(0, y);
}

// 内页窗口：白底 + 48 高黑色页眉条，right 是页眉条右边的按钮
const win = (title, sub, body, right = '') => `
  <section class="win">
    <div class="win-h"><h2>${title}</h2><span>${sub}</span>${right}</div>
    <div class="win-b">${body}</div>
  </section>`;

// 上传前压缩到长边 1280，跨境访问也快
async function compress(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

// 选照片后在小方框里预览，返回取压缩后图片的函数
function photoPicker(root) {
  let blob = null;
  const input = root.querySelector('input[type=file]');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    blob = await compress(file);
    root.querySelector('.ph').innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
    root.querySelector('.shot-t').textContent = '换一张';
  });
  return () => blob;
}
const shotField = (label) => `<label class="shot"><span class="ph">${ICON.camera}</span><span class="shot-t">${label}</span>
  <input type="file" accept="image/*" hidden></label>`;

async function loadRecipes() {
  if (!R) R = await fetch('/recipes/juices.json').then((r) => r.json()).catch(() => ({ juices: [], notes: [] }));
}

async function ensureMe() {
  if (!me) {
    const h = await api('/home');
    me = h.me;
    names = h.names;
  }
}

// ---------- 路由和导航 ----------

const routes = {
  '': renderHome, juice: renderJuice, ask: renderAsk, plant: renderPlant,
  map: renderMap, capsule: renderCapsule, manual: renderManual, year: renderYear,
};
let lastRoute = null;

async function router() {
  const name = location.hash.replace(/^#\/?/, '');
  const tab = routes[name] ? name || 'home' : 'home';
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  pickBtn.querySelector('span').textContent = TABS[tab][0];
  menu.hidden = true;
  if (lastRoute !== tab) scrollTo(0, 0);
  lastRoute = tab;
  try {
    await (routes[name] || renderHome)();
  } catch (err) {
    if (me) toast(err.message);
  }
}

bar.querySelector('.tabs').innerHTML = Object.entries(TABS)
  .map(([k, [en]]) => `<a href="#/${k === 'home' ? '' : k}" data-tab="${k}">${en}</a>`).join('');
menu.innerHTML = Object.entries(TABS)
  .map(([k, [en, zh]]) => `<a href="#/${k === 'home' ? '' : k}" data-tab="${k}">${en}<small>${zh}</small></a>`).join('');
window.addEventListener('hashchange', router);
pickBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true;
});
document.getElementById('logout').addEventListener('click', async () => {
  await post('/logout');
  me = null;
  renderLogin();
});

// ---------- 登录 ----------

function renderLogin() {
  bar.hidden = true;
  let pick = localStorage.getItem('lastUser') || '';
  app.innerHTML = `
    <section class="hero">
      <h1>Raven &amp; Billy</h1>
      <p class="tag">Home is wherever we are.</p>
      <form class="box" id="login" style="max-width:420px">
        <div class="box-h"><i></i>你是谁</div>
        <div class="well">
          <div class="who">${USERS.map((u) => `<button type="button" data-u="${u}">${esc(names[u])}</button>`).join('')}</div>
          <div class="row">
            <input type="password" name="password" placeholder="密码" autocomplete="current-password">
            <button class="btn dark">回家</button>
          </div>
        </div>
      </form>
    </section>`;
  const mark = () => app.querySelectorAll('.who button').forEach((b) => b.classList.toggle('on', b.dataset.u === pick));
  mark();
  app.querySelectorAll('.who button').forEach((b) => b.addEventListener('click', () => {
    pick = b.dataset.u;
    mark();
    app.querySelector('input').focus();
  }));
  app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pick) return toast('先选你是谁');
    try {
      await post('/login', { user: pick, password: e.target.password.value });
      localStorage.setItem('lastUser', pick);
      me = pick;
      lastRoute = null;
      router();
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- Home ----------

function juiceHint(j) {
  if (j.done.raven && j.done.billy) return '这一轮两个人都喝了';
  const left = j.daysLeft === 1 ? '今天是这一轮最后一天' : `这一轮还剩 ${j.daysLeft} 天`;
  const missing = USERS.filter((u) => !j.done[u]);
  if (missing.length === 2) return `${left}，两个人都还没喝`;
  return `${left}，等 ${nm(missing[0])} 喝一杯`;
}

function askHint(a) {
  if (a.done.raven && a.done.billy) return '两个人都答了，可以去看对方的答案';
  if (a.mine) return `你答了，等 ${nm(other(me))}`;
  if (a.done[other(me)]) return `${nm(other(me))} 已经答了，你答完就能看到`;
  return '两个人都还没答';
}

async function renderHome() {
  const data = await api('/home');
  me = data.me;
  names = data.names;
  bar.hidden = false;
  const { juice: j, ask: a, plant: p } = data;
  const mine = data.moods[me];
  const todayMine = mine && mine.day === data.today ? mine : null;

  const moodCard = (u) => {
    const m = data.moods[u];
    if (!m) return `<div class="mood">${WEATHERS.cloudy[1].replace('<svg', '<svg style="opacity:.25"')}<div><b>${nm(u)}</b><p>还没写心情</p></div></div>`;
    const [label, icon] = WEATHERS[m.weather];
    const when = m.day !== data.today ? `<small>${fmtDay(m.day)}</small>` : '';
    return `<div class="mood">${icon}<div><b>${nm(u)} · ${label}</b><p>${esc(m.note || '')}</p>${when}</div></div>`;
  };
  const dots = (done) => `<span class="dots">${USERS.map((u) => `<span class="${done[u] ? 'ok' : ''}">${nm(u)}</span>`).join('')}</span>`;
  const line = (href, k, v, hint, done) => `<a class="line" href="${href}">
    <span class="k">${k}</span><div class="v"><b>${v}</b><p>${hint}</p></div>${dots(done)}<i>${ICON.arrow}</i></a>`;

  paint(`
    <section class="hero">
      <h1>Raven &amp; Billy</h1>
      <p class="tag">${data.daysTogether === 1 ? 'Day 1 · 今天，我们在一起了' : `Day ${data.daysTogether} · 在一起的第 ${data.daysTogether} 天`}</p>

      <div class="box">
        <div class="box-h"><i></i>Today's weather<span>今天的心情天气</span></div>
        <div class="well">
          <div class="moods">${moodCard(me)}${moodCard(other(me))}</div>
          <div class="pills">
            ${Object.entries(WEATHERS).map(([k, [label, icon]]) =>
              `<button type="button" class="pill ${todayMine?.weather === k ? 'on' : ''}" data-w="${k}">${icon}${label}</button>`).join('')}
          </div>
          <form class="row mood-note" id="moodForm">
            <input type="text" id="moodNote" maxlength="80" placeholder="${todayMine ? '改一句今天想说的' : '先写一句想说的，再点天气'}" value="${esc(todayMine?.note || '')}">
            <button class="btn dark">保存</button>
          </form>
        </div>
      </div>

      <div class="box">
        <div class="box-h"><i></i>Today<span>今天的小事</span></div>
        <div class="well lines">
          ${line('#/ask', '每日一问', esc(a.question), askHint(a), a.done)}
          ${line('#/juice', '果蔬汁', `${j.streak} 轮连胜`, juiceHint(j), j.done)}
          ${line('#/plant', esc(p.name || '我们的植物'), esc(p.stageName), p.wilted ? `${p.idle} 天没人照顾，有点蔫了` : `成长值 ${p.points} · 今天浇水了吗`, p.wateredToday)}
        </div>
      </div>
    </section>`);

  app.querySelectorAll('.pill[data-w]').forEach((b) => b.addEventListener('click', async () => {
    await post('/mood', { weather: b.dataset.w, note: app.querySelector('#moodNote').value });
    toast('心情已更新');
    renderHome();
  }));
  app.querySelector('#moodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!todayMine) return toast('再点一个天气就保存好了');
    await post('/mood', { weather: todayMine.weather, note: app.querySelector('#moodNote').value });
    toast('心情已更新');
    renderHome();
  });
}

// ---------- Juice：照主站 Wellness 的「抗炎果蔬汁」栏目 ----------

let juiceTab = 'recipes';
let todayPick = '';

async function renderJuice() {
  const [list, shop] = await Promise.all([api('/juice'), api('/shop'), loadRecipes(), ensureMe()]);
  names = list.names;
  bar.hidden = false;
  const j = list.status;
  const picks = new Set(shop.picks);
  const counts = {};
  for (const c of list.items) counts[c.recipe_id] = (counts[c.recipe_id] || 0) + 1;
  const today = todayStr();

  const card = (r) => {
    const on = picks.has(r.id);
    const drankToday = list.items.some((c) => c.recipe_id === r.id && c.user === me && c.day === today);
    return `<article class="wl-card${todayPick === r.id ? ' today' : ''}" id="wl-${r.id}" style="--c:${r.color}">
      <div class="wl-ph"><img src="/recipes/${r.img}.webp" alt="${esc(r.name)}" loading="lazy" decoding="async"><span class="wl-for">${esc(r.for)}</span></div>
      <div class="wl-in">
        <div class="wl-top"><div><h3><i></i>${esc(r.name)}</h3><p class="wl-line">${esc(r.line)}</p></div>
          <button class="wl-pick${on ? ' on' : ''}" data-pick="${r.id}" aria-pressed="${on}">${on ? '已加入' : '加入清单'}</button></div>
        <div class="wl-tags"><span>${esc(r.time)}</span><span>${esc(r.taste)}</span><span>约 300ml</span></div>
        <h4>配料</h4><ul class="wl-ing">${r.ing.map((i) => `<li><span>${esc(i[0])}</span><b>${esc(i[1])}</b></li>`).join('')}</ul>
        <h4>做法</h4><ol class="wl-steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <p class="wl-key"><b>主要成分</b>${esc(r.key)}</p>
        ${r.care ? `<p class="wl-care"><b>注意</b>${esc(r.care)}</p>` : ''}
        <div class="wl-drank"><span>${counts[r.id] ? `我们喝过 ${counts[r.id]} 次` : '还没喝过'}</span>
          <button class="btn${drankToday ? '' : ' dark'}" data-drank="${r.id}" ${drankToday ? 'disabled' : ''}>${drankToday ? '今天喝过了' : '我喝了这杯'}</button></div>
      </div></article>`;
  };

  const shopList = shopping(picks);
  const recipesView = `
    <p class="intro">一人份、破壁机几分钟就能做完的抗炎果蔬汁。勾选几款「加入清单」，下面会合成一份两个人共用的购物清单；喝完在卡片上点「我喝了这杯」，每 ${j.cycleDays} 天两个人都喝过，这一轮就点亮。</p>
    <div class="wl-status">
      <span>本轮 ${fmtDay(j.cycleStart)} - ${fmtDay(j.cycleEnd)}</span>
      ${USERS.map((u) => `<b class="${j.done[u] ? 'ok' : ''}">${nm(u)} ${j.done[u] ? '已喝' : '还没喝'}</b>`).join('')}
      <em>${j.streak} 轮连胜 · 最长 ${j.best} 轮</em>
    </div>
    ${todayPick ? (() => { const r = recipeById(todayPick); return `<div class="wl-today" style="--c:${r.color}"><img src="/recipes/${r.img}.webp" alt=""><span>今天喝</span><b>${esc(r.name)}</b><em>${esc(r.line)}</em><button class="btn" data-today>换一款</button></div>`; })() : ''}
    <div class="wl-grid">${R.juices.map(card).join('')}</div>
    <section class="wl-shop"><h3>购物清单<span>${picks.size ? `已选 ${picks.size} 款 · 两个人看到的是同一份` : '在卡片上点「加入清单」'}</span>
      ${picks.size ? '<button class="btn" data-clear>清空</button><button class="btn" data-copy>复制清单</button>' : ''}</h3>
      ${shopList.length ? `<ul>${shopList.map((i) => `<li><span>${esc(i[0])}</span><b>${esc(i[1])}</b></li>`).join('')}</ul>` : ''}</section>
    <section class="wl-notes"><h3>喝之前知道</h3><ul>${(R.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`;

  const logView = list.items.length ? `<div class="log">${list.items.map((c) => {
    const r = recipeById(c.recipe_id);
    const mineCup = c.user === me;
    const like = mineCup
      ? (c.liked ? `<span class="like on">${ICON.heartOn}${nm(other(me))} 点了</span>` : '')
      : `<button class="like ${c.liked ? 'on' : ''}" data-like="${c.id}">${c.liked ? ICON.heartOn : ICON.heart}${c.liked ? '已点' : '点个爱心'}</button>`;
    const img = c.photo_key ? `/api/photo/${encodeURIComponent(c.photo_key)}` : r ? `/recipes/${r.img}.webp` : '';
    return `<div class="log-row" style="--c:${r ? r.color : '#898989'}">
      ${img ? `<img src="${img}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <div class="t"><b><i></i>${esc(c.recipe || r?.name || '一杯果蔬汁')}</b><span>${nm(c.user)} · ${fmtDay(c.day)}</span></div>
      ${like}
      ${mineCup ? `<button class="mini" data-undo="${c.id}">撤销</button>` : ''}
    </div>`;
  }).join('')}</div>` : '<p class="empty">还没有人喝过，第一杯是谁的？</p>';

  paint(win('Juice', `果蔬汁 · 每 ${j.cycleDays} 天一轮，两个人都喝过才点亮`, `
    <div class="seg">
      <button type="button" data-jtab="recipes" class="${juiceTab === 'recipes' ? 'on' : ''}">抗炎果蔬汁</button>
      <button type="button" data-jtab="log" class="${juiceTab === 'log' ? 'on' : ''}">喝过的 · ${list.items.length}</button>
    </div>
    ${juiceTab === 'recipes' ? recipesView : logView}`,
  '<button class="btn" data-today>今天喝什么</button>'));

  app.querySelectorAll('[data-jtab]').forEach((b) => b.addEventListener('click', () => {
    juiceTab = b.dataset.jtab;
    renderJuice();
  }));
  app.querySelectorAll('[data-today]').forEach((b) => b.addEventListener('click', async () => {
    let k;
    do k = R.juices[Math.floor(Math.random() * R.juices.length)].id; while (R.juices.length > 1 && k === todayPick);
    todayPick = k;
    juiceTab = 'recipes';
    await renderJuice();
    document.getElementById(`wl-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  app.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.pick;
    picks.has(id) ? picks.delete(id) : picks.add(id);
    await post('/shop', { picks: [...picks] });
    renderJuice();
  }));
  app.querySelector('[data-clear]')?.addEventListener('click', async () => {
    await post('/shop', { picks: [] });
    renderJuice();
  });
  app.querySelector('[data-copy]')?.addEventListener('click', () => {
    navigator.clipboard.writeText(shopList.map((i) => `${i[0]} ${i[1]}`).join('\n')).then(() => toast('清单已复制'));
  });
  app.querySelectorAll('[data-drank]').forEach((b) => b.addEventListener('click', async () => {
    const r = recipeById(b.dataset.drank);
    b.disabled = true;
    const res = await post('/juice', { recipe_id: r.id, recipe: r.name });
    toast(res.juice.done.raven && res.juice.done.billy ? '这一轮点亮了' : `记下了，等 ${names[other(me)]}`);
    renderJuice();
  }));
  app.querySelectorAll('[data-like]').forEach((b) => b.addEventListener('click', async () => {
    await post(`/juice/${b.dataset.like}/like`);
    renderJuice();
  }));
  app.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('撤销这一杯？', '这次记录会删掉，这一轮的状态也会跟着变。', '撤销'))) return;
    await remove(`/juice/${b.dataset.undo}`);
    renderJuice();
  }));
}

// 同一种配料合在一行：同单位且能凑成整 1/4 的直接相加，区间或单位不同就用「+」连（规则同主站 Wellness）
function shopping(picks) {
  const m = new Map();
  for (const j of R.juices.filter((x) => picks.has(x.id))) {
    for (const [n, a] of j.ing) if (n !== '清水') m.set(n, (m.get(n) || []).concat(a));
  }
  const num = (s) => {
    const r = String(s).match(/^(半|\d+\/\d+|\d+(?:\.\d+)?)\s*([^\d\-~–].*)$/);
    if (!r) return null;
    const v = r[1] === '半' ? 0.5 : r[1].includes('/') ? r[1].split('/').reduce((x, y) => x / y) : +r[1];
    return [v, r[2].trim()];
  };
  const show = (v, u) => `${v === 0.5 ? '半' : v === 0.25 ? '1/4 ' : `${Math.round(v * 100) / 100} `}${u}`;
  return [...m].map(([n, a]) => {
    if (a.length === 1) return [n, a[0]];
    const p = a.map(num);
    if (p.every(Boolean) && p.every((x) => x[1] === p[0][1])) {
      const sum = p.reduce((s, x) => s + x[0], 0);
      if (Number.isInteger(sum * 4)) return [n, show(sum, p[0][1])];
    }
    return [n, a.join(' + ')];
  });
}

// ---------- Ask：每日一问 ----------

let askEditing = false;

async function renderAsk() {
  const [data] = await Promise.all([api('/ask'), ensureMe()]);
  names = data.names;
  bar.hidden = false;
  const t = data.today;
  const mine = t.answers[me];
  const theirs = t.answers[other(me)];

  const theirCard = theirs === true
    ? `<div class="ans sealed">${ICON.lock}<b>${nm(other(me))} 已经答了</b><p>你答完就能看到</p></div>`
    : theirs
      ? `<div class="ans"><span class="ans-h">${nm(other(me))}</span><p>${esc(theirs)}</p></div>`
      : `<div class="ans sealed"><b>${nm(other(me))} 还没答</b><p>答完会出现在这里</p></div>`;
  const myCard = mine && !askEditing
    ? `<div class="ans"><span class="ans-h">${nm(me)}<button class="mini" data-edit>改一改</button></span><p>${esc(mine)}</p></div>`
    : `<form class="ans write" id="askForm"><span class="ans-h">${nm(me)}</span>
        <textarea name="text" maxlength="1000" rows="5" placeholder="想到什么写什么，写完才能看到 TA 的">${esc(mine || '')}</textarea>
        <div class="acts"><button class="btn dark">${mine ? '保存' : '写好了'}</button></div></form>`;

  const past = data.past.map((p) => {
    const a = p.answers;
    const row = (u) => (a[u] === true ? `<p class="dim">${nm(u)} 答了，你还没答这天的</p>`
      : a[u] ? `<p><span>${nm(u)}</span>${esc(a[u])}</p>` : `<p class="dim">${nm(u)} 没答</p>`);
    return `<div class="past"><div class="past-h"><b>${esc(p.question)}</b><span>${fmtDay(p.day)}</span></div>${row(me)}${row(other(me))}</div>`;
  }).join('');

  paint(win('Ask', '每日一问 · 两个人都答完才能看到对方的', `
    <div class="ask-q"><span>${fmtDay(t.day)} 的问题</span><h3>${esc(t.question)}</h3></div>
    <div class="ans-grid">${myCard}${theirCard}</div>
    <div class="sec"><h3>以前的问题</h3>${past || '<p class="empty">明天这里就会有第一条</p>'}</div>`));

  app.querySelector('[data-edit]')?.addEventListener('click', () => {
    askEditing = true;
    renderAsk();
  });
  app.querySelector('#askForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post('/ask', { text: e.target.text.value });
      askEditing = false;
      toast(theirs ? '揭晓了' : '答好了，等 TA');
      renderAsk();
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- Plant：共养植物 ----------

// 6 个阶段的线稿：同一个花盆往上长；颜色取自果蔬汁配方的低饱和色，只做小点缀
function plantSvg(stage, wilted) {
  const ink = wilted ? '#9a9a9a' : '#0a0a0a';
  const leaf = wilted ? '#cfcabd' : '#77845a';
  const flower = wilted ? '#d3c4c4' : '#9d2933';
  const fruit = wilted ? '#d6cabd' : '#b5652b';
  const top = [196, 172, 140, 104, 82, 74][stage];
  const tx = wilted && stage ? 116 : 100;
  const leafAt = (x, y, rot, s = 1) => `<path d="M0 0c8-10 22-10 28 0c-8 8-20 8-28 0z" transform="translate(${x} ${y}) rotate(${rot + (wilted ? 25 : 0)}) scale(${s})" fill="${leaf}" stroke="${ink}" stroke-width="1.2"/>`;
  const parts = [];
  if (stage === 0) {
    parts.push(`<ellipse cx="100" cy="194" rx="7" ry="4.5" fill="#7d6a58" stroke="${ink}" stroke-width="1.2"/>`);
  } else {
    parts.push(`<path d="M100 200 C100 ${(200 + top) / 2} ${tx} ${top + 24} ${tx} ${top}" fill="none" stroke="${ink}" stroke-width="1.6"/>`);
    parts.push(leafAt(100, 184, -150, 0.7), leafAt(100, 184, -30, 0.7));
  }
  if (stage >= 2) parts.push(leafAt(101, 162, -160, 0.9), leafAt(101, 152, -20, 0.9));
  if (stage >= 3) parts.push(leafAt(103, 130, -165), leafAt(104, 120, -15));
  if (stage === 3) parts.push(`<path d="M${tx - 7} ${top + 2}q7 -20 14 0q-7 6 -14 0z" fill="${flower}" stroke="${ink}" stroke-width="1.2"/>`);
  if (stage >= 4) {
    parts.push([0, 72, 144, 216, 288].map((a) => `<ellipse cx="${tx}" cy="${top - 11}" rx="7" ry="12" transform="rotate(${a} ${tx} ${top})" fill="${flower}" stroke="${ink}" stroke-width="1.2"/>`).join(''));
    parts.push(`<circle cx="${tx}" cy="${top}" r="5" fill="#d9b680" stroke="${ink}" stroke-width="1.2"/>`);
  }
  if (stage >= 5) parts.push(`<circle cx="82" cy="132" r="6" fill="${fruit}" stroke="${ink}" stroke-width="1.2"/><circle cx="124" cy="142" r="6" fill="${fruit}" stroke="${ink}" stroke-width="1.2"/>`);
  return `<svg class="plant-svg" viewBox="0 40 200 220" aria-hidden="true">
    ${parts.join('')}
    <path d="M64 200h72l-8 52h-56z" fill="#f2efe9" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M58 200h84" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

async function renderPlant() {
  const [p] = await Promise.all([api('/plant'), ensureMe()]);
  bar.hidden = false;
  const span = p.nextAt ? p.nextAt - p.prevAt : 1;
  const pct = p.nextAt ? Math.min(100, Math.round(((p.points - p.prevAt) / span) * 100)) : 100;
  const PARTS = [['juice', '果蔬汁'], ['ask', '每日一问'], ['mood', '心情天气'], ['water', '浇水'], ['life', '愿望、足迹、信']];
  const RULES = [
    ['每人喝一杯果蔬汁', p.rules.juice], ['一轮两个人都喝了', p.rules.litCycle], ['答一次每日一问', p.rules.answer],
    ['同一天两个人都答了', p.rules.bothAnswered], ['写一次心情天气', p.rules.mood], ['每人每天浇一次水', p.rules.water],
    ['完成一个愿望', p.rules.wish], ['去了一个新地方', p.rules.place], ['写一封时光胶囊', p.rules.letter],
  ];

  paint(win('Plant', '我们的植物 · 两个人一起照顾它，三天没人管会蔫', `
    <div class="plant">
      <div class="plant-stage">
        ${plantSvg(p.stage, p.wilted)}
        <div class="plant-name"><h3>${esc(p.name || '还没有名字')}</h3><button class="mini" data-rename>${p.name ? '改名' : '起个名字'}</button></div>
        <p class="muted">${esc(p.stageName)}${p.wilted ? ` · ${p.idle} 天没人照顾，有点蔫了` : ''}</p>
      </div>
      <div class="plant-side">
        <div class="stat-big"><b>${p.points}</b><span>成长值${p.nextAt ? ` · 再 ${p.nextAt - p.points} 到下一阶段` : ' · 已经长到最大了'}</span></div>
        <div class="bar-track"><div style="width:${pct}%"></div></div>
        <ol class="stages">${p.stages.map((s, i) => `<li class="${i <= p.stage ? 'on' : ''}"><span>${esc(s.name)}</span><b>${s.at}</b></li>`).join('')}</ol>
        <div class="water">
          ${USERS.map((u) => `<div class="${p.wateredToday[u] ? 'ok' : ''}">${ICON.drop}<span>${nm(u)} ${p.wateredToday[u] ? '今天浇过了' : '今天还没浇'}</span></div>`).join('')}
          <button class="btn dark" data-water ${p.wateredToday[me] ? 'disabled' : ''}>${p.wateredToday[me] ? '你今天浇过了' : '浇水'}</button>
        </div>
      </div>
    </div>
    <div class="cats two sec">
      <div class="cat"><h4>成长值从哪来</h4><ul class="kv">${PARTS.map(([k, n]) => `<li><span>${n}</span><b>${p.parts[k]}</b></li>`).join('')}</ul></div>
      <div class="cat"><h4>怎么让它长大</h4><ul class="kv">${RULES.map(([n, v]) => `<li><span>${n}</span><b>+${v}</b></li>`).join('')}</ul></div>
    </div>`));

  app.querySelector('[data-water]')?.addEventListener('click', async () => {
    await post('/plant/water');
    toast('浇好了');
    renderPlant();
  });
  app.querySelector('[data-rename]').addEventListener('click', async () => {
    const name = await dialog(`<h3>给它起个名字</h3><p>两个人看到的是同一个名字。</p>
      <input type="text" id="plantName" maxlength="20" value="${esc(p.name)}" placeholder="比如 小番茄">
      <div class="acts" style="margin-top:16px"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">好了</button></div>`,
    { onOk: (m) => m.querySelector('#plantName').value });
    if (name === false) return;
    await post('/plant/name', { name });
    renderPlant();
  });
}

// ---------- Map：足迹 + 愿望清单 ----------

let mapTab = 'places';
let pin = null; // 地图上刚点的位置 { lon, lat }
let placeKind = 'been'; // 点地图会重画页面，选的「去过了 / 想去」要留住

// 点阵地图：x = 经度 + 180，y = 90 - 纬度，可见 y 范围 4..150（见 worldmap.svg 的 viewBox）
const MAP_Y0 = 4;
const MAP_H = 146;
const toPct = (lon, lat) => [((lon + 180) / 360) * 100, ((90 - lat - MAP_Y0) / MAP_H) * 100];

async function renderMap() {
  const [pl, ws] = await Promise.all([api('/places'), api('/wishes'), ensureMe()]);
  names = pl.names;
  bar.hidden = false;
  const been = pl.items.filter((p) => p.kind === 'been');
  const want = pl.items.filter((p) => p.kind === 'want');

  const pins = pl.items.map((p) => {
    const [x, y] = toPct(p.lon, p.lat);
    return `<button class="pin ${p.kind}" style="left:${x}%;top:${y}%" data-place="${p.id}" aria-label="${esc(p.name)}"><span>${esc(p.name)}</span></button>`;
  }).join('');
  const pending = pin ? (() => { const [x, y] = toPct(pin.lon, pin.lat); return `<span class="pin new" style="left:${x}%;top:${y}%"></span>`; })() : '';

  const placeRow = (p) => `<div class="place-row" data-place="${p.id}">
    ${p.photo_key ? `<img src="/api/photo/${encodeURIComponent(p.photo_key)}" alt="" loading="lazy">` : `<span class="dot ${p.kind}"></span>`}
    <div class="t"><b>${esc(p.name)}</b><span>${p.day ? fmtDay(p.day) : ''}${p.note ? `${p.day ? ' · ' : ''}${esc(p.note)}` : ''}</span></div>
    ${p.kind === 'want' ? `<button class="mini" data-been="${p.id}">去过了</button>` : ''}
    <button class="mini" data-delplace="${p.id}" data-name="${esc(p.name)}">删</button>
  </div>`;

  const placesView = `
    <p class="intro">在地图上点一下，记下一起去过的地方，或者想一起去的地方。实心是去过的，空心是想去的。</p>
    <div class="map" id="map"><img src="/worldmap.svg" alt="" draggable="false">${pins}${pending}</div>
    <form class="form" id="placeForm">
      <div class="seg small">
        <button type="button" data-kind="been" class="${placeKind === 'been' ? 'on' : ''}">去过了</button>
        <button type="button" data-kind="want" class="${placeKind === 'want' ? 'on' : ''}">想去</button>
      </div>
      <div class="add${placeKind === 'want' ? ' nodate' : ''}">
        <input type="text" name="name" maxlength="40" placeholder="${pin ? '这是哪儿？比如 上海、京都' : '先在地图上点一下位置'}">
        <input type="date" name="day" value="${todayStr()}" ${placeKind === 'want' ? 'hidden' : ''}>
        <input type="text" name="note" maxlength="300" placeholder="${placeKind === 'want' ? '为什么想去（选填）' : '一句话记下那天（选填）'}">
        <button class="btn dark">记在地图上</button>
      </div>
      ${shotField('配一张照片（选填）')}
    </form>
    <div class="cats two sec">
      <div class="cat"><h4>去过的<span>${been.length} 个地方</span></h4>${been.map(placeRow).join('') || '<p class="none">还没有，第一站会是哪里？</p>'}</div>
      <div class="cat"><h4>想去的<span>${want.length} 个地方</span></h4>${want.map(placeRow).join('') || '<p class="none">点地图加一个想去的地方</p>'}</div>
    </div>`;

  const todo = ws.items.filter((w) => !w.done_day);
  const done = ws.items.filter((w) => w.done_day);
  const wishRow = (w) => `<div class="wish${w.done_day ? ' done' : ''}">
    <button class="tick" data-toggle="${w.id}" aria-label="${w.done_day ? '取消完成' : '完成'}">${w.done_day ? ICON.check : ''}</button>
    <div class="t"><b>${esc(w.text)}</b><span>${w.done_day ? `${fmtDay(w.done_day)} 做到了` : `${nm(w.author)} 许的愿`}</span></div>
    <button class="mini" data-delwish="${w.id}" data-name="${esc(w.text)}">删</button>
  </div>`;
  const wishesView = `
    <p class="intro">我们的人生清单：想一起做的事都写在这里，做完一件勾一件。</p>
    <form class="form row" id="wishForm"><input type="text" name="text" maxlength="80" placeholder="比如 一起看一次极光、一起学会做红烧肉"><button class="btn dark">许个愿</button></form>
    <div class="sec"><h3>还没做的 · ${todo.length}</h3>${todo.map(wishRow).join('') || '<p class="empty">都做完了，再许一个吧</p>'}</div>
    <div class="sec"><h3>做到了 · ${done.length}</h3>${done.map(wishRow).join('') || '<p class="empty">第一件会是哪个？</p>'}</div>`;

  paint(win('Map', '地图和愿望 · 去过的、想去的、想一起做的', `
    <div class="seg">
      <button type="button" data-mtab="places" class="${mapTab === 'places' ? 'on' : ''}">足迹 · ${pl.items.length}</button>
      <button type="button" data-mtab="wishes" class="${mapTab === 'wishes' ? 'on' : ''}">愿望清单 · ${ws.items.length}</button>
    </div>
    ${mapTab === 'places' ? placesView : wishesView}`));

  app.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => {
    mapTab = b.dataset.mtab;
    renderMap();
  }));

  if (mapTab === 'places') {
    const map = app.querySelector('#map');
    map.addEventListener('click', async (e) => {
      const hit = e.target.closest('.pin[data-place]');
      if (hit) return showPlace(pl.items.find((x) => String(x.id) === hit.dataset.place));
      const r = map.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      pin = { lon: +(x * 360 - 180).toFixed(2), lat: +(90 - (y * MAP_H + MAP_Y0)).toFixed(2) };
      await renderMap();
      app.querySelector('#placeForm input[name=name]').focus({ preventScroll: true });
    });
    const form = app.querySelector('#placeForm');
    form.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      placeKind = b.dataset.kind;
      form.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
      const want = placeKind === 'want';
      form.day.hidden = want;
      form.querySelector('.add').classList.toggle('nodate', want);
      form.note.placeholder = want ? '为什么想去（选填）' : '一句话记下那天（选填）';
    }));
    const getPhoto = photoPicker(form.querySelector('.shot'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pin) return toast('先在地图上点一下位置');
      const fd = new FormData();
      fd.append('kind', placeKind);
      fd.append('name', form.name.value);
      fd.append('lon', pin.lon);
      fd.append('lat', pin.lat);
      if (placeKind === 'been') fd.append('day', form.day.value);
      fd.append('note', form.note.value);
      const photo = getPhoto();
      if (photo) fd.append('photo', photo, 'place.jpg');
      try {
        await api('/places', { method: 'POST', body: fd });
        pin = null;
        toast('记在地图上了');
        renderMap();
      } catch (err) {
        toast(err.message);
      }
    });
    app.querySelectorAll('.place-row').forEach((row) => row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showPlace(pl.items.find((x) => String(x.id) === row.dataset.place));
    }));
    app.querySelectorAll('[data-been]').forEach((b) => b.addEventListener('click', async () => {
      await post(`/places/${b.dataset.been}/been`);
      toast('去过了');
      renderMap();
    }));
    app.querySelectorAll('[data-delplace]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('删掉这个地方？', `「${b.dataset.name}」会从地图上拿掉。`, '删掉'))) return;
      await remove(`/places/${b.dataset.delplace}`);
      renderMap();
    }));
  } else {
    app.querySelector('#wishForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await post('/wishes', { text: e.target.text.value });
        renderMap();
      } catch (err) {
        toast(err.message);
      }
    });
    app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      await post(`/wishes/${b.dataset.toggle}/toggle`);
      renderMap();
    }));
    app.querySelectorAll('[data-delwish]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('删掉这个愿望？', `「${b.dataset.name}」`, '删掉'))) return;
      await remove(`/wishes/${b.dataset.delwish}`);
      renderMap();
    }));
  }
}

function showPlace(p) {
  if (!p) return;
  dialog(`${p.photo_key ? `<img class="dlg-img" src="/api/photo/${encodeURIComponent(p.photo_key)}" alt="">` : ''}
    <h3>${esc(p.name)}</h3>
    <p>${p.kind === 'been' ? `${p.day ? `${fmtDay(p.day)} · ` : ''}一起去过` : '想一起去'}${p.note ? `<br>${esc(p.note)}` : ''}</p>
    <p class="muted">${nm(p.author)} 记的</p>`, { wide: Boolean(p.photo_key) });
}

// ---------- Capsule：时光胶囊 ----------

async function renderCapsule() {
  const [data] = await Promise.all([api('/letters'), ensureMe()]);
  names = data.names;
  bar.hidden = false;
  const sealed = data.items.filter((l) => !l.open);
  const opened = data.items.filter((l) => l.open);
  const nextYear = `${Number(data.today.slice(0, 4)) + 1}${data.today.slice(4)}`;
  const to = (l) => (l.to === 'both' ? '写给我们俩' : l.to === l.author ? '写给未来的自己' : `写给 ${nm(l.to)}`);

  paint(win('Capsule', '时光胶囊 · 写给未来的信，到了那天才能打开', `
    <div class="capsule">
      <div>
        <h3 class="h17">还封着的 · ${sealed.length}</h3>
        ${sealed.map((l) => `<div class="letter sealed">${ICON.lock}<div class="t"><b>${esc(l.title)}</b>
          <span>${nm(l.author)} ${to(l)} · ${fmtDay(l.openOn)} 打开</span></div>
          <em>还有 ${l.daysLeft} 天</em>
          ${l.author === me ? `<button class="mini" data-delletter="${l.id}" data-name="${esc(l.title)}">删</button>` : ''}</div>`).join('') || '<p class="empty">还没有封起来的信</p>'}
        <h3 class="h17 sec">已经打开的 · ${opened.length}</h3>
        ${opened.map((l) => `<button class="letter open" data-read="${l.id}"><div class="t"><b>${esc(l.title)}</b>
          <span>${nm(l.author)} ${to(l)} · ${fmtDay(l.writtenOn)} 写的</span></div><i>${ICON.arrow}</i></button>`).join('') || '<p class="empty">到了日子，信会出现在这里</p>'}
      </div>
      <form class="form" id="letterForm">
        <h3 class="h17">写一封</h3>
        <div class="add two">
          <select name="to">
            <option value="${other(me)}">写给 ${nm(other(me))}</option>
            <option value="both">写给我们俩</option>
            <option value="${me}">写给未来的自己</option>
          </select>
          <label class="date-l"><span>哪天打开</span><input type="date" name="openOn" value="${nextYear}" min="${data.today}"></label>
        </div>
        <input type="text" name="title" maxlength="40" placeholder="信的标题，比如 一周年那天打开">
        <textarea name="body" maxlength="5000" rows="9" placeholder="想对那一天的我们说什么？封起来之后，到日子之前谁都看不到正文，你自己也看不到。"></textarea>
        <div class="acts"><button class="btn dark">封起来</button></div>
      </form>
    </div>`));

  app.querySelector('#letterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/letters', { to: f.to.value, title: f.title.value, body: f.body.value, openOn: f.openOn.value });
      toast('封好了');
      renderCapsule();
    } catch (err) {
      toast(err.message);
    }
  });
  app.querySelectorAll('[data-read]').forEach((b) => b.addEventListener('click', () => {
    const l = opened.find((x) => String(x.id) === b.dataset.read);
    dialog(`<h3>${esc(l.title)}</h3><p class="muted">${nm(l.author)} ${to(l)} · ${fmtDay(l.writtenOn)} 写，${fmtDay(l.openOn)} 打开</p>
      <div class="letter-body">${esc(l.body)}</div>`, { wide: true });
  }));
  app.querySelectorAll('[data-delletter]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('删掉这封信？', `「${b.dataset.name}」删掉就找不回来了。`, '删掉'))) return;
    await remove(`/letters/${b.dataset.delletter}`);
    renderCapsule();
  }));
}

// ---------- Manual：对方说明书 ----------

let manualAbout = null;

async function renderManual() {
  const [data] = await Promise.all([api('/manual'), ensureMe()]);
  names = data.names;
  bar.hidden = false;
  if (!manualAbout) manualAbout = other(me);

  const items = data.items.filter((i) => i.about === manualAbout);
  const section = ([cat, [title, hint]]) => {
    const list = items.filter((i) => i.category === cat);
    return `<div class="cat ${cat}"><h4>${title}<span>${hint}</span></h4><div class="chips">
      ${list.length ? list.map((i) => `<span class="chip" title="${esc(i.note || '')}">${esc(i.text)}
        ${i.author !== i.about ? `<small>${nm(i.author)} 记</small>` : ''}
        <button class="x" type="button" data-id="${i.id}" data-t="${esc(i.text)}" aria-label="删掉">${ICON.x}</button></span>`).join('')
        : '<span class="none">还没记</span>'}
    </div></div>`;
  };

  paint(win('Manual', '对方说明书 · 点餐、做饭、去别人家吃饭前翻一下', `
    <div class="seg">
      ${USERS.map((u) => `<button type="button" data-u="${u}" class="${manualAbout === u ? 'on' : ''}">${nm(u)}</button>`).join('')}
    </div>
    <div class="cats two">${Object.entries(CATEGORIES).map(section).join('')}</div>
    <div class="sec">
      <h3>记一条</h3>
      <form class="form add" id="manualForm">
        <select name="category">${Object.entries(CATEGORIES).map(([k, [t]]) => `<option value="${k}" ${k === 'avoid' ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="text" name="text" maxlength="60" placeholder="比如 香菜、虾、少冰" required>
        <input type="text" name="note" maxlength="200" placeholder="补充一句（选填）">
        <button class="btn dark">记进 ${nm(manualAbout)} 的说明书</button>
      </form>
    </div>`));

  app.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    manualAbout = b.dataset.u;
    renderManual();
  }));
  app.querySelectorAll('.chip .x').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('删掉这一条？', `「${b.dataset.t}」会从说明书里删掉。`, '删掉'))) return;
    await remove(`/manual/${b.dataset.id}`);
    renderManual();
  }));
  app.querySelector('#manualForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/manual', { about: manualAbout, category: f.category.value, text: f.text.value, note: f.note.value });
      toast('记下了');
      renderManual();
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- Year：恋爱年报 ----------

let reportYear = null;

async function renderYear() {
  await Promise.all([ensureMe(), loadRecipes()]);
  const thisYear = Number(todayStr().slice(0, 4));
  if (!reportYear) reportYear = thisYear;
  const d = await api(`/report?year=${reportYear}`);
  names = d.names;
  bar.hidden = false;
  const years = [];
  for (let y = 2026; y <= thisYear; y++) years.push(y);
  const juiceTotal = d.juice.byUser.raven + d.juice.byUser.billy;
  const maxJ = Math.max(1, d.juice.byUser.raven, d.juice.byUser.billy);
  const wKeys = Object.keys(WEATHERS);
  const moodRows = USERS.map((u) => {
    const m = d.moods[u] || {};
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    const segs = wKeys.filter((k) => m[k]).map((k) => `<span class="w${wKeys.indexOf(k)}" style="flex:${m[k]}" title="${WEATHERS[k][0]} ${m[k]} 天"></span>`).join('');
    const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    return `<div class="mood-row"><span>${nm(u)}</span><div class="stack">${segs || '<span class="empty-bar"></span>'}</div>
      <em>${total ? `${WEATHERS[top[0]][0]}最多，${top[1]} 天` : '还没记过'}</em></div>`;
  }).join('');

  paint(win('Year', `恋爱年报 · ${reportYear} 年的我们`, `
    ${years.length > 1 ? `<div class="seg">${years.map((y) => `<button type="button" data-y="${y}" class="${y === reportYear ? 'on' : ''}">${y}</button>`).join('')}</div>` : ''}
    <div class="report-hero"><span>${reportYear} 年，我们在一起</span><b>${d.days}</b><span>天</span></div>
    <div class="stats">
      <div class="stat"><b>${juiceTotal}</b><span>杯果蔬汁</span></div>
      <div class="stat"><b>${d.juice.litCycles}</b><span>轮两个人都喝了 · 最长连胜 ${d.juice.bestStreak}</span></div>
      <div class="stat"><b>${d.ask.bothDays}</b><span>天两个人都答了每日一问</span></div>
      <div class="stat"><b>${d.been.length}</b><span>个一起去过的地方</span></div>
      <div class="stat"><b>${d.wishesDone.length}</b><span>个愿望做到了</span></div>
      <div class="stat"><b>${d.letters}</b><span>封时光胶囊</span></div>
      <div class="stat"><b>${d.ask.answers}</b><span>条每日一问的回答</span></div>
      <div class="stat"><b>${d.manual}</b><span>条记进对方说明书</span></div>
    </div>
    <div class="cats two sec">
      <div class="cat"><h4>谁喝得多</h4>
        ${USERS.map((u) => `<div class="hbar"><span>${nm(u)}</span><div><i style="width:${(d.juice.byUser[u] / maxJ) * 100}%"></i></div><b>${d.juice.byUser[u]}</b></div>`).join('')}
        <h4 class="mt">最常喝的</h4>
        ${d.juice.top.length ? `<ul class="kv">${d.juice.top.map((t) => { const r = recipeById(t.recipe_id); return `<li><span><i class="cdot" style="--c:${r ? r.color : '#898989'}"></i>${esc(r?.name || t.recipe || '自己配的')}</span><b>${t.n} 杯</b></li>`; }).join('')}</ul>` : '<p class="none">还没喝过</p>'}
      </div>
      <div class="cat"><h4>心情天气</h4>${moodRows}
        <div class="legend">${wKeys.map((k, i) => `<span><i class="w${i}"></i>${WEATHERS[k][0]}</span>`).join('')}</div>
      </div>
      <div class="cat"><h4>一起去过的地方</h4>${d.been.length ? `<ul class="kv">${d.been.map((p) => `<li><span>${esc(p.name)}</span><b>${fmtDay(p.day)}</b></li>`).join('')}</ul>` : '<p class="none">今年的第一站还没出发</p>'}</div>
      <div class="cat"><h4>做到的愿望</h4>${d.wishesDone.length ? `<ul class="kv">${d.wishesDone.map((w) => `<li><span>${esc(w.text)}</span><b>${fmtDay(w.done_day)}</b></li>`).join('')}</ul>` : '<p class="none">第一件会是哪个？</p>'}</div>
    </div>`));

  app.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => {
    reportYear = Number(b.dataset.y);
    renderYear();
  }));
}

router();
