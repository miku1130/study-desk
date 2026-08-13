# 公网自习室服务端

客户端通过 `wss://study.lemon21.cn/ws` 连过来，TLS 由 nginx 终止，本服务只监听 `127.0.0.1:3100`。

设计与验收标准见 `docs/superpowers/specs/2026-08-12-public-study-room-prd.md`。

## 结构

| 文件 | 职责 |
| --- | --- |
| `src/stats.ts` | SQLite 持久层：档案、每日专注、自习室与成员关系、打卡、许愿墙。不碰 socket，可直接单测 |
| `src/presence.ts` | 内存态的「此刻谁在房里」。成员关系是持久的，在座与否是临时的，两者必须分开 |
| `src/backup.ts` | 定时在线备份与保留策略 |
| `src/index.ts` | WebSocket 接入、消息路由、广播合并、心跳、优雅关闭 |
| `scripts/smoke.mjs` | 端到端冒烟，起真实连接跑一遍建室 / 进出房 / 打卡 / 许愿 / 举报复核 / 战绩 / 解散 |
| `scripts/verify-backup.mjs` | 打开最新一份备份，确认表结构与行数都在 |

文本清洗、加油白名单、猫咪白名单直接复用客户端的 `src/main/studyRoom/protocol.ts`，
两端共用同一份规则，避免出现「客户端说能用、服务端却拒绝」。

## 本地开发

```bash
npm install
npm run build      # esbuild 打成零依赖单文件 dist/server.cjs
npm start          # 监听 127.0.0.1:3100
node scripts/smoke.mjs   # 另开一个终端跑冒烟
```

对着线上跑冒烟：

```bash
SMOKE_URL=wss://study.lemon21.cn/ws node scripts/smoke.mjs
```

## 部署

`ws` 已经打进 bundle，服务器上只需要装 `better-sqlite3`——它是原生模块，打不进单文件。
目标机器是 Node 20，装 `better-sqlite3@^11`；12.x 的预编译包在 Node 20 上会段错误。

打包必须是 CJS 格式。`ws` 是 CommonJS，打成 ESM 后它内部的 `require('events')`
会变成不被支持的动态 require，进程起不来。

```bash
npm run build
scp dist/server.cjs root@<host>:/opt/study-room/
ssh root@<host> "pm2 restart study-room"
```

首次部署：

```bash
ssh root@<host> "mkdir -p /opt/study-room && cd /opt/study-room && npm i better-sqlite3@^11"
scp dist/server.cjs root@<host>:/opt/study-room/
ssh root@<host> "cd /opt/study-room && PORT=3100 HOST=127.0.0.1 pm2 start server.cjs --name study-room --time && pm2 save"
```

数据落在 `/opt/study-room/data/stats.db`（可用 `DB_PATH` 改路径）。

## 备份

服务自己每 6 小时做一次在线备份到 `data/backups/`，滚动保留 30 份，启动时也会先存一份。
用的是 SQLite 的 backup API，运行中拷贝也是一致快照，不用停服。

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `BACKUP_DIR` | `<DB_PATH 同级>/backups` | 备份目录 |
| `BACKUP_INTERVAL_MS` | 21600000（6 小时） | 备份间隔 |
| `BACKUP_KEEP` | 30 | 保留份数，最少 1 |

```bash
curl -s https://study.lemon21.cn/health          # backups / latestBackup / lastBackupAt
node verify-backup.mjs /opt/study-room/data/backups   # 打开最新一份确认真的可读
```

恢复就是停服、把备份文件拷成 `data/stats.db`、再起服务——注意同时删掉遗留的 `-wal` / `-shm`。

代码放 `/opt` 而不是站点目录：nginx 的 `try_files` 会把站点目录下的文件当静态资源直接返回，
源码放进去等于对外公开。

## 运维

```bash
pm2 logs study-room --lines 50
curl https://study.lemon21.cn/health     # {"ok":true,"rooms":N,"clients":M}
```

nginx 站点配置在 `/www/server/panel/vhost/nginx/study.lemon21.cn.conf`，其中两处不能动：

- `/ws` 的 `proxy_read_timeout` 是 3600s。自习室是长连接，成员可能整场专注不产生业务帧，
  nginx 默认的 60s 会把连接掐断，表现为「每分钟自己掉线一次」。
- HTTP 段保留了 `.well-known/acme-challenge` 且排在 301 之前，删掉证书续期会静默失败。
