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
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
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
  home: ['HOME', '首页'], ask: ['ASK', '每日一问'], juice: ['JUICE', '果蔬汁'],
  map: ['MAP', '地图和愿望'], capsule: ['CAPSULE', '时光胶囊'], manual: ['MANUAL', '对方说明书'],
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
  '': renderHome, ask: renderAsk, juice: renderJuice,
  map: renderMap, capsule: renderCapsule, manual: renderManual,
};
let lastRoute = null;

async function router() {
  const name = location.hash.replace(/^#\/?/, '');
  const tab = routes[name] ? name || 'home' : 'home';
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  pickBtn.querySelector('span').textContent = TABS[tab][0];
  menu.hidden = true;
  if (lastRoute !== tab) {
    scrollTo(0, 0);
    freshRoute = true;
  }
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

// ---------- 此刻：两个人的当地时间 + 纸条 ----------

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
function ago2(ms) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} 小时前`;
  return fmtDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(ms)));
}
const noteText = (n) => (n.text ? esc(n.text) : n.from === me ? `想 ${nm(other(me))} 了` : `${nm(n.from)} 想你了`);
let clockTimer = null;

// 果蔬汁不算轮次：只说两个人最近一次喝是哪天，看得到对方就够了
function drinkText(d) {
  return d ? `${ago(d.day)}喝了${d.recipe ? ` ${esc(d.recipe)}` : ''}` : '还没喝过';
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
  const { juice: j, ask: a, meet } = data;
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
    <span class="k">${k}</span><div class="v"><b>${v}</b><p>${hint}</p></div>${done ? dots(done) : ''}<i>${ICON.arrow}</i></a>`;
  const drankToday = Object.fromEntries(USERS.map((u) => [u, j[u]?.day === data.today]));
  const where = data.where || {};
  const them = other(me);
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
  const notes = data.notes || [];
  const got = notes.find((n) => n.from === them);
  const sent = notes.find((n) => n.from === me);
  const noteCard = got
    ? `<div class="note-card${got.read ? '' : ' new'}"><span>${nm(them)} · ${ago2(got.at)}${got.read ? '' : '<em>新</em>'}</span><p>${noteText(got)}</p></div>`
    : `<div class="note-card none"><p>${nm(them)} 还没留过纸条</p></div>`;
  const meetLine = `<button type="button" class="line" data-meet>
    <span class="k">下次见面</span>
    <div class="v">${meet
      ? `<b>${meet.daysLeft === 0 ? '就是今天' : `还有 ${meet.daysLeft} 天`}</b><p>${fmtDay(meet.day)}${meet.place ? ` · ${esc(meet.place)}` : ''}</p>`
      : '<b>还没定</b><p>定一个日子，两个人一起倒数</p>'}</div>
    <i>${ICON.arrow}</i></button>`;

  paint(`
    <section class="hero">
      <h1>Raven &amp; Billy</h1>
      <p class="tag">${data.daysTogether === 1 ? 'Day 1 · 今天，我们在一起了' : `Day ${data.daysTogether} · 在一起的第 ${data.daysTogether} 天`}</p>

      <div class="box">
        <div class="box-h"><i></i>Right now<span>此刻的我们</span></div>
        <div class="well">
          <div class="clocks">${clock(me)}${clock(them)}</div>
          ${noteCard}
          <form class="row note-form" id="noteForm">
            <input type="text" name="text" maxlength="200" placeholder="给 ${nm(them)} 留一张纸条">
            <button type="button" class="btn" data-miss>想你了</button>
            <button class="btn dark">留下</button>
          </form>
          <div class="note-meta"><span>${sent ? `你${ago2(sent.at) === '刚刚' ? '' : ' '}${ago2(sent.at)}留的${sent.text ? '纸条' : '「想你了」'}，${sent.read ? `${nm(them)} 已经看到了` : `${nm(them)} 还没看到`}` : `${nm(them)} 下次打开首页就会看到`}</span>
            ${notes.length ? '<button type="button" class="linkbtn" data-notes>以前的纸条</button>' : ''}</div>
        </div>
      </div>

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
          ${meetLine}
          ${line('#/ask', '每日一问', esc(a.question), askHint(a), a.done)}
          ${line('#/juice', '果蔬汁', `${nm(other(me))} ${drinkText(j[other(me)])}`, `你${drinkText(j[me])}`, drankToday)}
        </div>
      </div>
    </section>`);

  app.querySelectorAll('.pill[data-w]').forEach((b) => b.addEventListener('click', async () => {
    await post('/mood', { weather: b.dataset.w, note: app.querySelector('#moodNote').value });
    toast('心情已更新');
    renderHome();
  }));
  clearInterval(clockTimer);
  clockTimer = setInterval(() => app.querySelectorAll('[data-tz]').forEach((b) => { b.textContent = hhmm(b.dataset.tz); }), 20000);
  const sendNote = async (text) => {
    await post('/notes', { text });
    toast(text ? `留好了，${names[them]} 打开就能看到` : `告诉 ${names[them]} 了`);
    renderHome();
  };
  app.querySelector('#noteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return toast('写一句再留，或者点「想你了」');
    sendNote(text);
  });
  app.querySelector('[data-miss]').addEventListener('click', () => sendNote(''));
  app.querySelector('[data-notes]')?.addEventListener('click', async () => {
    const { items } = await api('/notes');
    dialog(`<h3>以前的纸条</h3><ul class="note-list">${items.map((n) => `<li class="${n.from === me ? 'me' : ''}">
      <span>${n.from === me ? '你' : nm(n.from)} · ${ago2(n.at)}</span><p>${noteText(n)}</p></li>`).join('')}</ul>`, { wide: true });
  });
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
  app.querySelector('#moodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!todayMine) return toast('再点一个天气就保存好了');
    await post('/mood', { weather: todayMine.weather, note: app.querySelector('#moodNote').value });
    toast('心情已更新');
    renderHome();
  });
}

// ---------- Juice：照主站 Wellness 的「抗炎果蔬汁」栏目 ----------

let todayPick = '';

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
  paint(win('Juice', '果蔬汁 · 一人份的抗炎配方，喝哪杯、什么时候喝自己定', `
    <div class="wl-status">${USERS.map((u) => `<b class="${list.last[u]?.day === list.today ? 'ok' : ''}">${u === me ? '你' : `${nm(u)} `}${drinkText(list.last[u])}</b>`).join('')}</div>
    ${todayPick ? (() => { const r = recipeById(todayPick); return `<div class="wl-today" style="--c:${r.color}"><img src="/recipes/${r.img}.webp" alt=""><span>今天喝</span><b>${esc(r.name)}</b><em>${esc(r.line)}</em><button class="btn" data-today>换一款</button></div>`; })() : ''}
    <div class="wl-grid">${R.juices.map(card).join('')}</div>
    <section class="wl-shop"><h3>购物清单<span>${picks.size ? `已选 ${picks.size} 款 · 两个人看到的是同一份` : '在卡片上点「加入清单」'}</span>
      ${picks.size ? '<button class="btn" data-clear>清空</button><button class="btn" data-copy>复制清单</button>' : ''}</h3>
      ${shopList.length ? `<ul>${shopList.map((i) => `<li><span>${esc(i[0])}</span><b>${esc(i[1])}</b></li>`).join('')}</ul>` : ''}</section>
    <section class="wl-notes"><h3>喝之前知道</h3><ul>${(R.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`,
  '<button class="btn" data-today>今天喝什么</button>'));

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

router();
