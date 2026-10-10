# 涿鹿风云 · 三部落洪荒争霸 — 项目状态文档

## 概述

类 Travian 的洪荒部落策略游戏。玩家选择部落（华夏/蚩尤/炎帝），发展村庄（资源田/建筑/科技/兵力），攻击妖兽据点和真实玩家，参与赛季排名。

- **线上地址**: https://o1942.github.io/3God/
- **仓库**: https://github.com/o1942/3God.git (gh-pages 分支部署)
- **开发目录**: `/workspace/travian-mvp`
- **部署目录**: `/workspace/3God` → push 到 gh-pages

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 状态 | Zustand（单 store，`src/store/gameStore.ts`） |
| 样式 | Tailwind CSS（仿古羊皮纸主题） |
| 后端 | Supabase（PostgreSQL + Realtime + RPC） |
| 音效 | Web Audio API 程序合成（`src/game/sound.ts`） |
| 部署 | GitHub Pages（单页应用，静态托管） |

## 项目结构

```
src/
├── App.tsx                    # 主应用，路由/导航/浮层
├── game/
│   ├── types.ts              # 所有 TypeScript 类型
│   ├── config.ts            # 建筑/资源田配置
│   ├── initialState.ts      # 初始村庄状态
│   ├── units.ts             # 兵种/阵型/战斗模拟
│   ├── pvp.ts               # NPC 村庄 + PvP 战斗
│   ├── season.ts            # 赛季/里程碑/离线收益
│   ├── shield.ts            # 护盾系统
│   ├── sound.ts             # 音效系统
│   ├── notifications.ts     # 浏览器推送通知
│   ├── tech.ts              # 科技研发
│   ├── tribes.ts            # 部落加成
│   ├── cosmetics.ts         # 外观商城
│   └── quests.ts            # 任务系统
├── store/
│   ├── gameStore.ts         # 主状态 store（~2000 行）
│   └── toast.ts             # Toast 通知
├── lib/
│   └── supabase.ts          # Supabase 客户端（动态加载）
├── components/
│   ├── LoginScreen.tsx
│   ├── VillageView.tsx       # 资源田视图
│   ├── ResourceBar.tsx       # 资源条
│   ├── BuildingPanel.tsx     # 建造面板
│   ├── BarracksPanel.tsx     # 军帐
│   ├── MapPanel.tsx         # 地图（据点+NPC+真实玩家出征）
│   ├── LeaderboardPanel.tsx # 全服排行榜+互攻+侦查
│   ├── SeasonPanel.tsx     # 赛季面板
│   ├── EventLogPanel.tsx   # 事件日志
│   ├── QuestPanel.tsx      # 任务面板
│   ├── CosmeticShop.tsx    # 外观商城
│   ├── TutorialGuide.tsx   # 新手引导
│   ├── SeasonEndOverlay.tsx # 赛季结算动画
│   ├── OfflineReportLayer.tsx # 离线收益弹窗
│   └── ...
└── index.css               # 全局样式 + 移动端适配

supabase-*.sql               # SQL 文件（按功能分）
.env                         # Supabase 配置
vite.config.ts               # 构建配置（代码分割）
```

## Supabase 数据库

| 表/函数 | 用途 |
|---|---|
| `villages` | 玩家村庄数据（village_data JSON） |
| `players` | 玩家账号（name + password_hash） |
| `sessions` | 登录会话（token + expires_at） |
| `save_village(token, data)` | 存档（含安全校验：类型/天花板/速率） |
| `login_player(name, hash)` | 登录，返回 token |
| `register_player(name, hash)` | 注册 |
| `list_leaderboard()` | 全服排行榜 |
| `attack_player(token, target, ...)` | 真实玩家互攻（护盾拦截+掠夺钳制） |

### 安全校验（P0 已完成）

`save_village` 函数三层校验：
1. 类型与非负（资源/兵力/纹玉/积分 ≥ 0）
2. 硬性天花板（资源 ≤16000、建筑 ≤20级、科技 ≤3级、兵力 ≤50000）
3. 变更速率（资源 ≤20000/小时、兵力 ≤6000/小时、纹玉单次 ≤+200、积分单次 ≤+200）

## 已完成功能

### 核心玩法
- ✅ 3 部落选择（华夏/蚩尤/炎帝，各有加成）
- ✅ 4 资源田（木/泥/铁/粮）升级生产
- ✅ 12+ 建筑（封禅台/仓库/军帐/集市/点将台/城墙...）
- ✅ 5 兵种 + 4 阵型（ Wings/Front/Flank/Siege ）
- ✅ 科技研发（4 条线）
- ✅ 妖兽据点（NPC 据点，可攻击/驻守/回收）
- ✅ 集市交易（系统交易，有税率，不是玩家间）

### PvP & 跨玩家
- ✅ NPC 村庄攻击（AI 反击）
- ✅ 真实玩家互攻（排行榜 → 选兵 → 出征 → 到达结算）
- ✅ 护盾系统（新手保护期 7 天 + 主动护盾）
- ✅ 来袭战报（被攻击时实时推送）
- ✅ 侦查系统（全服排行榜可🔍侦查兵种详情）

### 赛季 & 任务
- ✅ 赛季系统（7 天一季，积分 + 里程碑奖励）
- ✅ 赛季结算动画
- ✅ 任务系统（洪荒征途首日任务链）
- ✅ 离线收益（30秒阈值，8小时上限）

### 社交 & UI
- ✅ 全服排行榜（实力榜/赛季榜）
- ✅ 事件日志（战报归档持久化）
- ✅ 新手引导（4 步教学）
- ✅ 外观商城（纹玉购买，反 P2W）

### 性能 & 体验
- ✅ 代码分割（首屏 127KB gzip，面板懒加载）
- ✅ Supabase 动态加载（首屏不加载 55KB SDK）
- ✅ 运行时优化（memo + selector）
- ✅ 音效系统（15 种程序合成音效）
- ✅ 移动端震动反馈
- ✅ 移动端适配（触控尺寸/横屏/安全区）
- ✅ 推送通知（被攻击/建造完成/妖兽来袭）

## 待做功能

### P2（优先级中）
- ⬜ 集市挂单撮合：玩家间资源互换，需要 `market_orders` 表 + 撮合 RPC + UI
- ⬜ 联盟系统：创建/加入联盟、联盟聊天、联盟科技，需要 `alliances` + `alliance_members` + `alliance_chat` 三张表

### P1（优先级低）
- ⬜ gameStore 拆分（2010 行 → 按领域拆分）

## 开发约定

- SQL 文件命名：`supabase-{功能}.sql`（如 `supabase-pvp.sql`、`supabase-security-validation.sql`）
- 构建：`npm run build`（tsc + vite build）
- 部署：`cp dist/* /workspace/3God/ && cd /workspace/3God && git add -A && git commit -m "..." && git push origin gh-pages`
- Supabase 配置：`.env`（VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY）
- 代码注释用中文
- Toast 提示用中文
- 错误提示用中文友好文案
