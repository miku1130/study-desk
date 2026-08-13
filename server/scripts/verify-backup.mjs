/**
 * 备份可用性自检：随便挑最新一份备份打开，确认表结构与行数都在。
 * 备份最怕的是「一直在跑，出事才发现拷出来的是空文件」。
 *
 * 用法：node scripts/verify-backup.mjs [备份目录]
 */
import Database from 'better-sqlite3'
import { readdirSync } from 'fs'
import { join } from 'path'

const dir = process.argv[2] ?? '/opt/study-room/data/backups'
const files = readdirSync(dir)
  .filter((name) => /^study-room-\d{8}-\d{6}\.db$/.test(name))
  .sort()

if (!files.length) {
  console.error(`${dir} 里没有备份文件`)
  process.exit(1)
}

const latest = files[files.length - 1]
const db = new Database(join(dir, latest), { readonly: true })
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((r) => r.name)
  .filter((name) => !name.startsWith('sqlite_'))

const counts = Object.fromEntries(
  tables.map((name) => [name, db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c])
)
db.close()

const required = ['profiles', 'focus_daily', 'rooms', 'room_members', 'checkins', 'wishes']
const missing = required.filter((name) => !tables.includes(name))

console.log(`备份 ${latest}（共 ${files.length} 份）`)
console.log('行数：', counts)
if (missing.length) {
  console.error('缺少表：', missing.join(', '))
  process.exit(1)
}
console.log('结构完整')
