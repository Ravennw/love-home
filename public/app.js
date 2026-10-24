const app = document.getElementById('app');
const bar = document.getElementById('bar');
const menu = document.getElementById('menu');
const pickBtn = document.getElementById('pick');

// 10-25 改版：不做打卡和闲聊。说话只留「每天一句话」和「时光记忆本」，
// 其余是两个人一起做的有意义的事：学习、看电影、听音乐、成长，加上健康（果蔬汁 + 对方说明书）和地图愿望。

// ---------- 图标：线稿 SVG（主站规则：界面不出现 emoji） ----------

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON = {
  x: svg('<path d="M6 6l12 12M18 6L6 18" stroke-width="2"/>'),
  camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  out: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>'),
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
  home: ['HOME', '首页'], memory: ['MEMORY', '时光记忆本'], learn: ['LEARN', '一起学习'], watch: ['WATCH', '一起看电影'],
  music: ['MUSIC', '一起听音乐'], grow: ['GROW', '一起成长'], health: ['HEALTH', '健康'], map: ['MAP', '地图和愿望'],
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

// 距今天几天：今天 / 昨天 / N 天前
function ago(day) {
  const n = Math.round((Date.parse(todayStr()) - Date.parse(day)) / 86400000);
  return n <= 0 ? '今天' : n === 1 ? '昨天' : `${n} 天前`;
}

function fmtDay(day) {
  if (!day) return '';
  const [y, m, d] = day.split('-');
  return `${y !== todayStr().slice(0, 4) ? `${y}年` : ''}${Number(m)}月${Number(d)}日`;
}

// 居中弹窗：遮罩、×、Esc 都能关，打开时背景不滚；onOk 在关之前读弹窗里的输入
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
    mask.querySelector('input,textarea')?.focus();
  });
}
const confirmBox = (title, text, okLabel) => dialog(`<h3>${esc(title)}</h3><p>${esc(text)}</p>
  <div class="acts"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">${esc(okLabel)}</button></div>`);
// 写一句话的弹窗：返回文字，取消返回 false
const askLine = (title, hint, placeholder, value = '') => dialog(`<h3>${esc(title)}</h3>${hint ? `<p>${esc(hint)}</p>` : ''}
  <textarea id="dlgText" rows="3" maxlength="300" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
  <div class="acts" style="margin-top:16px"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">好了</button></div>`,
{ onOk: (m) => m.querySelector('#dlgText').value.trim() });

// 整块重画时保住滚动位置，点了东西不跳到顶部；内页在白框 .win-b 里滚，换页才回顶
let freshRoute = true;
function paint(html) {
  const y = scrollY;
  const inner = freshRoute ? 0 : app.querySelector('.win-b')?.scrollTop || 0;
  freshRoute = false;
  app.innerHTML = html;
  scrollTo(0, y);
  const box = app.querySelector('.win-b');
  if (box) box.scrollTop = inner;
}

// 内页窗口：白底 + 48 高黑色页眉条，right 是页眉条右边的按钮
const win = (title, sub, body, right = '') => `
  <section class="win">
    <div class="win-h"><h2>${title}</h2><span>${sub}</span>${right}</div>
    <div class="win-b">${body}</div>
  </section>`;
const seg = (list, cur, attr) => `<div class="seg">${list.map(([k, label]) =>
  `<button type="button" data-${attr}="${k}" class="${cur === k ? 'on' : ''}">${label}</button>`).join('')}</div>`;

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
const photoUrl = (key) => `/api/photo/${encodeURIComponent(key)}`;

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

let healthTab = 'juice';
let memoryTab = 'memories';
const routes = {
  '': renderHome,
  memory: renderMemory,
  learn: () => renderItems('learn'),
  watch: () => renderItems('film'),
  music: () => renderItems('song'),
  grow: () => renderItems('goal'),
  health: renderHealth,
  map: renderMap,
  // 旧链接：果蔬汁、说明书进健康页，时光胶囊进记忆本，其余回首页
  juice: () => { healthTab = 'juice'; return renderHealth(); },
  manual: () => { healthTab = 'manual'; return renderHealth(); },
  capsule: () => { memoryTab = 'letters'; return renderMemory(); },
};
const NAV_OF = { juice: 'health', manual: 'health', capsule: 'memory' };
let lastRoute = null;

