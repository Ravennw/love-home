# 我们的小窝 · home.ravenweng.com

Raven & Billy 的情侣网站。Cloudflare Workers + D1（数据库，APAC）+ Workers KV（照片）。2026-10-24 已上线。

## 视觉

跟主站 ravenweng.com 同一套规则（`~/Desktop/Claude/交付物/Journey设计标准.html`）：黑色导航条 + 流动咖啡光背景（`public/flow.js`，参数取自主站 `home/pixelbg.js` 黑夜版）+ 白色内容窗口和 48 高黑色页眉条；Inter / Instrument Sans；字号只用 12/13/14/15/17/22/26/30；按钮高 32 圆角 6 无描边；界面不出现 emoji；手机 760 以下单列。果蔬汁配方和封面图复用主站 Wellness 的 6 款（`public/recipes/`）。

## 现在的模块（2026-10-25 改版：一起做有意义的事）

不做打卡，也不做闲聊。说话只留「每天一句话」和「时光记忆本」，其余是两个人一起做的事。

- HOME：在一起天数；每天一句话（每人每天一句，可改）；此刻（两人当地时间、下次见面倒数）；一起在做的五格概览
- MEMORY 时光记忆本：记忆（可配照片）、每天一句的历史、写给未来的信（原时光胶囊，开启日前不返回正文）
- LEARN 一起学习：在学 / 想学 / 学完，学完写一句收获
- WATCH 一起看电影：共同片单，看过后两人各写一句短评；「今晚看什么」随机抽一部
- MUSIC 一起听音乐：推荐给对方的歌，附一句为什么，对方听后回一句
- GROW 一起成长：按人分栏的年度目标，偶尔写一句进展
- HEALTH 健康：抗炎果蔬汁（同主站 Wellness 配方、「我喝了这杯」、共享购物清单）+ 对方说明书
- MAP：点阵世界地图记去过/想去的地方 + 愿望清单

学习、电影、音乐、成长共用 items 表（kind 区分），下面两人各自写的话在 comments 表。
已删的功能（每日一问、纸条和想你了、心情天气、植物、年报）只是去掉了页面和接口，对应的表和数据都还在。

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
| `ANNIVERSARY` | 在一起的日子，首页天数从这天算 |
| `HOME_TZ` | 判断"今天"用的时区 |

