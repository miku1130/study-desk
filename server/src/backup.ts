/**
 * 数据库定时备份。
 *
 * 全站数据就一个 SQLite 文件，磁盘坏一次、误删一次就全没了，而这些是用户
 * 攒了几个月的专注记录。better-sqlite3 的 backup() 是在线备份，运行中拷贝
 * 也能得到一致快照，不用停服。
 */
import { readdirSync, statSync, unlinkSync } from 'fs'
import { mkdirSync } from 'fs'
import { join } from 'path'

const PREFIX = 'study-room-'
const SUFFIX = '.db'
const NAME_PATTERN = /^study-room-\d{8}-\d{6}\.db$/

/** 文件名里带时间戳，字典序即时间序，列目录就是按时间排好的 */
export function backupFileName(at: number): string {
  const d = new Date(at)
  const p = (n: number): string => String(n).padStart(2, '0')
  const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
  const time = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `${PREFIX}${day}-${time}${SUFFIX}`
}

/** 超出保留份数的备份，从最旧开始 */
export function expiredBackups(files: string[], keep: number): string[] {
  const limit = Math.max(1, Math.floor(keep))
  const mine = files.filter((name) => NAME_PATTERN.test(name)).sort()
  return mine.slice(0, Math.max(0, mine.length - limit))
}

export interface BackupSource {
  backup(destination: string): Promise<unknown>
}

export interface BackupOptions {
  db: BackupSource
  dir: string
  /** 保留份数 */
  keep: number
  intervalMs: number
  now?: () => number
  onDone?: (info: { file: string; at: number }) => void
  onError?: (err: unknown) => void
}

export interface BackupRunner {
  runOnce(): Promise<string | null>
  stop(): void
  lastBackupAt(): number
}

export function startBackups(options: BackupOptions): BackupRunner {
  const now = options.now ?? Date.now
  let lastAt = 0
  let running = false

  async function runOnce(): Promise<string | null> {
    // 上一次还没拷完就跳过，别让备份自己把磁盘打满
    if (running) return null
    running = true
    try {
      mkdirSync(options.dir, { recursive: true })
      const file = backupFileName(now())
      await options.db.backup(join(options.dir, file))
      lastAt = now()
      prune(options.dir, options.keep)
      options.onDone?.({ file, at: lastAt })
      return file
    } catch (err) {
      options.onError?.(err)
      return null
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => void runOnce(), options.intervalMs)
  // 常驻进程的定时器不该拖着退出流程
  timer.unref?.()

  return {
    runOnce,
    stop: () => clearInterval(timer),
    lastBackupAt: () => lastAt
  }
}

function prune(dir: string, keep: number): void {
  for (const name of expiredBackups(readdirSync(dir), keep)) {
    try {
      unlinkSync(join(dir, name))
    } catch {
      /* 删不掉就留着，下一轮再试，总比因此中断备份好 */
    }
  }
}

/** 现有备份概览，用于 /health 自检 */
export function backupSummary(dir: string): { count: number; latest: string; bytes: number } {
  let names: string[] = []
  try {
    names = readdirSync(dir).filter((name) => NAME_PATTERN.test(name)).sort()
  } catch {
    return { count: 0, latest: '', bytes: 0 }
  }
  const latest = names[names.length - 1] ?? ''
  let bytes = 0
  if (latest) {
    try {
      bytes = statSync(join(dir, latest)).size
    } catch {
      bytes = 0
    }
  }
  return { count: names.length, latest, bytes }
}
