// home.ravenweng.com —— Raven & Billy 的小窝
// 静态页面由 [assets] 提供，这里只处理 /api/*

import { QUESTIONS } from './questions.js';

const USERS = ['raven', 'billy'];
const WEATHERS = ['sunny', 'cloudy', 'rainy', 'stormy', 'rainbow', 'snowy'];
const CATEGORIES = ['avoid', 'allergy', 'love', 'dislike', 'habit'];
const SESSION_DAYS = 60;
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

  const me = await currentUser(request, env);
  if (!me) throw new HttpError(401, '请先登录');

  if (method === 'GET' && seg[2] === 'photo') {
    return photo(env, decodeURIComponent(pathname.slice('/api/photo/'.length)));
  }

  const R = `${method} /${seg[2] || ''}${seg[3] ? (Number.isInteger(id) && id > 0 ? '/:id' : `/${seg[3]}`) : ''}${seg[4] ? `/${seg[4]}` : ''}`;
  switch (R) {
    case 'GET /home': return home(env, me);
    case 'POST /mood': return setMood(request, env, me);
    case 'GET /manual': return listManual(env);
    case 'POST /manual': return addManual(request, env, me);
    case 'DELETE /manual/:id': return del(env, 'manual_items', id);
    case 'GET /juice': return listJuice(env);
    case 'POST /juice': return addJuice(request, env, me);
    case 'DELETE /juice/:id': return delOwn(env, 'juice_checkins', 'user', id, me);
    case 'GET /shop': return json({ picks: await getState(env, 'shop', []) });
    case 'POST /shop': return setShop(request, env);
    case 'POST /meet': return setMeet(request, env);
    case 'POST /notes': return addNote(request, env, me);
    case 'GET /notes': return json({ items: await listNotes(env, 100), names: names(env) });
    case 'POST /where': return setWhere(request, env, me);
    case 'GET /ask': return getAsk(env, me);
    case 'POST /ask': return answer(request, env, me);
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
  const exp = Date.now() + SESSION_DAYS * DAY_MS;
  const payload = `${user}.${exp}`;
  const token = `${payload}.${await sign(payload, env.SESSION_SECRET)}`;
  return json({ ok: true, user }, 200, { 'Set-Cookie': cookie(token, SESSION_DAYS * 86400) });
}

async function currentUser(request, env) {
  const match = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
  if (!match) return null;
  const [user, exp, sig] = match[1].split('.');
  if (!USERS.includes(user) || Number(exp) < Date.now()) return null;
  return (await safeEqual(sig, await sign(`${user}.${exp}`, env.SESSION_SECRET))) ? user : null;
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
  const [{ results: moods }, juice, ask, meet, notes, where] = await Promise.all([
    env.DB.prepare(
      `SELECT m.user, m.day, m.weather, m.note FROM moods m
       JOIN (SELECT user, MAX(day) AS day FROM moods GROUP BY user) last
         ON last.user = m.user AND last.day = m.day`,
    ).all(),
    lastDrinks(env),
    askStatus(env, day, me),
    getState(env, 'meet', null),
    listNotes(env, 40),
    getState(env, 'where', {}),
  ]);
  // 打开首页就算看过了对方留的纸条：记下这次打开的时间；这次返回的仍是之前的已读状态，界面能标「新」
  await setState(env, `seen:${me}`, Date.now());
  return json({
    me,
    names: names(env),
    today: day,
    anniversary: env.ANNIVERSARY,
    daysTogether: daysBetween(env.ANNIVERSARY, day) + 1,
    moods: Object.fromEntries(moods.map((m) => [m.user, m])),
    juice,
    ask,
    meet: meet && meet.day >= day ? { ...meet, daysLeft: daysBetween(day, meet.day) } : null,
    notes,
    where,
  });
}

// 纸条：text 为空就是一下「想你了」。每张单独一行（state 里 key 为 note:时间），两人同时发也不会互相覆盖；
// 已读不逐条存，看收件人最后一次打开首页的时间（seen:用户）
async function addNote(request, env, me) {
  const { text } = await request.json();
  const at = Date.now();
  await setState(env, `note:${String(at).padStart(15, '0')}-${crypto.randomUUID().slice(0, 8)}`, { from: me, text: clip(text, 200) || '', at });
  return json({ ok: true });
}

async function listNotes(env, limit) {
  const [{ results }, seen] = await Promise.all([
    env.DB.prepare("SELECT key, value FROM state WHERE key LIKE 'note:%' ORDER BY key DESC LIMIT ?").bind(limit).all(),
    Promise.all(USERS.map((u) => getState(env, `seen:${u}`, 0))),
  ]);
  const seenBy = Object.fromEntries(USERS.map((u, i) => [u, seen[i]]));
  return results.map((r) => {
    const n = JSON.parse(r.value);
    const to = USERS.find((u) => u !== n.from);
    return { id: r.key, ...n, read: seenBy[to] >= n.at };
  });
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

async function setMood(request, env, me) {
  const { weather, note } = await request.json();
  if (!WEATHERS.includes(weather)) throw new HttpError(400, '没有这种天气');
  await env.DB.prepare(
    `INSERT INTO moods (user, day, weather, note, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user, day) DO UPDATE SET weather = excluded.weather, note = excluded.note,
       created_at = excluded.created_at`,
  ).bind(me, today(env), weather, clip(note, 80), Date.now()).run();
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

// ---------- 每日一问 ----------
// 自己没答之前，接口不返回对方的答案

function questionFor(env, day) {
  const n = Math.max(0, daysBetween(env.ANNIVERSARY, day));
  return QUESTIONS[n % QUESTIONS.length];
}

async function askStatus(env, day, me) {
  const { results } = await env.DB.prepare('SELECT user FROM answers WHERE day = ?').bind(day).all();
  const done = new Set(results.map((r) => r.user));
  return {
    question: questionFor(env, day),
    done: Object.fromEntries(USERS.map((u) => [u, done.has(u)])),
    mine: done.has(me),
  };
}

async function getAsk(env, me) {
  const day = today(env);
  const { results } = await env.DB.prepare(
    'SELECT day, user, text FROM answers ORDER BY day DESC LIMIT 400',
  ).all();
  const byDay = new Map();
  for (const r of results) {
    if (!byDay.has(r.day)) byDay.set(r.day, {});
    byDay.get(r.day)[r.user] = r.text;
  }
  // 自己答过才能看到对方的；自己没答，对方的只告诉你"已答"（true）
  const reveal = (d, a) => ({
    day: d,
    question: questionFor(env, d),
    answers: Object.fromEntries(USERS.map((u) => [u, u === me || a[me] ? a[u] ?? null : a[u] ? true : null])),
  });
  const todays = reveal(day, byDay.get(day) || {});
  const past = [...byDay].filter(([d]) => d !== day).map(([d, a]) => reveal(d, a));
  return json({ today: todays, past, names: names(env) });
}

async function answer(request, env, me) {
  const { text } = await request.json();
  if (!text || !text.trim()) throw new HttpError(400, '写点什么吧');
  await env.DB.prepare(
    `INSERT INTO answers (day, user, text, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(day, user) DO UPDATE SET text = excluded.text`,
  ).bind(today(env), me, clip(text, 1000), Date.now()).run();
  return json({ ok: true });
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