async function router() {
  const name = location.hash.replace(/^#\/?/, '');
  const known = Object.hasOwn(routes, name);
  const tab = known ? NAV_OF[name] || name || 'home' : 'home';
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  pickBtn.querySelector('span').textContent = TABS[tab][0];
  menu.hidden = true;
  if (lastRoute !== tab) {
    scrollTo(0, 0);
    freshRoute = true;
  }
  lastRoute = tab;
  try {
    await (known ? routes[name] : renderHome)();
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

// ---------- 两个人的当地时间 ----------

const CITIES = [
  ['上海', 'Asia/Shanghai'], ['北京', 'Asia/Shanghai'], ['香港', 'Asia/Hong_Kong'], ['台北', 'Asia/Taipei'],
  ['东京', 'Asia/Tokyo'], ['首尔', 'Asia/Seoul'], ['新加坡', 'Asia/Singapore'], ['迪拜', 'Asia/Dubai'],
  ['悉尼', 'Australia/Sydney'], ['墨尔本', 'Australia/Melbourne'], ['奥克兰', 'Pacific/Auckland'],
  ['伦敦', 'Europe/London'], ['巴黎', 'Europe/Paris'], ['柏林', 'Europe/Berlin'], ['阿姆斯特丹', 'Europe/Amsterdam'],
  ['纽约', 'America/New_York'], ['多伦多', 'America/Toronto'], ['芝加哥', 'America/Chicago'],
  ['洛杉矶', 'America/Los_Angeles'], ['旧金山', 'America/Los_Angeles'], ['西雅图', 'America/Los_Angeles'], ['温哥华', 'America/Vancouver'],
];
const hhmm = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
function dayPart(tz) {
  const h = Number(hhmm(tz).slice(0, 2));
  return h < 5 ? '深夜' : h < 8 ? '清晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
}
// 相对 UTC 的分钟数，用来算两边差几个小时
function offsetMin(tz) {
  const s = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).format(new Date());
  const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}
let clockTimer = null;

// 果蔬汁：只说两个人最近一次喝是哪天
function drinkText(d) {
  return d ? `${ago(d.day)}喝了${d.recipe ? ` ${esc(d.recipe)}` : ''}` : '还没喝过';
}

// ---------- Home ----------

let lineEditing = false;

async function renderHome() {
  const data = await api('/home');
  me = data.me;
  names = data.names;
  bar.hidden = false;
  const them = other(me);
  const { lines, meet, juice: j, together: t } = data;
  const where = data.where || {};
  const mine = lines.today[me];

  // 每天一句话：我的那句能写能改，对方的直接显示
  const myLine = mine && !lineEditing
    ? `<div class="say"><span>${nm(me)}<button type="button" class="linkbtn" data-line-edit>改一改</button></span><p>${esc(mine)}</p></div>`
    : `<form class="say write" id="lineForm"><span>${nm(me)}</span>
        <div class="row"><input type="text" name="text" maxlength="140" value="${esc(mine || '')}" placeholder="今天想说的一句话"><button class="btn dark">${mine ? '保存' : '写下'}</button></div></form>`;
  const theirLine = `<div class="say"><span>${nm(them)}</span>${lines.today[them]
    ? `<p>${esc(lines.today[them])}</p>` : '<p class="dim">今天还没写</p>'}</div>`;
  const yday = USERS.filter((u) => lines.yesterday[u]);

  const clock = (u) => {
    const w = where[u];
    const tag = u === me ? 'button type="button" data-where' : 'div';
    const end = u === me ? 'button' : 'div';
    if (!w) {
      return `<${tag} class="clock empty"><span class="c-who">${nm(u)}</span><b>--:--</b>
        <span class="c-part">${u === me ? '点这里设你在哪个城市' : `等 ${nm(u)} 设一下城市`}</span></${end}>`;
    }
    let hint = dayPart(w.tz);
    if (u !== me) {
      if (hint === '深夜') hint += '，可能睡了';
      else if (hint === '清晨') hint += '，可能刚醒';
      if (where[me]) {
        const d = (offsetMin(w.tz) - offsetMin(where[me].tz)) / 60;
        if (d) hint += ` · 比你${d > 0 ? '快' : '慢'} ${Math.abs(d)} 小时`;
      }
    }
    return `<${tag} class="clock"><span class="c-who">${nm(u)}${w.city ? ` · ${esc(w.city)}` : ''}</span>
      <b data-tz="${esc(w.tz)}">${hhmm(w.tz)}</b><span class="c-part">${hint}</span></${end}>`;
  };
  const meetLine = `<button type="button" class="line" data-meet>
    <span class="k">下次见面</span>
    <div class="v">${meet
      ? `<b>${meet.daysLeft === 0 ? '就是今天' : `还有 ${meet.daysLeft} 天`}</b><p>${fmtDay(meet.day)}${meet.place ? ` · ${esc(meet.place)}` : ''}</p>`
      : '<b>还没定</b><p>定一个日子，两个人一起倒数</p>'}</div>
    <i>${ICON.arrow}</i></button>`;

  // 一起在做：每一格点进对应的页面
  const tile = (href, k, v, p) => `<a class="tile" href="${href}"><span class="k">${k}</span><b>${v}</b><p>${p}</p></a>`;
  const learning = t.learning[0];
  const tiles = [
    tile('#/learn', '一起学习', learning ? esc(learning.title) : '还没在学',
      learning ? `${nm(learning.owner)} 在学${t.learning.length > 1 ? ` · 另外还有 ${t.learning.length - 1} 门` : ''}` : '加一门两个人都想学的'),
    tile('#/watch', '一起看电影', t.films.next ? esc(t.films.next.title) : '片单是空的',
      t.films.count ? `想一起看的还有 ${t.films.count} 部` : '加一部想一起看的'),
    tile('#/music', '一起听音乐', t.song ? esc(t.song.title) : '还没有歌',
      t.song ? `${nm(t.song.author)} 最近推荐${t.song.sub ? ` · ${esc(t.song.sub)}` : ''}` : '推荐一首给对方'),
    tile('#/grow', '一起成长', t.goals.length ? esc(t.goals[0].title) : '还没定目标',
      t.goals.length ? `${t.goals.length} 个目标在进行` : '写下今年想成为的样子'),
    tile('#/health', '健康', j[them] ? `${nm(them)} ${ago(j[them].day)}喝了` : `${nm(them)} 还没喝过`,
      [j[them]?.recipe ? esc(j[them].recipe) : '', j[me] ? `你${ago(j[me].day)}喝了` : '你还没喝过'].filter(Boolean).join(' · ')),
  ].join('');

  paint(`
    <section class="hero">
      <h1>Raven &amp; Billy</h1>
      <p class="tag">${data.daysTogether === 1 ? 'Day 1 · 今天，我们在一起了' : `Day ${data.daysTogether} · 在一起的第 ${data.daysTogether} 天`}</p>
      <div class="dash">
        <div class="box">
          <div class="box-h"><i></i>Today<span>每天一句话</span></div>
          <div class="well">
            ${myLine}${theirLine}
            <div class="note-meta"><span>${yday.length ? `昨天 · ${yday.map((u) => `${nm(u)}：${esc(lines.yesterday[u])}`).join('　')}` : '一天一句，攒在记忆本里'}</span>
              <a class="linkbtn" href="#/memory" data-to-lines>翻记忆本</a></div>
          </div>
        </div>
        <div class="box">
          <div class="box-h"><i></i>Right now<span>此刻的我们</span></div>
          <div class="well">
            <div class="clocks">${clock(me)}${clock(them)}</div>
            ${meetLine}
            <div class="note-meta"><span>点自己的时钟可以改城市，点下次见面可以改日子</span></div>
          </div>
        </div>
        <div class="box wide">
          <div class="box-h"><i></i>Together<span>一起在做的事</span></div>
          <div class="well tiles">${tiles}</div>
        </div>
      </div>
    </section>`);

  clearInterval(clockTimer);
  clockTimer = setInterval(() => app.querySelectorAll('[data-tz]').forEach((b) => { b.textContent = hhmm(b.dataset.tz); }), 20000);
  app.querySelector('[data-line-edit]')?.addEventListener('click', () => {
    lineEditing = true;
    renderHome();
  });
  app.querySelector('#lineForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post('/line', { text: e.target.text.value });
      lineEditing = false;
      toast('记下了');
      renderHome();
    } catch (err) {
      toast(err.message);
    }
  });
  app.querySelector('[data-to-lines]').addEventListener('click', () => { memoryTab = 'lines'; });
  app.querySelector('[data-where]')?.addEventListener('click', async () => {
    const cur = where[me];
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const v = await dialog(`<h3>你现在在哪个城市</h3><p>${nm(them)} 会看到你那边现在几点。</p>
      <select id="whereSel" style="margin-top:12px;width:100%">
        ${CITIES.map(([c, tz]) => `<option value="${c}|${tz}" ${cur?.city === c ? 'selected' : ''}>${c}</option>`).join('')}
        <option value="|${device}" ${cur && !cur.city ? 'selected' : ''}>不在列表里，用这台设备的时区（${esc(device)}）</option>
      </select>
      <div class="acts" style="margin-top:16px"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">好了</button></div>`,
    { onOk: (m) => m.querySelector('#whereSel').value });
    if (!v) return;
    const [city, tz] = v.split('|');
    await post('/where', { city, tz });
    renderHome();
  });
  app.querySelector('[data-meet]').addEventListener('click', async () => {
    const v = await dialog(`<h3>下次见面</h3><p>两个人看到的是同一个倒数。日期清空就是还没定。</p>
      <div class="add two" style="margin-top:12px">
        <input type="date" id="meetDay" value="${meet?.day || ''}" min="${data.today}">
        <input type="text" id="meetPlace" maxlength="40" value="${esc(meet?.place || '')}" placeholder="在哪儿见（选填）">
      </div>
      <div class="acts" style="margin-top:16px"><button class="btn" data-a="no">取消</button><button class="btn dark" data-a="ok">好了</button></div>`,
    { onOk: (m) => ({ day: m.querySelector('#meetDay').value, place: m.querySelector('#meetPlace').value }) });
    if (!v) return;
    await post('/meet', v);
    toast(v.day ? '开始倒数了' : '先不定');
    renderHome();
  });
}

