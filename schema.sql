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
