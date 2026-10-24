// home.ravenweng.com —— Raven & Billy 的小窝
// 静态页面由 [assets] 提供，这里只处理 /api/*

const USERS = ['raven', 'billy'];
const CATEGORIES = ['avoid', 'allergy', 'love', 'dislike', 'habit'];
// 一起做的事：学习 / 电影 / 音乐 / 成长；状态 想做 / 在做 / 做完
const KINDS = ['learn', 'film', 'song', 'goal'];
const STATUSES = ['want', 'doing', 'done'];
const OWNERS = ['raven', 'billy', 'both'];
const SESSION_DAYS = 60;
const RENEW_DAYS = 30; // 剩不到 30 天时，这次请求顺手续成新的 60 天：60 天里打开过一次就不会被登出
const DAY_MS = 86400000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: '服务器出了点问题' }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function route(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const seg = pathname.split('/'); // ['', 'api', name, id, action]
  const id = Number(seg[3]);

  if (pathname === '/api/login' && method === 'POST') return login(request, env);
  if (pathname === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  const s = await session(request, env);
  // 打开网站先问一下登没登录：没登录返回 me: null（200），不用拿 401 当信号，控制台不报红
  if (pathname === '/api/session' && method === 'GET') return renew(json({ me: s?.user ?? null, names: names(env) }), s, env);
  if (!s) throw new HttpError(401, '请先登录');
  return renew(await dispatch(request, env, url, s.user, seg, id), s, env);
}

async function dispatch(request, env, url, me, seg, id) {
  const { pathname } = url;
  const method = request.method;
  if (method === 'GET' && seg[2] === 'photo') {
    return photo(env, decodeURIComponent(pathname.slice('/api/photo/'.length)));
  }

  const R = `${method} /${seg[2] || ''}${seg[3] ? (Number.isInteger(id) && id > 0 ? '/:id' : `/${seg[3]}`) : ''}${seg[4] ? `/${seg[4]}` : ''}`;
  switch (R) {
    case 'GET /home': return home(env, me);
    case 'POST /line': return setLine(request, env, me);
    case 'POST /meet': return setMeet(request, env);
    case 'POST /where': return setWhere(request, env, me);
    case 'GET /memory': return listMemory(env, me);
    case 'POST /memories': return addMemory(request, env, me);
    case 'DELETE /memories/:id': return delMemory(env, id);
    case 'GET /items': return listItems(env, url.searchParams.get('kind'));
    case 'POST /items': return addItem(request, env, me);
    case 'POST /items/:id/status': return setItemStatus(request, env, id);
    case 'DELETE /items/:id': return delItem(env, id);
    case 'POST /items/:id/comments': return addComment(request, env, me, id);
    case 'DELETE /comments/:id': return delOwn(env, 'comments', 'user', id, me);
    case 'GET /manual': return listManual(env);
    case 'POST /manual': return addManual(request, env, me);
    case 'DELETE /manual/:id': return del(env, 'manual_items', id);
    case 'GET /juice': return listJuice(env);
    case 'POST /juice': return addJuice(request, env, me);
    case 'DELETE /juice/:id': return delOwn(env, 'juice_checkins', 'user', id, me);
    case 'GET /shop': return json({ picks: await getState(env, 'shop', []) });
    case 'POST /shop': return setShop(request, env);
    case 'GET /places': return listPlaces(env);
    case 'POST /places': return addPlace(request, env, me);
    case 'POST /places/:id/been': return markBeen(env, id);
    case 'DELETE /places/:id': return del(env, 'places', id);
    case 'GET /wishes': return listWishes(env);
    case 'POST /wishes': return addWish(request, env, me);
    case 'POST /wishes/:id/toggle': return toggleWish(env, me, id);
    case 'DELETE /wishes/:id': return del(env, 'wishes', id);
    case 'GET /letters': return listLetters(env, me);
    case 'POST /letters': return addLetter(request, env, me);
    case 'DELETE /letters/:id': return delOwn(env, 'letters', 'author', id, me);
    default: throw new HttpError(404, '没有这个接口');
  }
}

// ---------- 登录：两人各一个密码，cookie 用 HMAC 签名 ----------

async function login(request, env) {
  const { user, password } = await request.json();
  if (!USERS.includes(user)) throw new HttpError(400, '你是谁呀');
  const expected = env[`PASSWORD_${user.toUpperCase()}`];
  if (!expected || !(await safeEqual(password || '', expected))) {
    throw new HttpError(401, '密码不对');
  }
  return json({ ok: true, user }, 200, { 'Set-Cookie': await issue(user, env) });
}

// 签发一个新的 60 天登录 cookie
async function issue(user, env) {
  const exp = Date.now() + SESSION_DAYS * DAY_MS;
  const payload = `${user}.${exp}`;
  return cookie(`${payload}.${await sign(payload, env.SESSION_SECRET)}`, SESSION_DAYS * 86400);
}

// 校验 cookie，返回 { user, exp }；无效或过期返回 null
async function session(request, env) {
  const match = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
  if (!match) return null;
  const [user, exp, sig] = match[1].split('.');
  if (!USERS.includes(user) || Number(exp) < Date.now()) return null;
  return (await safeEqual(sig || '', await sign(`${user}.${exp}`, env.SESSION_SECRET))) ? { user, exp: Number(exp) } : null;
}

// 滑动续期：剩不到 RENEW_DAYS 天就在这次响应里补发新的 60 天 cookie
async function renew(res, s, env) {
  if (s && s.exp - Date.now() < RENEW_DAYS * DAY_MS) res.headers.append('Set-Cookie', await issue(s.user, env));
  return res;
}

function cookie(value, maxAge) {
  return `sid=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function sign(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 先各自哈希再比较，避免长度和逐字节时序泄露
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([a, b].map((s) => sign(s, 'cmp')));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

// ---------- 日期：所有"今天"都按 HOME_TZ 计算 ----------

function today(env) {
  return dayOf(Date.now(), env);
}

function dayOf(ms, env) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env.HOME_TZ || 'Asia/Shanghai' }).format(new Date(ms));
}

function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

function names(env) {
  return { raven: env.NAME_RAVEN || 'Raven', billy: env.NAME_BILLY || 'Billy' };
}

function isDay(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// ---------- 首页 ----------

async function home(env, me) {
  const day = today(env);
  const yesterday = dayOf(Date.parse(`${day}T12:00:00+08:00`) - DAY_MS, env);
  const all = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results);
  const [lines, juice, meet, where, doing, films, song, goals] = await Promise.all([
    all('SELECT day, user, text FROM lines WHERE day IN (?, ?)', day, yesterday),
    lastDrinks(env),
    getState(env, 'meet', null),
    getState(env, 'where', {}),
    all("SELECT id, title, owner FROM items WHERE kind = 'learn' AND status = 'doing' ORDER BY created_at DESC LIMIT 3"),
    all("SELECT id, title FROM items WHERE kind = 'film' AND status != 'done' ORDER BY created_at DESC"),
    env.DB.prepare("SELECT id, title, sub, author FROM items WHERE kind = 'song' ORDER BY created_at DESC LIMIT 1").first(),
    all("SELECT id, title, owner FROM items WHERE kind = 'goal' AND status != 'done' ORDER BY created_at"),
  ]);
  const pick = (d) => Object.fromEntries(USERS.map((u) => [u, lines.find((l) => l.day === d && l.user === u)?.text ?? null]));
  return json({
    me,
    names: names(env),
    today: day,
    anniversary: env.ANNIVERSARY,
    daysTogether: daysBetween(env.ANNIVERSARY, day) + 1,
    lines: { today: pick(day), yesterday: pick(yesterday) },
    juice,
    meet: meet && meet.day >= day ? { ...meet, daysLeft: daysBetween(day, meet.day) } : null,
    where,
    together: { learning: doing, films: { count: films.length, next: films[0] || null }, song, goals },
  });
}

// ---------- 每天一句话 ----------
// 每人每天一句，当天可以改；不提醒、不计数

async function setLine(request, env, me) {
  const { text } = await request.json();
  const t = clip(text, 140);
  if (!t) throw new HttpError(400, '写一句吧');
  await env.DB.prepare(
    `INSERT INTO lines (day, user, text, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(day, user) DO UPDATE SET text = excluded.text`,
  ).bind(today(env), me, t, Date.now()).run();
  return json({ ok: true });
}

// ---------- 时光记忆本 ----------
// 记忆 + 每天一句话的历史放在一起看；写给未来的信仍走 /letters

async function listMemory(env) {
  const [{ results: memories }, { results: lines }] = await Promise.all([
    env.DB.prepare('SELECT * FROM memories ORDER BY day DESC, created_at DESC').all(),
    env.DB.prepare('SELECT day, user, text FROM lines ORDER BY day DESC LIMIT 730').all(),
  ]);
  const byDay = new Map();
  for (const l of lines) {
    if (!byDay.has(l.day)) byDay.set(l.day, {});
    byDay.get(l.day)[l.user] = l.text;
  }
  return json({
    memories,
    lines: [...byDay].map(([day, t]) => ({ day, ...t })),
    names: names(env),
    today: today(env),
  });
}

async function addMemory(request, env, me) {
  const form = await request.formData();
  const title = clip(form.get('title'), 60);
  const day = form.get('day');
  if (!title) throw new HttpError(400, '给这段记忆起个标题');
  if (!isDay(day)) throw new HttpError(400, '日期不对');
  const photoKey = await savePhoto(env, form.get('photo'), 'memory', me);
  await env.DB.prepare(
    'INSERT INTO memories (day, title, body, photo_key, author, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(day, title, clip(form.get('body'), 3000), photoKey, me, Date.now()).run();
  return json({ ok: true });
}

async function delMemory(env, id) {
  const row = await env.DB.prepare('SELECT photo_key FROM memories WHERE id = ?').bind(id).first();
  if (row?.photo_key) await env.PHOTOS.delete(row.photo_key);
  return del(env, 'memories', id);
}

// ---------- 一起做的事：学习 / 电影 / 音乐 / 成长 ----------
// 共用 items 表；每条下面两个人各写的话在 comments（短评、收获、感受、进展）

async function listItems(env, kind) {
  if (!KINDS.includes(kind)) throw new HttpError(400, '没有这一类');
  const [{ results: items }, { results: comments }] = await Promise.all([
    env.DB.prepare('SELECT * FROM items WHERE kind = ? ORDER BY created_at DESC').bind(kind).all(),
    env.DB.prepare(
      'SELECT c.* FROM comments c JOIN items i ON i.id = c.item_id WHERE i.kind = ? ORDER BY c.created_at',
    ).bind(kind).all(),
  ]);
  const by = new Map();
  for (const c of comments) {
    if (!by.has(c.item_id)) by.set(c.item_id, []);
    by.get(c.item_id).push(c);
  }
  return json({ items: items.map((i) => ({ ...i, comments: by.get(i.id) || [] })), names: names(env), today: today(env) });
}

async function addItem(request, env, me) {
  const { kind, title, sub, link, owner, status, note } = await request.json();
  if (!KINDS.includes(kind)) throw new HttpError(400, '没有这一类');
  const t = clip(title, 80);
  if (!t) throw new HttpError(400, '写个名字');
  const st = STATUSES.includes(status) ? status : 'want';
  const url = clip(link, 300);
  if (url && !/^https?:\/\//.test(url)) throw new HttpError(400, '链接要以 http 开头');
  const day = today(env);
  const { meta } = await env.DB.prepare(
    'INSERT INTO items (kind, title, sub, link, owner, status, done_day, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(kind, t, clip(sub, 60), url, OWNERS.includes(owner) ? owner : 'both', st, st === 'done' ? day : null, me, Date.now()).run();
  const n = clip(note, 300);
  if (n) {
    await env.DB.prepare('INSERT INTO comments (item_id, user, text, day, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(meta.last_row_id, me, n, day, Date.now()).run();
  }
  return json({ ok: true, id: meta.last_row_id });
}

async function setItemStatus(request, env, id) {
  const { status } = await request.json();
  if (!STATUSES.includes(status)) throw new HttpError(400, '状态不对');
  await env.DB.prepare('UPDATE items SET status = ?, done_day = ? WHERE id = ?')
    .bind(status, status === 'done' ? today(env) : null, id).run();
  return json({ ok: true });
}

async function delItem(env, id) {
  await env.DB.prepare('DELETE FROM comments WHERE item_id = ?').bind(id).run();
  return del(env, 'items', id);
}

async function addComment(request, env, me, id) {
  const { text } = await request.json();
  const t = clip(text, 300);
  if (!t) throw new HttpError(400, '写一句吧');
  const item = await env.DB.prepare('SELECT id FROM items WHERE id = ?').bind(id).first();
  if (!item) throw new HttpError(404, '这一条不在了');
  await env.DB.prepare('INSERT INTO comments (item_id, user, text, day, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, me, t, today(env), Date.now()).run();
  return json({ ok: true });
}



// 各自在哪个城市，用来显示对方那边现在几点
async function setWhere(request, env, me) {
  const { city, tz } = await request.json();
  if (typeof tz !== 'string' || !tz) throw new HttpError(400, '时区不对');
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    throw new HttpError(400, '时区不对');
  }
  const where = await getState(env, 'where', {});
  where[me] = { city: clip(city, 20) || '', tz };
  await setState(env, 'where', where);
  return json({ ok: true });
}

// 下次见面：两个人共用一个日期和地点，清空就传空日期
async function setMeet(request, env) {
  const { day, place } = await request.json();
  if (!day) {
    await setState(env, 'meet', null);
    return json({ ok: true });
  }
  if (!isDay(day)) throw new HttpError(400, '日期不对');
  await setState(env, 'meet', { day, place: clip(place, 40) || '' });
  return json({ ok: true });
}


// ---------- 对方说明书 ----------

async function listManual(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM manual_items ORDER BY category, created_at',
  ).all();
  return json({ items: results, names: names(env) });
}

async function addManual(request, env, me) {
  const { about, category, text, note } = await request.json();
  if (!USERS.includes(about)) throw new HttpError(400, '写给谁的？');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, '分类不对');
  if (!text || !text.trim()) throw new HttpError(400, '内容不能为空');
  await env.DB.prepare(
    'INSERT INTO manual_items (about, author, category, text, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(about, me, category, clip(text, 60), clip(note, 200), Date.now()).run();
  return json({ ok: true });
}

// ---------- 果蔬汁 ----------
// 不算轮次、不算连胜：只记谁哪天喝了哪杯，让对方看得到，喝不喝、喝哪杯自己定

async function lastDrinks(env) {
  const { results } = await env.DB.prepare(
    `SELECT c.user, c.day, c.recipe_id, c.recipe FROM juice_checkins c
     JOIN (SELECT user, MAX(created_at) AS t FROM juice_checkins GROUP BY user) last
       ON last.user = c.user AND last.t = c.created_at`,
  ).all();
  return Object.fromEntries(USERS.map((u) => [u, results.find((r) => r.user === u) || null]));
}

async function listJuice(env) {
  const [{ results }, last] = await Promise.all([
    env.DB.prepare('SELECT id, user, day, recipe_id, recipe FROM juice_checkins ORDER BY created_at DESC LIMIT 60').all(),
    lastDrinks(env),
  ]);
  return json({ items: results, last, names: names(env), today: today(env) });
}

async function addJuice(request, env, me) {
  const { recipe_id, recipe } = await request.json();
  await env.DB.prepare(
    'INSERT INTO juice_checkins (user, day, recipe_id, recipe, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(me, today(env), clip(recipe_id, 20), clip(recipe, 100), Date.now()).run();
  return json({ ok: true });
}

// 购物清单两个人共用一份
async function setShop(request, env) {
  const { picks } = await request.json();
  const clean = Array.isArray(picks) ? picks.filter((p) => typeof p === 'string').slice(0, 20) : [];
  await setState(env, 'shop', clean);
  return json({ ok: true, picks: clean });
}





// ---------- 地图 + 愿望清单 ----------

async function listPlaces(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM places ORDER BY COALESCE(day, '') DESC, created_at DESC",
  ).all();
  return json({ items: results, names: names(env) });
}

async function addPlace(request, env, me) {
  const form = await request.formData();
  const kind = form.get('kind') === 'want' ? 'want' : 'been';
  const name = clip(form.get('name'), 40);
  const lon = Number(form.get('lon'));
  const lat = Number(form.get('lat'));
  if (!name) throw new HttpError(400, '写一下地名');
  if (!form.get('lon') || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    throw new HttpError(400, '先在地图上点一下位置');
  }
  const day = form.get('day');
  const photoKey = await savePhoto(env, form.get('photo'), 'place', me);
  await env.DB.prepare(
    'INSERT INTO places (kind, name, lon, lat, day, note, photo_key, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(kind, name, lon, lat, isDay(day) ? day : null, clip(form.get('note'), 300), photoKey, me, Date.now()).run();
  return json({ ok: true });
}

async function markBeen(env, id) {
  await env.DB.prepare("UPDATE places SET kind = 'been', day = COALESCE(day, ?) WHERE id = ?")
    .bind(today(env), id).run();
  return json({ ok: true });
}

async function listWishes(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM wishes ORDER BY done_day IS NOT NULL, COALESCE(done_day, '') DESC, created_at",
  ).all();
  return json({ items: results, names: names(env) });
}

async function addWish(request, env, me) {
  const { text } = await request.json();
  if (!text || !text.trim()) throw new HttpError(400, '写一个愿望');
  await env.DB.prepare('INSERT INTO wishes (text, author, created_at) VALUES (?, ?, ?)')
    .bind(clip(text, 80), me, Date.now()).run();
  return json({ ok: true });
}

async function toggleWish(env, me, id) {
  await env.DB.prepare(
    `UPDATE wishes SET done_by = CASE WHEN done_day IS NULL THEN ? ELSE NULL END,
       done_day = CASE WHEN done_day IS NULL THEN ? ELSE NULL END WHERE id = ?`,
  ).bind(me, today(env), id).run();
  return json({ ok: true });
}

// ---------- 时光胶囊 ----------
// 没到开启日的信，接口只给标题和日期，正文留在数据库里

async function listLetters(env, me) {
  const day = today(env);
  const { results } = await env.DB.prepare('SELECT * FROM letters ORDER BY open_on, created_at').all();
  const items = results
    .filter((l) => l.to_user === 'both' || l.to_user === me || l.author === me)
    .map((l) => {
      const open = l.open_on <= day;
      return {
        id: l.id,
        author: l.author,
        to: l.to_user,
        title: l.title,
        openOn: l.open_on,
        writtenOn: dayOf(l.created_at, env),
        open,
        daysLeft: open ? 0 : daysBetween(day, l.open_on),
        body: open ? l.body : null,
      };
    });
  return json({ items, names: names(env), today: day });
}

async function addLetter(request, env, me) {
  const { to, title, body, openOn } = await request.json();
  if (!['raven', 'billy', 'both'].includes(to)) throw new HttpError(400, '写给谁？');
  if (!title || !title.trim() || !body || !body.trim()) throw new HttpError(400, '标题和正文都要写');
  if (!isDay(openOn) || openOn <= today(env)) throw new HttpError(400, '开启日期要选在今天之后');
  await env.DB.prepare(
    'INSERT INTO letters (author, to_user, title, body, open_on, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(me, to, clip(title, 40), clip(body, 5000), openOn, Date.now()).run();
  return json({ ok: true });
}

// ---------- 照片（Workers KV） ----------

async function savePhoto(env, file, prefix, me) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) throw new HttpError(400, '照片太大了');
  if (!file.type.startsWith('image/')) throw new HttpError(400, '只能传图片');
  const key = `${prefix}/${today(env)}/${me}-${crypto.randomUUID()}.jpg`;
  await env.PHOTOS.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  return key;
}

async function photo(env, key) {
  const { value, metadata } = await env.PHOTOS.getWithMetadata(key, 'stream');
  if (!value) throw new HttpError(404, '照片不见了');
  return new Response(value, {
    headers: {
      'Content-Type': metadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

// ---------- 小工具 ----------

async function del(env, table, id) {
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

// 只能删自己写的
async function delOwn(env, table, col, id, me) {
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND ${col} = ?`).bind(id, me).run();
  return json({ ok: true });
}

async function getState(env, key, fallback) {
  const row = await env.DB.prepare('SELECT value FROM state WHERE key = ?').bind(key).first();
  return row ? JSON.parse(row.value) : fallback;
}

async function setState(env, key, value) {
  await env.DB.prepare(
    'INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).bind(key, JSON.stringify(value)).run();
}

function clip(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