// ---------- Memory：时光记忆本（记忆 · 每天一句 · 写给未来） ----------

let memFormOpen = false;

async function renderMemory() {
  const [data, letters] = await Promise.all([api('/memory'), api('/letters'), ensureMe()]);
  names = data.names;
  bar.hidden = false;
  const tabs = seg([['memories', `记忆 · ${data.memories.length}`], ['lines', `每天一句 · ${data.lines.length}`], ['letters', `写给未来 · ${letters.items.length}`]], memoryTab, 'mtab');

  let body = '';
  if (memoryTab === 'memories') {
    // 按年月分组的时间线
    const groups = new Map();
    for (const m of data.memories) {
      const k = m.day.slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    const card = (m) => `<article class="mem">
      ${m.photo_key ? `<img src="${photoUrl(m.photo_key)}" alt="" loading="lazy" data-photo="${esc(m.photo_key)}">` : ''}
      <div class="mem-in"><span>${fmtDay(m.day)} · ${nm(m.author)} 记</span><h4>${esc(m.title)}</h4>${m.body ? `<p>${esc(m.body)}</p>` : ''}
        <button class="mini" data-delmem="${m.id}" data-name="${esc(m.title)}">删</button></div></article>`;
    body = `
      <p class="intro">值得记住的日子都放在这里：第一次见面、一起做成的事、普通但想留住的一天。</p>
      ${data.memories.length && !memFormOpen ? '<button type="button" class="add-bar" data-memopen>+ 记一段</button>' : `<form class="form" id="memForm">
        ${data.memories.length ? '' : '<p class="form-tip">第一段记忆会是什么？第一次见面、第一次一起做成的事，都可以。</p>'}
        <div class="add mem-add">
          <input type="text" name="title" maxlength="60" placeholder="这段记忆叫什么，比如 第一次一起看海">
          <input type="date" name="day" value="${data.today}" max="${data.today}">
        </div>
        <textarea name="body" rows="3" maxlength="3000" placeholder="那天发生了什么（选填）"></textarea>
        <div class="row">${shotField('配一张照片（选填）')}${data.memories.length ? '<button type="button" class="btn" data-memfold>收起</button>' : ''}<button class="btn dark">记下来</button></div>
      </form>`}
      ${groups.size ? [...groups].map(([k, list]) => `<div class="sec"><h3>${Number(k.slice(0, 4))} 年 ${Number(k.slice(5))} 月</h3><div class="mems">${list.map(card).join('')}</div></div>`).join('')
        : ''}`;
  } else if (memoryTab === 'lines') {
    body = `
      <p class="intro">每天一句话，攒起来就是我们的日子。在首页写，这里只看。</p>
      ${data.lines.length ? `<div class="daylines">${data.lines.map((l) => `<div class="dl">
        <span class="d">${fmtDay(l.day)}</span>
        ${USERS.map((u) => `<p class="${l[u] ? '' : 'dim'}"><b>${nm(u)}</b>${l[u] ? esc(l[u]) : '没写'}</p>`).join('')}
      </div>`).join('')}</div>` : '<p class="empty">今天写下第一句吧</p>'}`;
  } else {
    body = lettersView(letters);
  }

  paint(win('Memory', '时光记忆本 · 记忆、每天一句、写给未来的信', tabs + body));

  app.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => {
    memoryTab = b.dataset.mtab;
    freshRoute = true;
    renderMemory();
  }));
  if (memoryTab === 'memories') {
    app.querySelector('[data-memopen]')?.addEventListener('click', async () => {
      memFormOpen = true;
      await renderMemory();
      app.querySelector('#memForm [name=title]').focus({ preventScroll: true });
    });
    app.querySelector('[data-memfold]')?.addEventListener('click', () => {
      memFormOpen = false;
      renderMemory();
    });
    const form = app.querySelector('#memForm');
    const getPhoto = form ? photoPicker(form.querySelector('.shot')) : null;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData();
      fd.append('title', form.title.value);
      fd.append('day', form.day.value);
      fd.append('body', form.body.value);
      const photo = getPhoto();
      if (photo) fd.append('photo', photo, 'memory.jpg');
      try {
        await api('/memories', { method: 'POST', body: fd });
        memFormOpen = false;
        toast('记下来了');
        renderMemory();
      } catch (err) {
        toast(err.message);
      }
    });
    app.querySelectorAll('[data-photo]').forEach((img) => img.addEventListener('click', () => {
      dialog(`<img class="dlg-img full" src="${photoUrl(img.dataset.photo)}" alt="">`, { wide: true });
    }));
    app.querySelectorAll('[data-delmem]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmBox('删掉这段记忆？', `「${b.dataset.name}」删掉就找不回来了。`, '删掉'))) return;
      await remove(`/memories/${b.dataset.delmem}`);
      renderMemory();
    }));
  }
  if (memoryTab === 'letters') bindLetters(letters, renderMemory);
}

