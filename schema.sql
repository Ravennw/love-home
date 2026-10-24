CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  day TEXT NOT NULL,          -- YYYY-MM-DD（HOME_TZ）
  weather TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(user, day)
);

-- 对方说明书：about 是被描述的人，author 是写的人
CREATE TABLE IF NOT EXISTS manual_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  about TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,     -- avoid / allergy / love / dislike / habit
  text TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS juice_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  day TEXT NOT NULL,
  recipe_id TEXT,              -- 对应 public/recipes/juices.json 的 id，自己配的为空
  recipe TEXT,
  note TEXT,
  photo_key TEXT,
  liked INTEGER NOT NULL DEFAULT 0,  -- 对方点的爱心
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_juice_day ON juice_checkins(day);

-- 每日一问：一天一题，两人各答一次
CREATE TABLE IF NOT EXISTS answers (
  day TEXT NOT NULL,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, user)
);

-- 植物：每人每天浇一次水
CREATE TABLE IF NOT EXISTS waters (
  day TEXT NOT NULL,
  user TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, user)
);

-- 地图：been 去过 / want 想去；lon/lat 是在点阵地图上点出来的位置
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  lon REAL NOT NULL,
  lat REAL NOT NULL,
  day TEXT,
  note TEXT,
  photo_key TEXT,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  done_day TEXT,
  done_by TEXT,
  created_at INTEGER NOT NULL
);

-- 时光胶囊：open_on 之前接口不返回正文
CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  to_user TEXT NOT NULL,       -- raven / billy / both
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  open_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 零碎的共享状态：购物清单勾选、植物名字
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 10-25 改版：每天一句话 + 时光记忆本 + 一起做的事（学习 / 电影 / 音乐 / 成长）

-- 每天一句话：每人每天一句，能改不能多
CREATE TABLE IF NOT EXISTS lines (
  day TEXT NOT NULL,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, user)
);

-- 时光记忆本：值得记住的事，可配照片（照片在 KV）
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  photo_key TEXT,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 一起做的事共用一张表：kind = learn 学习 / film 电影 / song 音乐 / goal 成长
-- status：want 想做 / doing 在做 / done 做完；owner：raven / billy / both
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  sub TEXT,
  link TEXT,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  done_day TEXT,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);

-- 每条下面两个人各自写的话：电影短评、学完的收获、听歌的感受、成长的进展
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user TEXT NOT NULL,
  text TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
