# 我们的小窝 · home.ravenweng.com

Raven & Billy 的情侣网站。Cloudflare Workers + D1（数据库，APAC）+ Workers KV（照片）。2026-10-24 已上线。

## 视觉

跟主站 ravenweng.com 同一套规则（`~/Desktop/Claude/交付物/Journey设计标准.html`）：黑色导航条 + 流动咖啡光背景（`public/flow.js`，参数取自主站 `home/pixelbg.js` 黑夜版）+ 白色内容窗口和 48 高黑色页眉条；Inter / Instrument Sans；字号只用 12/13/14/15/17/22/26/30；按钮高 32 圆角 6 无描边；界面不出现 emoji；手机 760 以下单列。果蔬汁配方和封面图复用主站 Wellness 的 6 款（`public/recipes/`）。

## 现在的模块（2026-10-25 做过一轮减法）

- 首页：在一起天数、两人心情天气；Today 里是下次见面倒数、每日一问、两人最近一次喝果蔬汁
- Ask：每日一问，60 题轮换（src/questions.js），自己答完才能看到对方的
- Juice：照主站 Wellness 的抗炎果蔬汁栏目（6 款大图配方、今天喝什么、两人共用购物清单）；卡片上「我喝了这杯」，对方看得到你最近一次喝的是哪天哪杯，不算轮次和连胜
- Map：点阵世界地图（public/worldmap.svg，Natural Earth 公有领域数据生成）记去过/想去的地方 + 愿望清单
- Capsule：时光胶囊，开启日前接口不返回正文
- Manual：对方说明书

10-25 删掉了共养植物（Plant）、恋爱年报（Year）、果蔬汁的轮次/连胜/爱心；对应的表（waters 等）和数据都还在，代码在 git 历史里。

## 本地开发

```bash
npm install
npx wrangler d1 execute love-home --local --persist-to /tmp/lh-state --file=schema.sql
npx wrangler dev --port 8790 --persist-to /tmp/lh-state   # 多个会话同时开发时各用各的 persist 目录，否则 SQLITE_BUSY
```

本地密码在 `.dev.vars` 里（`raven-local` / `billy-local`），只在本机生效。

## 部署到 home.ravenweng.com

```bash
npx wrangler login                              # 浏览器里授权 Cloudflare 账号
npx wrangler d1 create love-home --location=apac   # 已建好，ID 在 wrangler.toml
npx wrangler kv namespace create love-home-photos   # 已建好（R2 需绑卡，先用 KV，免费 1GB）
npm run db:remote                               # 在线上数据库建表

# 设置密码和签名密钥（命令会提示输入，不会出现在代码里）
npx wrangler secret put PASSWORD_RAVEN
npx wrangler secret put PASSWORD_BILLY
npx wrangler secret put SESSION_SECRET          # 随便一长串随机字符

npm run deploy
```

`wrangler.toml` 里的 `routes` 已经声明了 `home.ravenweng.com` 为自定义域名，
因为 ravenweng.com 托管在同一个 Cloudflare 账号下，部署时会自动创建 DNS 记录和证书，不用手动加 CNAME。

## 可调的配置（`wrangler.toml` 的 `[vars]`）

| 变量 | 作用 |
| --- | --- |
| `NAME_RAVEN` / `NAME_BILLY` | 页面上显示的昵称 |
| `ANNIVERSARY` | 在一起的日子，天数和每日一问的轮换都从这天算 |
| `HOME_TZ` | 判断"今天"用的时区 |