// 写给未来的信（原时光胶囊）：到了开启日才能看正文
function lettersView(data) {
  const sealed = data.items.filter((l) => !l.open);
  const opened = data.items.filter((l) => l.open);
  const nextYear = `${Number(data.today.slice(0, 4)) + 1}${data.today.slice(4)}`;
  const to = (l) => (l.to === 'both' ? '写给我们俩' : l.to === l.author ? '写给未来的自己' : `写给 ${nm(l.to)}`);
  return `
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
    </div>`;
}

function bindLetters(data, rerender) {
  const opened = data.items.filter((l) => l.open);
  const to = (l) => (l.to === 'both' ? '写给我们俩' : l.to === l.author ? '写给未来的自己' : `写给 ${nm(l.to)}`);
  app.querySelector('#letterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/letters', { to: f.to.value, title: f.title.value, body: f.body.value, openOn: f.openOn.value });
      toast('封好了');
      rerender();
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
    rerender();
  }));
}

// ---------- 一起做的事：学习 / 电影 / 音乐 / 成长（同一套渲染，按 KIND 配置） ----------

const KIND = {
  learn: {
    route: 'learn', title: 'Learn', sub: '一起学习 · 各自在学什么，学完留下一句收获',
    intro: '书、课、一门手艺都算。学完写一句学到了什么，两个人的知识慢慢攒在一起。',
    name: '在学什么，比如 机器学习入门、法语、《置身事内》', subPh: '在哪学（选填），比如 Coursera、一本书',
    owner: true, statuses: [['doing', '在学'], ['want', '想学'], ['done', '学完了']], addStatus: 'doing',
    next: { want: ['doing', '开始学'], doing: ['done', '学完了'] }, doneAsk: ['学完了', '一句话说说学到了什么（选填）'],
    say: '写一句', sayTitle: '写一句', sayPh: '学到哪了、有什么想法', addBtn: '加进来', more: '加一门',
    empty: '还没有在学的。挑一样开始，或者写你们自己的：',
    examples: [['《置身事内》', '一本书', 'both'], ['法语 A1', '多邻国'], ['摄影入门', 'B 站课程']],
  },
  film: {
    route: 'watch', title: 'Watch', sub: '一起看电影 · 想一起看的片单，看完各写一句',
    intro: '想一起看的都放进片单。看完两个人各写一句，攒成我们的观影史。',
    name: '片名，比如 花样年华', subPh: '年份或导演（选填）', notePh: '为什么想一起看（选填）',
    statuses: [['want', '想一起看'], ['done', '看过了']], addStatus: 'want',
    next: { want: ['done', '看过了'] }, doneAsk: ['看过了', '一句话短评（选填）'],
    say: '写一句', sayTitle: '一句话短评', sayPh: '看完的感受', addBtn: '放进片单', pick: '今晚看什么', more: '加一部',
    empty: '片单还是空的。先放一部你们都想看的：',
    examples: [['花样年华', '2000 · 王家卫'], ['爱在黎明破晓前', '1995 · 林克莱特'], ['海街日记', '2015 · 是枝裕和']],
  },
  song: {
    route: 'music', title: 'Music', sub: '一起听音乐 · 推荐给对方的歌，附一句为什么',
    intro: '推荐一首歌给对方，写一句为什么。对方听完也回一句。链接贴网易云、QQ 音乐、Spotify 都行。',
    name: '歌名', subPh: '歌手（选填）', notePh: '为什么推荐给 TA', link: true,
    statuses: null, addStatus: 'done',
    say: '听后回一句', sayTitle: '听完想说', sayPh: '听完的感受', addBtn: '推荐给 TA', more: '推荐一首',
    empty: '还没有歌。推荐第一首给 TA，比如：',
    examples: [['First Love', '宇多田光'], ['Fly Me to the Moon', 'Frank Sinatra'], ['后来', '刘若英']],
  },
  goal: {
    route: 'grow', title: 'Grow', sub: '一起成长 · 今年想成为的样子，偶尔写一句进展',
    intro: '每人写几个今年想变成的样子，也可以是两个人一起的目标。不按天记录，有进展了写一句。',
    name: '目标，比如 读完 12 本书、学会游泳', subPh: '为什么想做到（选填）',
    owner: true, statuses: [['doing', '进行中'], ['done', '做到了']], addStatus: 'doing', byOwner: true,
    next: { doing: ['done', '做到了'] }, doneAsk: ['做到了', '一句话记下这一刻（选填）'],
    say: '写进展', sayTitle: '写一句进展', sayPh: '最近做到了哪一步', addBtn: '定下来', more: '定一个目标',
    empty: '今年想成为什么样子？每人写一两个就够，比如：',
    examples: [['读完 12 本书', ''], ['学会游泳', ''], ['一起跑完一次半马', '', 'both']],
  },
};
let tonight = null; // 「今晚看什么」抽中的片
// 有内容时表单收成一行，点了才展开；点空状态里的例子只填进输入框，不直接存
let openForm = null;
let prefill = null;

