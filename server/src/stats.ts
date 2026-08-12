/**
 * 服务端持久层：身份档案、专注统计、房间与成员关系、作息打卡、许愿墙。
 *
 * 身份用客户端生成的匿名 deviceId，昵称只作展示——昵称是用户随手填的字符串，
 * 拿它当凭证等于谁都能顶替榜首，两个同名的人数据还会混在一起。
 *
 * 专注数据按「设备 × 日期」聚合，今日/本周/本月都由日期范围求和得出，
 * 不需要为每个维度各存一份。
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import {
  looksLikePromotion,
  normalizeDisplayText,
  sanitizeCatId,
  sanitizeNickname,
  sanitizeRoomName,
  validateRoomName
} from '../../src/main/studyRoom/protocol'

/** 本月榜最多回看 31 天，多留一些冗余 */
export const RETAIN_DAYS = 45
/** 单人单日上限，异常数据不至于把榜单顶爆 */
export const DAILY_CAP_SECONDS = 20 * 3600
export const LEADERBOARD_SIZE = 20
/** 房间成员上限 */
export const ROOM_MEMBER_LIMIT = 999
/** 一个人最多同时加入的房间数，防止靠批量加入刷存在感 */
export const JOINED_ROOM_LIMIT = 5
export const INTRO_MAX = 30
export const ROOM_INTRO_MAX = 40
export const WISH_MAX = 60
export const WISH_PAGE_SIZE = 30
/** 同一人两次发愿的最小间隔 */
export const WISH_COOLDOWN_MS = 60_000
/** 被举报到这个数就自动隐藏，等房主复核 */
export const WISH_AUTO_HIDE_REPORTS = 3

export type RangeKey = 'today' | 'week' | 'month'

export interface LeaderboardRow {
  deviceId: string
  nickname: string
  catId: string
  seconds: number
  rank: number
  /** 当前连续专注天数；昨天学过但今天还没学仍然算连续，今天还有机会续上 */
  streakDays: number
  /** 累计专注过的天数，不受数据保留窗口影响 */
  totalDays: number
}

export interface RoomRecord {
  id: string
  code: string
  name: string
  intro: string
  ownerDevice: string
  goalMinutes: number
  createdAt: number
  lastActiveAt: number
  memberCount: number
}

export interface RoomMemberRow {
  deviceId: string
  nickname: string
  catId: string
  intro: string
  joinedAt: number
  seconds: number
  streakDays: number
  totalDays: number
  wakeAt: string
  sleepAt: string
  rank: number
}

export interface WishRow {
  id: number
  deviceId: string
  nickname: string
  catId: string
  text: string
  createdAt: number
  reports: number
  mine: boolean
}

export interface TextRejection {
  ok: false
  reason: string
}

export interface Leaderboard {
  range: RangeKey
  rows: LeaderboardRow[]
  /** 请求者自己的名次；未上榜时 rank 为 0，避免「我在哪」无从得知 */
  self: LeaderboardRow | null
  updatedAt: number
}

/* ------------------------------------------------------------------ *
 * 日期推导：纯函数，边界最容易出错，单独测
 * ------------------------------------------------------------------ */