async function renderItems(kind) {
  const cfg = KIND[kind];
  const [data] = await Promise.all([api(`/items?kind=${kind}`), ensureMe()]);
  names = data.names;
  bar.hidden = false;
  const items = data.items;

  const owners = [[me, '我'], [other(me), nm(other(me))], ['both', '我们俩']];
  const pf = prefill || {};
  const form = `<form class="form" id="itemForm">
    <div class="add item-add${cfg.owner ? ' with-owner' : ''}">
      ${cfg.owner ? `<select name="owner">${owners.map(([v, l]) => `<option value="${v}" ${pf.owner === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      <input type="text" name="title" maxlength="80" placeholder="${cfg.name}" value="${esc(pf.title || '')}">
      <input type="text" name="sub" maxlength="60" placeholder="${cfg.subPh}" value="${esc(pf.sub || '')}">
      ${cfg.link ? '<input type="text" name="link" maxlength="300" placeholder="链接（选填）">' : ''}
      ${cfg.statuses && kind === 'learn' ? `<select name="status">${cfg.statuses.map(([v, l]) => `<option value="${v}" ${v === cfg.addStatus ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
    </div>
    ${cfg.notePh ? `<input type="text" name="note" maxlength="300" placeholder="${cfg.notePh}">` : ''}
    <div class="acts">${items.length ? '<button type="button" class="btn" data-fold>收起</button>' : ''}<button class="btn dark">${cfg.addBtn}</button></div>
  </form>`;
  const addBar = `<button type="button" class="add-bar" data-open>+ ${cfg.more}</button>`;
  const emptyCard = `<div class="empty-card"><p>${cfg.empty}</p>
    <div class="examples">${cfg.examples.map(([t, sb, o], n) => `<button type="button" class="pill-ex" data-ex="${n}">${esc(t)}${sb ? `<small>${esc(sb)}</small>` : ''}</button>`).join('')}
      <button type="button" class="pill-ex own" data-open>自己写一个</button></div></div>`;
  const formOpen = openForm === kind;
  const top = !items.length ? (formOpen ? form : emptyCard) : formOpen ? form : addBar;

  const card = (i) => {
    const next = cfg.next?.[i.status];
    const meta = [
      // 成长按人分栏，栏标题已经写了是谁的
      cfg.byOwner ? '' : cfg.owner ? (i.owner === 'both' ? '我们俩' : nm(i.owner)) : `${nm(i.author)} ${kind === 'song' ? '推荐' : '加的'}`,
      i.sub ? esc(i.sub) : '',
      i.done_day && kind !== 'song' ? `${fmtDay(i.done_day)} ${cfg.statuses.find(([s]) => s === 'done')[1]}` : '',
    ].filter(Boolean).join(' · ');
    return `<article class="it${tonight === i.id ? ' pick' : ''}" id="it-${i.id}">
      <div class="it-h">
        <div class="t"><b>${esc(i.title)}${i.link ? ` <a class="ext" href="${esc(i.link)}" target="_blank" rel="noopener noreferrer" aria-label="打开链接">${ICON.out}</a>` : ''}</b><span>${meta}</span></div>
        <div class="it-acts">
          ${next ? `<button class="mini dark" data-next="${i.id}" data-to="${next[0]}">${next[1]}</button>` : ''}
          <button class="mini" data-say="${i.id}">${cfg.say}</button>
        </div>
      </div>
      <button class="it-del" data-del="${i.id}" data-name="${esc(i.title)}" aria-label="删掉这一条">${ICON.x}</button>
      ${i.comments.length ? `<ul class="cmts">${i.comments.map((c) => `<li><b>${nm(c.user)}</b><p>${esc(c.text)}</p><span>${fmtDay(c.day)}</span>
        ${c.user === me ? `<button class="x" data-delc="${c.id}" aria-label="删掉这句">${ICON.x}</button>` : ''}</li>`).join('')}</ul>` : ''}
    </article>`;
  };

  let lists = '';
  if (!items.length) {
    lists = '';
  } else if (cfg.byOwner) {
    // 成长：按人分三栏
    lists = `<div class="cols3">${[me, other(me), 'both'].map((o) => {
      const mine = items.filter((i) => i.owner === o);
      return `<div class="col"><h3>${o === 'both' ? '我们俩' : nm(o)} · ${mine.filter((i) => i.status !== 'done').length}</h3>
        ${mine.map(card).join('') || '<p class="muted">还没有</p>'}</div>`;
    }).join('')}</div>`;
  } else if (cfg.statuses) {
    lists = cfg.statuses.map(([s, label]) => {
      const list = items.filter((i) => i.status === s);
      if (!list.length) return '';
      return `<div class="sec"><h3>${label} · ${list.length}</h3>${list.map(card).join('')}</div>`;
    }).join('');
  } else {
    lists = `<div class="sec">${items.map(card).join('')}</div>`;
  }

  const canPick = cfg.pick && items.some((i) => i.status === 'want');
  paint(win(cfg.title, cfg.sub, `<p class="intro">${cfg.intro}</p>${top}${lists}`,
    canPick ? `<button class="btn" data-pickone>${cfg.pick}</button>` : ''));

  const reopen = async (fill) => {
    openForm = kind;
    prefill = fill;
    await renderItems(kind);
    const input = app.querySelector('#itemForm [name=title]');
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  };
  app.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => reopen(null)));
  app.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => {
    const [title, sub, owner] = cfg.examples[Number(b.dataset.ex)];
    reopen({ title, sub, owner });
  }));
  app.querySelector('[data-fold]')?.addEventListener('click', () => {
    openForm = null;
    prefill = null;
    renderItems(kind);
  });
  app.querySelector('#itemForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/items', {
        kind,
        title: f.title.value,
        sub: f.sub.value,
        link: f.link?.value,
        owner: f.owner?.value,
        status: f.status?.value || cfg.addStatus,
        note: f.note?.value,
      });
      toast('加进来了');
      openForm = null;
      prefill = null;
      renderItems(kind);
    } catch (err) {
      toast(err.message);
    }
  });
  app.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.next;
    const to = b.dataset.to;
    if (to === 'done' && cfg.doneAsk) {
      const text = await askLine(cfg.doneAsk[0], '', cfg.doneAsk[1]);
      if (text === false) return;
      await post(`/items/${id}/status`, { status: to });
      if (text) await post(`/items/${id}/comments`, { text });
    } else {
      await post(`/items/${id}/status`, { status: to });
    }
    renderItems(kind);
  }));
  app.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', async () => {
    const text = await askLine(cfg.sayTitle, '', cfg.sayPh);
    if (!text) return;
    await post(`/items/${b.dataset.say}/comments`, { text });
    renderItems(kind);
  }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('删掉这一条？', `「${b.dataset.name}」和下面写的话会一起删掉。`, '删掉'))) return;
    await remove(`/items/${b.dataset.del}`);
    renderItems(kind);
  }));
  app.querySelectorAll('[data-delc]').forEach((b) => b.addEventListener('click', async () => {
    await remove(`/comments/${b.dataset.delc}`);
    renderItems(kind);
  }));
  app.querySelector('[data-pickone]')?.addEventListener('click', async () => {
    const pool = items.filter((i) => i.status === 'want');
    if (!pool.length) return toast('片单是空的，先放几部进来');
    let k;
    do k = pool[Math.floor(Math.random() * pool.length)].id; while (pool.length > 1 && k === tonight);
    tonight = k;
    await renderItems(kind);
    document.getElementById(`it-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`今晚看 ${pool.find((i) => i.id === k).title}`);
  });
}

// ---------- Health：果蔬汁 + 对方说明书 ----------

let todayPick = '';

function renderHealth() {
  return healthTab === 'manual' ? renderManual() : renderJuice();
}
const healthSeg = () => seg([['juice', '抗炎果蔬汁'], ['manual', '对方说明书']], healthTab, 'htab');
function bindHealthSeg() {
  app.querySelectorAll('[data-htab]').forEach((b) => b.addEventListener('click', () => {
    healthTab = b.dataset.htab;
    freshRoute = true;
    if (location.hash !== '#/health') location.hash = '#/health';
    else renderHealth();
  }));
}

async function renderJuice() {
  const [list, shop] = await Promise.all([api('/juice'), api('/shop'), loadRecipes(), ensureMe()]);
  names = list.names;
  bar.hidden = false;
  const picks = new Set(shop.picks);
  const mineToday = (id) => list.items.find((c) => c.recipe_id === id && c.user === me && c.day === list.today);

  const card = (r) => {
    const on = picks.has(r.id);
    const cup = mineToday(r.id);
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
        <div class="wl-drank">${cup
          ? `<span>今天喝的是这杯</span><button class="btn" data-undo="${cup.id}">记错了</button>`
          : `<span>喝了就点一下，${nm(other(me))} 看得到</span><button class="btn dark" data-drank="${r.id}">我喝了这杯</button>`}</div>
      </div></article>`;
  };

  const shopList = shopping(picks);
  paint(win('Health', '健康 · 一人份的抗炎果蔬汁，和记着对方忌口的说明书', `
    ${healthSeg()}
    <div class="wl-status">${USERS.map((u) => `<b class="${list.last[u]?.day === list.today ? 'ok' : ''}">${u === me ? '你' : `${nm(u)} `}${drinkText(list.last[u])}</b>`).join('')}</div>
    ${todayPick ? (() => { const r = recipeById(todayPick); return `<div class="wl-today" style="--c:${r.color}"><img src="/recipes/${r.img}.webp" alt=""><span>今天喝</span><b>${esc(r.name)}</b><em>${esc(r.line)}</em><button class="btn" data-today>换一款</button></div>`; })() : ''}
    <div class="wl-grid">${R.juices.map(card).join('')}</div>
    <section class="wl-shop"><h3>购物清单<span>${picks.size ? `已选 ${picks.size} 款 · 两个人看到的是同一份` : '在卡片上点「加入清单」'}</span>
      ${picks.size ? '<button class="btn" data-clear>清空</button><button class="btn" data-copy>复制清单</button>' : ''}</h3>
      ${shopList.length ? `<ul>${shopList.map((i) => `<li><span>${esc(i[0])}</span><b>${esc(i[1])}</b></li>`).join('')}</ul>` : ''}</section>
    <section class="wl-notes"><h3>喝之前知道</h3><ul>${(R.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`,
  '<button class="btn" data-today>今天喝什么</button>'));

  bindHealthSeg();
  app.querySelectorAll('[data-today]').forEach((b) => b.addEventListener('click', async () => {
    let k;
    do k = R.juices[Math.floor(Math.random() * R.juices.length)].id; while (R.juices.length > 1 && k === todayPick);
    todayPick = k;
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
    await post('/juice', { recipe_id: r.id, recipe: r.name });
    toast(`记下了，${names[other(me)]} 看得到`);
    renderJuice();
  }));
  app.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
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

  paint(win('Health', '健康 · 一人份的抗炎果蔬汁，和记着对方忌口的说明书', `
    ${healthSeg()}
    <div class="seg small">
      ${USERS.map((u) => `<button type="button" data-u="${u}" class="${manualAbout === u ? 'on' : ''}">${nm(u)} 的说明书</button>`).join('')}
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

  bindHealthSeg();
  app.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
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
    ${p.photo_key ? `<img src="${photoUrl(p.photo_key)}" alt="" loading="lazy">` : `<span class="dot ${p.kind}"></span>`}
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
      </div>
      <div class="row">${shotField('配一张照片（选填）')}<button class="btn dark">记在地图上</button></div>
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
    ${seg([['places', `足迹 · ${pl.items.length}`], ['wishes', `愿望清单 · ${ws.items.length}`]], mapTab, 'maptab')}
    ${mapTab === 'places' ? placesView : wishesView}`));

  app.querySelectorAll('[data-maptab]').forEach((b) => b.addEventListener('click', () => {
    mapTab = b.dataset.maptab;
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
      const wantIt = placeKind === 'want';
      form.day.hidden = wantIt;
      form.querySelector('.add').classList.toggle('nodate', wantIt);
      form.note.placeholder = wantIt ? '为什么想去（选填）' : '一句话记下那天（选填）';
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
  dialog(`${p.photo_key ? `<img class="dlg-img" src="${photoUrl(p.photo_key)}" alt="">` : ''}
    <h3>${esc(p.name)}</h3>
    <p>${p.kind === 'been' ? `${p.day ? `${fmtDay(p.day)} · ` : ''}一起去过` : '想一起去'}${p.note ? `<br>${esc(p.note)}` : ''}</p>
    <p class="muted">${nm(p.author)} 记的</p>`, { wide: Boolean(p.photo_key) });
}

// 先确认登录状态再进页面；没登录直接显示登录页
api('/session').then(({ me: who }) => (who ? router() : renderLogin())).catch(() => renderLogin());