export function dayKey(at: number | Date): string {
  const d = at instanceof Date ? at : new Date(at)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 周一为一周之始 */
export function weekStart(at: number): Date {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function monthStart(at: number): Date {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d
}

/** 某维度覆盖的起止日期键；day 是 YYYY-MM-DD，字符串比较等价于日期比较 */
export function rangeBounds(range: RangeKey, at: number): { from: string; to: string } {
  const to = dayKey(at)
  if (range === 'today') return { from: to, to }
  return { from: dayKey(range === 'week' ? weekStart(at) : monthStart(at)), to }
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return dayKey(date)
}

/**
 * 存下来的连续天数只在「最后一次专注是今天或昨天」时仍然有效。
 * 停了两天以上就算断了，但断掉的记录留在库里不动，重新开始时自然被覆盖。
 */
export function effectiveStreak(streakDays: number, lastFocusDay: string, today: string): number {
  if (!lastFocusDay) return 0
  if (lastFocusDay === today || lastFocusDay === previousDay(today)) return streakDays
  return 0
}

export interface StatsOptions {
  /** 传 ':memory:' 可用于测试 */
  filePath: string
  now?: () => number
}

/** 查询中间形态：比对外的 LeaderboardRow 多一个用于判断连续是否中断的字段 */
interface RankedRow extends Omit<LeaderboardRow, 'streakDays' | 'totalDays'> {
  streakDays: number
  totalDays: number
  lastFocusDay: string
}

export class FocusStats {
  private readonly db: Database.Database
  private readonly now: () => number

  constructor(options: StatsOptions) {
    this.now = options.now ?? Date.now
    if (options.filePath !== ':memory:') mkdirSync(dirname(options.filePath), { recursive: true })
    this.db = new Database(options.filePath)
    // WAL 让读写不互相阻塞，进程被杀也不会留下半截事务
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        device_id TEXT PRIMARY KEY,
        nickname  TEXT NOT NULL,
        cat_id    TEXT NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS focus_daily (
        device_id TEXT NOT NULL,
        day       TEXT NOT NULL,
        seconds   INTEGER NOT NULL,
        PRIMARY KEY (device_id, day)
      );
      CREATE INDEX IF NOT EXISTS idx_focus_day ON focus_daily(day);

      -- 房间与成员关系是持久的：成员加入后一直是成员，下线不等于退出
      CREATE TABLE IF NOT EXISTS rooms (
        id             TEXT PRIMARY KEY,
        code           TEXT NOT NULL UNIQUE,
        name           TEXT NOT NULL,
        intro          TEXT NOT NULL DEFAULT '',
        owner_device   TEXT NOT NULL,
        goal_minutes   INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_members (
        room_id   TEXT NOT NULL,
        device_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (room_id, device_id)
      );
      CREATE INDEX IF NOT EXISTS idx_member_device ON room_members(device_id);

      -- 作息打卡：一天一行，起床与睡觉各记一次
      CREATE TABLE IF NOT EXISTS checkins (
        device_id TEXT NOT NULL,
        day       TEXT NOT NULL,
        wake_at   TEXT NOT NULL DEFAULT '',
        sleep_at  TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (device_id, day)
      );

      -- 许愿墙：本项目唯一的自由文本，发布前必须过清洗
      CREATE TABLE IF NOT EXISTS wishes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id    TEXT NOT NULL,
        device_id  TEXT NOT NULL,
        text       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        hidden     INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_wish_room ON wishes(room_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS wish_reports (
        wish_id    INTEGER NOT NULL,
        device_id  TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (wish_id, device_id)
      );
    `)
    this.migrate()
  }

  /**
   * 连续天数与累计天数增量维护在 profiles 上，而不是从 focus_daily 数出来——
   * 那张表只保留最近 45 天，直接数的话「连续 100 天」会被截成 45 天。
   */
  private migrate(): void {
    const columns = new Set(
      (this.db.pragma('table_info(profiles)') as Array<{ name: string }>).map((c) => c.name)
    )
    const additions: Array<[string, string]> = [
      ['streak_days', 'INTEGER NOT NULL DEFAULT 0'],
      ['best_streak', 'INTEGER NOT NULL DEFAULT 0'],
      ['total_days', 'INTEGER NOT NULL DEFAULT 0'],
      ['last_focus_day', "TEXT NOT NULL DEFAULT ''"],
      ['intro', "TEXT NOT NULL DEFAULT ''"]
    ]
    for (const [name, spec] of additions) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE profiles ADD COLUMN ${name} ${spec}`)
    }
  }

  /** 记录身份；昵称与猫咪走与房间同一套清洗 */
  touchProfile(deviceId: string, nickname: string, catId: string): void {
    if (!deviceId) return
    this.db
      .prepare(
        `INSERT INTO profiles (device_id, nickname, cat_id, last_seen) VALUES (?, ?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET
           nickname = excluded.nickname,
           cat_id = excluded.cat_id,
           last_seen = excluded.last_seen`
      )
      .run(deviceId, sanitizeNickname(nickname), sanitizeCatId(catId), this.now())
  }

  /** 累计专注秒数；调用方已按单步上限裁剪，这里再压一道单日上限 */
  addFocus(deviceId: string, seconds: number): void {
    const step = Math.floor(seconds)
    if (!deviceId || step <= 0) return
    const today = dayKey(this.now())

    this.db.transaction(() => {
      const firstToday = !this.db
        .prepare('SELECT 1 FROM focus_daily WHERE device_id = ? AND day = ?')
        .get(deviceId, today)

      this.db
        .prepare(
          `INSERT INTO focus_daily (device_id, day, seconds) VALUES (?, ?, ?)
           ON CONFLICT(device_id, day) DO UPDATE SET
             seconds = MIN(?, focus_daily.seconds + excluded.seconds)`
        )
        .run(deviceId, today, Math.min(DAILY_CAP_SECONDS, step), DAILY_CAP_SECONDS)

      if (firstToday) this.bumpStreak(deviceId, today)
    })()
  }

  /** 今天第一次产生专注时推进连续天数与累计天数 */
  private bumpStreak(deviceId: string, today: string): void {
    const row = this.db
      .prepare('SELECT streak_days AS s, best_streak AS b, last_focus_day AS d FROM profiles WHERE device_id = ?')
      .get(deviceId) as { s: number; b: number; d: string } | undefined

    const continued = row?.d === previousDay(today)
    const streak = continued ? (row?.s ?? 0) + 1 : 1
    const best = Math.max(row?.b ?? 0, streak)

    if (row) {
      this.db
        .prepare(
          `UPDATE profiles SET streak_days = ?, best_streak = ?, total_days = total_days + 1,
                               last_focus_day = ? WHERE device_id = ?`
        )
        .run(streak, best, today, deviceId)
      return
    }
    // 没走过 hello 就先产生了专注（理论上不会，但别把数据丢了）
    this.db
      .prepare(
        `INSERT INTO profiles (device_id, nickname, cat_id, last_seen, streak_days, best_streak, total_days, last_focus_day)
         VALUES (?, '', 'mikan', ?, ?, ?, 1, ?)`
      )
      .run(deviceId, this.now(), streak, best, today)
  }

  secondsIn(deviceId: string, range: RangeKey): number {
    const { from, to } = rangeBounds(range, this.now())
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(seconds), 0) AS s FROM focus_daily
         WHERE device_id = ? AND day BETWEEN ? AND ?`
      )
      .get(deviceId, from, to) as { s: number } | undefined
    return row?.s ?? 0
  }

  leaderboard(range: RangeKey, selfDeviceId = ''): Leaderboard {
    const { from, to } = rangeBounds(range, this.now())
    // 名次用 RANK()，并列同名次；榜单与「我的名次」共用同一套排序，不会自相矛盾
    const ranked = `
      SELECT f.device_id AS deviceId,
             COALESCE(p.nickname, '') AS nickname,
             COALESCE(p.cat_id, '') AS catId,
             SUM(f.seconds) AS seconds,
             RANK() OVER (ORDER BY SUM(f.seconds) DESC) AS rank,
             COALESCE(p.streak_days, 0) AS streakDays,
             COALESCE(p.total_days, 0) AS totalDays,
             COALESCE(p.last_focus_day, '') AS lastFocusDay
      FROM focus_daily f
      LEFT JOIN profiles p ON p.device_id = f.device_id
      WHERE f.day BETWEEN @from AND @to
      GROUP BY f.device_id
      HAVING seconds > 0
    `
    const rows = this.db
      .prepare(`${ranked} ORDER BY rank ASC, deviceId ASC LIMIT @limit`)
      .all({ from, to, limit: LEADERBOARD_SIZE }) as RankedRow[]

    let self: RankedRow | null = null
    if (selfDeviceId) {
      const hit = this.db
        .prepare(`SELECT * FROM (${ranked}) WHERE deviceId = @self`)
        .get({ from, to, self: selfDeviceId }) as RankedRow | undefined
      // 本维度没有成绩时也要返回一行，让用户看到自己的连续天数而不是一片空白
      self = hit ?? this.idleSelf(selfDeviceId)
    }

    const today = dayKey(this.now())
    return {
      range,
      rows: rows.map((r) => this.decorate(r, today)),
      self: self ? this.decorate(self, today) : null,
      updatedAt: this.now()
    }
  }

  private idleSelf(deviceId: string): RankedRow {
    const p = this.db
      .prepare(
        `SELECT nickname, cat_id AS catId, streak_days AS streakDays,
                total_days AS totalDays, last_focus_day AS lastFocusDay
         FROM profiles WHERE device_id = ?`
      )
      .get(deviceId) as Omit<RankedRow, 'deviceId' | 'seconds' | 'rank'> | undefined
    return {
      deviceId,
      nickname: p?.nickname ?? '',
      catId: p?.catId ?? '',
      seconds: 0,
      rank: 0,
      streakDays: p?.streakDays ?? 0,
      totalDays: p?.totalDays ?? 0,
      lastFocusDay: p?.lastFocusDay ?? ''
    }
  }

  /** 补兜底展示值，并把存下来的连续天数换算成「此刻是否还连着」 */
  private decorate(row: RankedRow, today: string): LeaderboardRow {
    return {
      deviceId: row.deviceId,
      nickname: row.nickname || '同学',
      catId: sanitizeCatId(row.catId),
      seconds: row.seconds,
      rank: row.rank,
      streakDays: effectiveStreak(row.streakDays, row.lastFocusDay, today),
      totalDays: row.totalDays
    }
  }

  /** 丢弃超出保留窗口的历史，并清掉再无数据的档案 */
  prune(): void {
    const cutoff = new Date(this.now())
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS)
    const cutoffKey = dayKey(cutoff)
    this.db.prepare('DELETE FROM focus_daily WHERE day < ?').run(cutoffKey)
    this.db
      .prepare(
        'DELETE FROM profiles WHERE device_id NOT IN (SELECT DISTINCT device_id FROM focus_daily)'
      )
      .run()
  }

  /* ---------------------------------------------------------------- *
   * 个人简介
   * ---------------------------------------------------------------- */

  /** 简介是自由文本，与昵称同等对待：先归一化再查广告特征 */
  setIntro(deviceId: string, raw: string): { ok: true; value: string } | TextRejection {
    const check = checkFreeText(raw, INTRO_MAX, '简介')
    if (!check.ok) return check
    this.db
      .prepare(
        `INSERT INTO profiles (device_id, nickname, cat_id, last_seen, intro) VALUES (?, '', 'mikan', ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET intro = excluded.intro`
      )
      .run(deviceId, this.now(), check.value)
    return { ok: true, value: check.value }
  }

  getIntro(deviceId: string): string {
    const row = this.db.prepare('SELECT intro FROM profiles WHERE device_id = ?').get(deviceId) as
      | { intro: string }
      | undefined
    return row?.intro ?? ''
  }

  /* ---------------------------------------------------------------- *
   * 房间与成员关系
   * ---------------------------------------------------------------- */

  createRoom(params: {
    id: string
    code: string
    ownerDevice: string
    name: string
    intro: string
    goalMinutes: number
  }): { ok: true; room: RoomRecord } | TextRejection {
    const nameCheck = validateRoomName(params.name)
    if (!nameCheck.ok) return { ok: false, reason: nameCheck.reason }
    const introCheck = params.intro
      ? checkFreeText(params.intro, ROOM_INTRO_MAX, '自习室简介')
      : ({ ok: true, value: '' } as const)
    if (!introCheck.ok) return introCheck

    if (this.joinedRoomCount(params.ownerDevice) >= JOINED_ROOM_LIMIT) {
      return { ok: false, reason: `最多同时加入 ${JOINED_ROOM_LIMIT} 个自习室` }
    }

    const at = this.now()
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO rooms (id, code, name, intro, owner_device, goal_minutes, created_at, last_active_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          params.id,
          params.code,
          sanitizeRoomName(nameCheck.value),
          introCheck.value,
          params.ownerDevice,
          Math.max(0, Math.min(24 * 60, Math.floor(params.goalMinutes) || 0)),
          at,
          at
        )
      this.db
        .prepare('INSERT INTO room_members (room_id, device_id, joined_at) VALUES (?, ?, ?)')
        .run(params.id, params.ownerDevice, at)
    })()

    return { ok: true, room: this.getRoom(params.id)! }
  }

  getRoom(roomId: string): RoomRecord | null {
    const row = this.db
      .prepare(
        `SELECT r.id, r.code, r.name, r.intro, r.owner_device AS ownerDevice,
                r.goal_minutes AS goalMinutes, r.created_at AS createdAt,
                r.last_active_at AS lastActiveAt,
                (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS memberCount
         FROM rooms r WHERE r.id = ?`
      )
      .get(roomId) as RoomRecord | undefined
    return row ?? null
  }

  getRoomByCode(code: string): RoomRecord | null {
    const row = this.db.prepare('SELECT id FROM rooms WHERE code = ?').get(code.toUpperCase()) as
      | { id: string }
      | undefined
    return row ? this.getRoom(row.id) : null
  }

  joinedRoomCount(deviceId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM room_members WHERE device_id = ?')
      .get(deviceId) as { c: number }
    return row.c
  }

  isMember(roomId: string, deviceId: string): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM room_members WHERE room_id = ? AND device_id = ?')
      .get(roomId, deviceId)
  }

  joinRoom(roomId: string, deviceId: string): { ok: true } | TextRejection {
    const room = this.getRoom(roomId)
    if (!room) return { ok: false, reason: '这个自习室不存在或已解散' }
    if (this.isMember(roomId, deviceId)) return { ok: true }
    if (room.memberCount >= ROOM_MEMBER_LIMIT) return { ok: false, reason: '自习室人数已满' }
    if (this.joinedRoomCount(deviceId) >= JOINED_ROOM_LIMIT) {
      return { ok: false, reason: `最多同时加入 ${JOINED_ROOM_LIMIT} 个自习室` }
    }
    this.db
      .prepare('INSERT INTO room_members (room_id, device_id, joined_at) VALUES (?, ?, ?)')
      .run(roomId, deviceId, this.now())
    return { ok: true }
  }

  /**
   * 退出是显式动作，下线不算。房主退出时把房间交给最早加入的剩余成员，
   * 最后一人退出才解散——否则房间会变成没人能管的僵尸。
   */
  leaveRoom(roomId: string, deviceId: string): { dissolved: boolean; newOwner: string } {
    const room = this.getRoom(roomId)
    if (!room) return { dissolved: false, newOwner: '' }

    let dissolved = false
    let newOwner = ''
    this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM room_members WHERE room_id = ? AND device_id = ?')
        .run(roomId, deviceId)
      const rest = this.db
        .prepare('SELECT device_id AS d FROM room_members WHERE room_id = ? ORDER BY joined_at ASC LIMIT 1')
        .get(roomId) as { d: string } | undefined

      if (!rest) {
        this.db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
        this.db.prepare('DELETE FROM wishes WHERE room_id = ?').run(roomId)
        dissolved = true
        return
      }
      if (room.ownerDevice === deviceId) {
        newOwner = rest.d
        this.db.prepare('UPDATE rooms SET owner_device = ? WHERE id = ?').run(newOwner, roomId)
      }
    })()
    return { dissolved, newOwner }
  }

  /**
   * 主人解散自习室：成员关系、愿望一并清掉。
   * 这是不可逆动作，调用方必须先让用户确认。
   */
  dissolveRoom(roomId: string, deviceId: string): { ok: true } | TextRejection {
    const room = this.getRoom(roomId)
    if (!room) return { ok: false, reason: '这个自习室不存在' }
    if (room.ownerDevice !== deviceId) return { ok: false, reason: '只有主人可以解散自习室' }
    this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM wish_reports WHERE wish_id IN (SELECT id FROM wishes WHERE room_id = ?)')
        .run(roomId)
      this.db.prepare('DELETE FROM wishes WHERE room_id = ?').run(roomId)
      this.db.prepare('DELETE FROM room_members WHERE room_id = ?').run(roomId)
      this.db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
    })()
    return { ok: true }
  }

  /** 我加入的房间列表 */
  myRooms(deviceId: string): RoomRecord[] {
    const ids = this.db
      .prepare('SELECT room_id AS id FROM room_members WHERE device_id = ? ORDER BY joined_at ASC')
      .all(deviceId) as Array<{ id: string }>
    return ids.map((r) => this.getRoom(r.id)).filter((r): r is RoomRecord => r !== null)
  }

  touchRoom(roomId: string): void {
    this.db.prepare('UPDATE rooms SET last_active_at = ? WHERE id = ?').run(this.now(), roomId)
  }

  setRoomMeta(
    roomId: string,
    deviceId: string,
    patch: { name?: string; intro?: string; goalMinutes?: number }
  ): { ok: true } | TextRejection {
    const room = this.getRoom(roomId)
    if (!room) return { ok: false, reason: '这个自习室不存在' }
    if (room.ownerDevice !== deviceId) return { ok: false, reason: '只有房主可以修改' }

    if (patch.name !== undefined) {
      const check = validateRoomName(patch.name)
      if (!check.ok) return { ok: false, reason: check.reason }
      this.db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(check.value, roomId)
    }
    if (patch.intro !== undefined) {
      const check = patch.intro
        ? checkFreeText(patch.intro, ROOM_INTRO_MAX, '自习室简介')
        : ({ ok: true, value: '' } as const)
      if (!check.ok) return check
      this.db.prepare('UPDATE rooms SET intro = ? WHERE id = ?').run(check.value, roomId)
    }
    if (patch.goalMinutes !== undefined) {
      const value = Math.max(0, Math.min(24 * 60, Math.floor(patch.goalMinutes) || 0))
      this.db.prepare('UPDATE rooms SET goal_minutes = ? WHERE id = ?').run(value, roomId)
    }
    return { ok: true }
  }

  /**
   * 房内榜。999 人房间不可能整份推给所有人，所以这里只出带名次的一页，
   * 完整名册由调用方分页取。
   */
  roomMembers(roomId: string, range: RangeKey, limit = 50, offset = 0): RoomMemberRow[] {
    const { from, to } = rangeBounds(range, this.now())
    const today = dayKey(this.now())
    const rows = this.db
      .prepare(
        `SELECT m.device_id AS deviceId,
                COALESCE(p.nickname, '') AS nickname,
                COALESCE(p.cat_id, '') AS catId,
                COALESCE(p.intro, '') AS intro,
                m.joined_at AS joinedAt,
                COALESCE(p.streak_days, 0) AS streakDays,
                COALESCE(p.total_days, 0) AS totalDays,
                COALESCE(p.last_focus_day, '') AS lastFocusDay,
                COALESCE(c.wake_at, '') AS wakeAt,
                COALESCE(c.sleep_at, '') AS sleepAt,
                COALESCE((SELECT SUM(f.seconds) FROM focus_daily f
                          WHERE f.device_id = m.device_id AND f.day BETWEEN @from AND @to), 0) AS seconds
         FROM room_members m
         LEFT JOIN profiles p ON p.device_id = m.device_id
         LEFT JOIN checkins c ON c.device_id = m.device_id AND c.day = @today
         WHERE m.room_id = @roomId
         ORDER BY seconds DESC, m.joined_at ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ roomId, from, to, today, limit, offset }) as Array<
      RoomMemberRow & { lastFocusDay: string }
    >

    return rows.map((row, index) => ({
      deviceId: row.deviceId,
      nickname: row.nickname || '同学',
      catId: sanitizeCatId(row.catId),
      intro: row.intro,
      joinedAt: row.joinedAt,
      seconds: row.seconds,
      streakDays: effectiveStreak(row.streakDays, row.lastFocusDay, today),
      totalDays: row.totalDays,
      wakeAt: row.wakeAt,
      sleepAt: row.sleepAt,
      rank: offset + index + 1
    }))
  }

  /* ---------------------------------------------------------------- *
   * 作息打卡
   * ---------------------------------------------------------------- */

  /** 打卡记本地时间的 HH:mm；同一天重复打卡以第一次为准，避免刷时间 */
  checkIn(deviceId: string, kind: 'wake' | 'sleep', hhmm: string): { ok: true; value: string } | TextRejection {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return { ok: false, reason: '时间格式不对' }
    const day = dayKey(this.now())
    const column = kind === 'wake' ? 'wake_at' : 'sleep_at'
    this.db
      .prepare(
        `INSERT INTO checkins (device_id, day, ${column}) VALUES (?, ?, ?)
         ON CONFLICT(device_id, day) DO UPDATE SET
           ${column} = CASE WHEN checkins.${column} = '' THEN excluded.${column} ELSE checkins.${column} END`
      )
      .run(deviceId, day, hhmm)
    const row = this.db
      .prepare(`SELECT ${column} AS v FROM checkins WHERE device_id = ? AND day = ?`)
      .get(deviceId, day) as { v: string }
    return { ok: true, value: row.v }
  }

  todayCheckin(deviceId: string): { wakeAt: string; sleepAt: string } {
    const row = this.db
      .prepare('SELECT wake_at AS wakeAt, sleep_at AS sleepAt FROM checkins WHERE device_id = ? AND day = ?')
      .get(deviceId, dayKey(this.now())) as { wakeAt: string; sleepAt: string } | undefined
    return row ?? { wakeAt: '', sleepAt: '' }
  }

  /* ---------------------------------------------------------------- *
   * 许愿墙
   * ---------------------------------------------------------------- */

  addWish(roomId: string, deviceId: string, raw: string): { ok: true; id: number } | TextRejection {
    if (!this.isMember(roomId, deviceId)) return { ok: false, reason: '先加入这个自习室' }
    const check = checkFreeText(raw, WISH_MAX, '愿望')
    if (!check.ok) return check

    const last = this.db
      .prepare('SELECT created_at AS at FROM wishes WHERE device_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(deviceId) as { at: number } | undefined
    const now = this.now()
    if (last && now - last.at < WISH_COOLDOWN_MS) {
      return { ok: false, reason: '刚许过愿，歇一会儿再来' }
    }

    const info = this.db
      .prepare('INSERT INTO wishes (room_id, device_id, text, created_at) VALUES (?, ?, ?, ?)')
      .run(roomId, deviceId, check.value, now)
    return { ok: true, id: Number(info.lastInsertRowid) }
  }

  wishes(roomId: string, selfDeviceId: string, limit = WISH_PAGE_SIZE, before = 0): WishRow[] {
    const rows = this.db
      .prepare(
        `SELECT w.id, w.device_id AS deviceId, w.text, w.created_at AS createdAt,
                COALESCE(p.nickname, '') AS nickname,
                COALESCE(p.cat_id, '') AS catId,
                (SELECT COUNT(*) FROM wish_reports r WHERE r.wish_id = w.id) AS reports
         FROM wishes w
         LEFT JOIN profiles p ON p.device_id = w.device_id
         WHERE w.room_id = @roomId AND w.hidden = 0
           AND (@before = 0 OR w.created_at < @before)
         ORDER BY w.created_at DESC
         LIMIT @limit`
      )
      .all({ roomId, limit, before }) as Array<Omit<WishRow, 'mine'>>
    return rows.map((r) => ({
      ...r,
      nickname: r.nickname || '同学',
      catId: sanitizeCatId(r.catId),
      mine: r.deviceId === selfDeviceId
    }))
  }

  /** 举报到阈值自动隐藏；作者与房主可直接删 */
  reportWish(wishId: number, deviceId: string): { hidden: boolean } {
    this.db
      .prepare('INSERT OR IGNORE INTO wish_reports (wish_id, device_id, created_at) VALUES (?, ?, ?)')
      .run(wishId, deviceId, this.now())
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM wish_reports WHERE wish_id = ?')
      .get(wishId) as { c: number }
    if (row.c >= WISH_AUTO_HIDE_REPORTS) {
      this.db.prepare('UPDATE wishes SET hidden = 1 WHERE id = ?').run(wishId)
      return { hidden: true }
    }
    return { hidden: false }
  }

  deleteWish(wishId: number, deviceId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT w.device_id AS author, r.owner_device AS owner
         FROM wishes w JOIN rooms r ON r.id = w.room_id WHERE w.id = ?`
      )
      .get(wishId) as { author: string; owner: string } | undefined
    if (!row) return false
    if (row.author !== deviceId && row.owner !== deviceId) return false
    this.db.prepare('DELETE FROM wishes WHERE id = ?').run(wishId)
    this.db.prepare('DELETE FROM wish_reports WHERE wish_id = ?').run(wishId)
    return true
  }

  close(): void {
    this.db.close()
  }
}

/**
 * 自由文本统一入口：简介、许愿都走这里。
 *
 * 屏蔽词只能挡住链接、联系方式这类推广，挡不住政治、色情、辱骂——
 * 那需要持续维护的词库和人工复核，所以举报与删除是必须配套的。
 */
export function checkFreeText(
  raw: unknown,
  maxLength: number,
  what: string
): { ok: true; value: string } | TextRejection {
  const value = normalizeDisplayText(raw, maxLength)
  if (!value) return { ok: false, reason: `请先写点${what}内容` }
  if (looksLikePromotion(value)) {
    return { ok: false, reason: `${what}里不能有链接、联系方式或推广内容` }
  }
  // 连续数字在自由文本里没有正当用途，却是绕过关键词最常见的手法
  if (/\d{6,}/.test(value.replace(/\s/g, ''))) {
    return { ok: false, reason: `${what}里不能出现长串数字` }
  }
  return { ok: true, value }
}
