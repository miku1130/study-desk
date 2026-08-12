/**
 * 局域网自习室通信协议：消息定义、NDJSON 编解码、反广告文本清洗、房间码。
 * 全部为纯函数，不依赖 electron 与 socket，便于单元测试。
 */

export const STUDY_ROOM_PROTOCOL_VERSION = 1
/** 房主 TCP 监听起始端口，被占用时依次 +1 */
export const STUDY_ROOM_TCP_PORT = 45871
export const STUDY_ROOM_TCP_PORT_TRIES = 8
/** UDP 发现端口：房主监听，访客用临时端口发探测包 */
export const STUDY_ROOM_UDP_PORT = 45870
export const STUDY_ROOM_MAX_MEMBERS = 24
export const STUDY_ROOM_NICKNAME_MAX = 12
export const STUDY_ROOM_NAME_MAX = 16
/** 单条消息上限，超出即判定为异常流并丢弃 */
export const STUDY_ROOM_MAX_FRAME_BYTES = 16 * 1024
/** 同一成员两次加油的最小间隔 */
export const STUDY_ROOM_CHEER_COOLDOWN_MS = 3000
/** 单次状态上报最多计入的专注秒数，防止客户端伪造大额时长 */
export const STUDY_ROOM_MAX_FOCUS_STEP_SEC = 15
export const STUDY_ROOM_DEFAULT_GOAL_MINUTES = 120

export type StudyRoomPhase = 'idle' | 'work' | 'short' | 'long'

/* ------------------------------------------------------------------ *
 * 预设加油动作：成员之间唯一允许的互动负载。
 * 只有白名单内的 id 会被房主接受与转发，因此不存在自由文本广告面。
 * ------------------------------------------------------------------ */

export interface StudyRoomCheerSpec {
  id: string
  emoji: string
  label: string
}

export const STUDY_ROOM_CHEERS: StudyRoomCheerSpec[] = [
  { id: 'fighting', emoji: '💪', label: '加油' },
  { id: 'clap', emoji: '👏', label: '鼓掌' },
  { id: 'star', emoji: '⭐', label: '点赞' },
  { id: 'flower', emoji: '🌸', label: '送花' },
  { id: 'tea', emoji: '🍵', label: '递杯茶' },
  { id: 'heart', emoji: '💗', label: '打气' },
  { id: 'sparkle', emoji: '✨', label: '厉害' },
  { id: 'rocket', emoji: '🚀', label: '冲刺' }
]

const CHEER_IDS = new Set(STUDY_ROOM_CHEERS.map((c) => c.id))

export function isCheerId(value: unknown): value is string {
  return typeof value === 'string' && CHEER_IDS.has(value)
}

/**
 * 可用的猫咪形象。catId 会被服务端下发给房内其他成员并用于查找图片资源，
 * 属于跨用户传播的字段，必须白名单化而不是只限长度。
 */
export const STUDY_ROOM_CAT_IDS = ['mikan', 'cloud', 'sesame'] as const
export const STUDY_ROOM_DEFAULT_CAT_ID = 'mikan'

const CAT_ID_SET = new Set<string>(STUDY_ROOM_CAT_IDS)

export function sanitizeCatId(value: unknown): string {
  return typeof value === 'string' && CAT_ID_SET.has(value)
    ? value
    : STUDY_ROOM_DEFAULT_CAT_ID
}

export function cheerSpec(id: string): StudyRoomCheerSpec | undefined {
  return STUDY_ROOM_CHEERS.find((c) => c.id === id)
}

/* ------------------------------------------------------------------ *
 * 文本清洗：昵称与房间名是仅有的两处自由文本，必须挡住广告
 * ------------------------------------------------------------------ */

const ZERO_WIDTH = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** 全角字母数字标点转半角，避免用 ｑｑ / ＷＸ 绕过关键词 */
function toHalfWidth(input: string): string {
  return input
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
}

/** 归一化展示文本：去零宽 / 控制字符、全角转半角、折叠空白、按长度截断 */
export function normalizeDisplayText(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return ''
  const cleaned = toHalfWidth(raw.replace(ZERO_WIDTH, '').replace(CONTROL_CHARS, ''))
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, maxLength).join('')
}

/** 压紧形式：只保留字母数字与中日韩字符，用于关键词比对，防止插空格 / 符号绕过 */
function compactForMatch(input: string): string {
  return toHalfWidth(input.replace(ZERO_WIDTH, ''))
    .toLowerCase()
    .replace(/[^0-9a-z\u3040-\u30ff\u4e00-\u9fff]/g, '')
}

/** 保留标点的归一化形式：域名后缀只能连着点号一起判定，压紧后会退化成字母串 */
function normalizeForLinkMatch(input: string): string {
  return toHalfWidth(input.replace(ZERO_WIDTH, '')).toLowerCase()
}

/**
 * 域名后缀必须带点号，后面也不能再接字母。
 * 否则 top / net / com 会命中 laptop、planet、Malcom 这类完全正常的昵称。
 */
const DOMAIN_SUFFIX = /\.\s*(com|cn|net|org|top|xyz|shop|vip|io|cc|me|site|fun|link)(?![a-z])/

/** 考研年、入学年、出生年在自习场景里极常见，不参与数字占比统计 */
const YEAR_LIKE = /(?:19|20)\d{2}/g

const PROMOTION_KEYWORDS = [
  // 链接与站点（域名后缀交给 DOMAIN_SUFFIX，不能进压紧词表）
  'http', 'https', 'www',
  // 联系方式
  'qq', '扣扣', '企鹅号', '微信', 'weixin', 'wechat', 'vx', '威信', '徽信', 'telegram', '电报',
  'whatsapp', '加v', '私聊', '私信', '联系我', '咨询我', '滴滴我', '手机号', '电话号',
  // 推广与灰产
  '代写', '代做', '代练', '代考', '包过', '刷单', '兼职', '招聘', '日结', '返利', '优惠券',
  '免费领', '限时抢', '点击进', '扫码', '广告', '推广', '引流', '办证', '贷款', '博彩', '彩票',
  '开票', '发票'
]

// 关键词以压紧形式比对，所以这里也要用压紧形式
const COMPACT_KEYWORDS = PROMOTION_KEYWORDS.map(compactForMatch).filter(Boolean)

/** 判定是否疑似广告 / 引流文本 */
export function looksLikePromotion(raw: string): boolean {
  if (DOMAIN_SUFFIX.test(normalizeForLinkMatch(raw))) return true
  const compact = compactForMatch(raw)
  if (!compact) return false
  if (COMPACT_KEYWORDS.some((kw) => compact.includes(kw))) return true
  // 连续 5 位以上数字：电话号 / QQ 号 / 微信号。在剔年份之前判断，否则可用年份切割长号码绕过
  if (/\d{5,}/.test(compact)) return true
  // 数字占比过半的中长串，多为变体联系方式；先剔年份，否则「2026考研」会被误伤
  const withoutYear = compact.replace(YEAR_LIKE, '')
  const digits = (withoutYear.match(/\d/g) ?? []).length
  if (withoutYear.length >= 6 && digits * 2 > withoutYear.length) return true
  return false
}

export interface TextCheckResult {
  ok: boolean
  value: string
  reason: string
}

function checkText(raw: unknown, maxLength: number, what: string): TextCheckResult {
  const value = normalizeDisplayText(raw, maxLength)
  if (!value) return { ok: false, value: '', reason: `请填写${what}` }
  if (looksLikePromotion(value)) {
    return { ok: false, value: '', reason: `${what}不能包含链接、联系方式或推广内容` }
  }
  return { ok: true, value, reason: '' }
}

/** UI 侧校验昵称，给出可展示的拒绝理由 */
export function validateNickname(raw: unknown): TextCheckResult {
  return checkText(raw, STUDY_ROOM_NICKNAME_MAX, '昵称')
}

/** UI 侧校验房间名 */
export function validateRoomName(raw: unknown): TextCheckResult {
  return checkText(raw, STUDY_ROOM_NAME_MAX, '自习室名称')
}

/** 房主侧防御性清洗：任何来自网络的昵称都必须经过这里，永远返回可安全展示的字符串 */
export function sanitizeNickname(raw: unknown, fallback = '同学'): string {
  const result = validateNickname(raw)
  return result.ok ? result.value : fallback
}

/** 房主侧防御性清洗：房间名 */
export function sanitizeRoomName(raw: unknown, fallback = '自习室'): string {
  const result = validateRoomName(raw)
  return result.ok ? result.value : fallback
}

/* ------------------------------------------------------------------ *
 * 房间码：把房主 IPv4 + 端口编成 10 位 Base32，便于广播被隔离时手动加入
 * ------------------------------------------------------------------ */

// Crockford 风格字母表，去掉了容易混淆的 I / L / O / U
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeChunk(value: number): string {
  let out = ''
  for (let i = 4; i >= 0; i--) {
    out += CODE_ALPHABET[(value >>> (i * 5)) & 31]
  }
  return out
}

function decodeChunk(chunk: string): number | null {
  let value = 0
  for (const ch of chunk) {
    const index = CODE_ALPHABET.indexOf(ch)
    if (index < 0) return null
    value = value * 32 + index
  }
  return value
}

/** 把 `192.168.1.7:45871` 编成 `XXXXX-XXXXX` 形式的房间码 */
export function encodeRoomCode(address: string, port: number): string {
  const parts = String(address ?? '').split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return ''
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return ''
  const high = (parts[0] << 16) | (parts[1] << 8) | parts[2]
  const low = (parts[3] << 16) | port
  return `${encodeChunk(high)}-${encodeChunk(low)}`
}

/** 解析房间码，容忍小写、缺省连字符与 I/L/O/U 误输入 */
export function decodeRoomCode(code: unknown): { address: string; port: number } | null {
  if (typeof code !== 'string') return null
  const normalized = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')
  if (normalized.length !== 10) return null
  const high = decodeChunk(normalized.slice(0, 5))
  const low = decodeChunk(normalized.slice(5))
  if (high === null || low === null) return null
  const port = low & 0xffff
  const address = [(high >> 16) & 255, (high >> 8) & 255, high & 255, (low >> 16) & 255].join('.')
  if (port <= 0) return null
  return { address, port }
}

/* ------------------------------------------------------------------ *
 * 广播地址推导
 * ------------------------------------------------------------------ */

export interface NetworkInterfaceLike {
  family?: string | number
  internal?: boolean
  address?: string
  netmask?: string
}

/**
 * 由网卡列表推导定向广播地址（ip | ~mask）。
 * 定向广播比 255.255.255.255 更容易穿过多网卡 / 虚拟网卡环境。
 */
export function broadcastAddressesFrom(
  interfaces: Record<string, NetworkInterfaceLike[] | undefined>
): string[] {
  const found = new Set<string>()
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      const isIpv4 = info.family === 'IPv4' || info.family === 4
      if (!isIpv4 || info.internal) continue
      const ip = (info.address ?? '').split('.').map(Number)
      const mask = (info.netmask ?? '').split('.').map(Number)
      if (ip.length !== 4 || mask.length !== 4) continue
      if ([...ip, ...mask].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) continue
      found.add(ip.map((part, i) => (part | (~mask[i] & 255)) & 255).join('.'))
    }
  }
  found.add('255.255.255.255')
  return [...found]
}

/** 取本机首个可用的局域网 IPv4，用于生成房间码 */
export function primaryLanAddress(
  interfaces: Record<string, NetworkInterfaceLike[] | undefined>
): string {
  const candidates: string[] = []
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      const isIpv4 = info.family === 'IPv4' || info.family === 4
      if (!isIpv4 || info.internal || !info.address) continue
      candidates.push(info.address)
    }
  }
  // 常见家用 / 校园网段优先，避免选到虚拟机网卡
  const preferred = candidates.find((ip) => /^192\.168\./.test(ip) || /^10\./.test(ip))
  return preferred ?? candidates[0] ?? '127.0.0.1'
}

/* ------------------------------------------------------------------ *
 * 消息定义
 * ------------------------------------------------------------------ */

export interface StudyRoomFocusReport {
  phase: StudyRoomPhase
  running: boolean
  remaining: number
  todayFocusMinutes: number
  todayPomodoros: number
  /**
   * 今天在自习室里累计的专注秒数（跨房间、跨重连）。
   * 由每位成员自己在本地按日累计后上报，房主只做展示转发；
   * 集体目标与排行仍以房主自己计时的 roomFocusSeconds 为准，避免被伪造。
   */
  todayRoomFocusSeconds: number
}

export interface StudyRoomMemberSnapshot extends StudyRoomFocusReport {
  id: string
  nickname: string
  catId: string
  host: boolean
  /** 本次在自习室内累计的专注秒数 */
  roomFocusSeconds: number
  /** 本次在自习室内完成的番茄数 */
  roomPomodoros: number
  /** 收到的加油次数 */
  cheers: number
  joinedAt: number
  online: boolean
}

export interface StudyRoomSummary {
  roomId: string
  name: string
  code: string
  hostNickname: string
  memberCount: number
  maxMembers: number
  goalMinutes: number
  /** 房间累计专注分钟数 */
  focusMinutes: number
  createdAt: number
}

export type StudyRoomMessage =
  | { t: 'hello'; v: number; nickname: string; catId: string; focus: StudyRoomFocusReport }
  | { t: 'welcome'; v: number; selfId: string; room: StudyRoomSummary; members: StudyRoomMemberSnapshot[] }
  | { t: 'reject'; reason: string }
  | { t: 'roster'; room: StudyRoomSummary; members: StudyRoomMemberSnapshot[] }
  | { t: 'focus'; focus: StudyRoomFocusReport }
  | { t: 'cheer'; cheerId: string; toId: string }
  | { t: 'cheered'; cheerId: string; fromId: string; fromNickname: string; toId: string; at: number }
  | { t: 'goal'; goalMinutes: number; at: number }
  | { t: 'ping' }
  | { t: 'pong' }
  | { t: 'bye' }

const PHASES: StudyRoomPhase[] = ['idle', 'work', 'short', 'long']

function num(value: unknown, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function str(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function parseFocus(value: unknown): StudyRoomFocusReport {
  const raw = (value ?? {}) as Record<string, unknown>
  const phase = PHASES.includes(raw.phase as StudyRoomPhase) ? (raw.phase as StudyRoomPhase) : 'idle'
  return {
    phase,
    running: Boolean(raw.running),
    remaining: num(raw.remaining, 0, 24 * 3600),
    todayFocusMinutes: num(raw.todayFocusMinutes, 0, 24 * 60),
    todayPomodoros: num(raw.todayPomodoros, 0, 999),
    todayRoomFocusSeconds: num(raw.todayRoomFocusSeconds, 0, 24 * 3600)
  }
}

function parseMember(value: unknown): StudyRoomMemberSnapshot {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    ...parseFocus(raw),
    id: str(raw.id, 40),
    nickname: sanitizeNickname(raw.nickname),
    catId: sanitizeCatId(raw.catId),
    host: Boolean(raw.host),
    roomFocusSeconds: num(raw.roomFocusSeconds, 0, 24 * 3600),
    roomPomodoros: num(raw.roomPomodoros, 0, 999),
    cheers: num(raw.cheers, 0, 99999),
    joinedAt: num(raw.joinedAt, 0, Number.MAX_SAFE_INTEGER),
    online: raw.online !== false
  }
}

function parseSummary(value: unknown): StudyRoomSummary {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    roomId: str(raw.roomId, 40),
    name: sanitizeRoomName(raw.name),
    code: str(raw.code, 16),
    hostNickname: sanitizeNickname(raw.hostNickname),
    memberCount: num(raw.memberCount, 0, STUDY_ROOM_MAX_MEMBERS),
    maxMembers: num(raw.maxMembers, 1, STUDY_ROOM_MAX_MEMBERS),
    goalMinutes: num(raw.goalMinutes, 0, 24 * 60),
    focusMinutes: num(raw.focusMinutes, 0, STUDY_ROOM_MAX_MEMBERS * 24 * 60),
    createdAt: num(raw.createdAt, 0, Number.MAX_SAFE_INTEGER)
  }
}

/** 把消息编成一行 NDJSON */
export function encodeMessage(message: StudyRoomMessage): string {
  return `${JSON.stringify(message)}\n`
}

/**
 * 解析并**净化**一条消息。返回 null 表示该帧无效，调用方应直接丢弃。
 * 所有字符串字段在这里就完成清洗，保证上层拿到的内容一定可安全展示。
 */
export function parseMessage(line: string): StudyRoomMessage | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    raw = parsed as Record<string, unknown>
  } catch {
    return null
  }
  switch (raw.t) {
    case 'hello':
      return {
        t: 'hello',
        v: num(raw.v, 0, 999),
        nickname: sanitizeNickname(raw.nickname),
        catId: sanitizeCatId(raw.catId),
        focus: parseFocus(raw.focus)
      }
    case 'welcome':
      return {
        t: 'welcome',
        v: num(raw.v, 0, 999),
        selfId: str(raw.selfId, 40),
        room: parseSummary(raw.room),
        members: Array.isArray(raw.members)
          ? raw.members.slice(0, STUDY_ROOM_MAX_MEMBERS).map(parseMember)
          : []
      }
    case 'reject':
      return { t: 'reject', reason: normalizeDisplayText(raw.reason, 40) || '连接被拒绝' }
    case 'roster':
      return {
        t: 'roster',
        room: parseSummary(raw.room),
        members: Array.isArray(raw.members)
          ? raw.members.slice(0, STUDY_ROOM_MAX_MEMBERS).map(parseMember)
          : []
      }
    case 'focus':
      return { t: 'focus', focus: parseFocus(raw.focus) }
    case 'cheer':
      // 非白名单加油直接判定为无效帧，这是杜绝自定义内容的关键一环
      if (!isCheerId(raw.cheerId)) return null
      return { t: 'cheer', cheerId: raw.cheerId, toId: str(raw.toId, 40) }
    case 'cheered':
      if (!isCheerId(raw.cheerId)) return null
      return {
        t: 'cheered',
        cheerId: raw.cheerId,
        fromId: str(raw.fromId, 40),
        fromNickname: sanitizeNickname(raw.fromNickname),
        toId: str(raw.toId, 40),
        at: num(raw.at, 0, Number.MAX_SAFE_INTEGER)
      }
    case 'goal':
      return {
        t: 'goal',
        goalMinutes: num(raw.goalMinutes, 0, 24 * 60),
        at: num(raw.at, 0, Number.MAX_SAFE_INTEGER)
      }
    case 'ping':
      return { t: 'ping' }
    case 'pong':
      return { t: 'pong' }
    case 'bye':
      return { t: 'bye' }
    default:
      return null
  }
}

/**
 * NDJSON 流式解码器：TCP 分片到达时按行切分。
 * 超过单帧上限说明对端不是本协议（或恶意），直接丢弃缓冲区。
 */
export class MessageDecoder {
  private buffer = ''

  push(chunk: string | Uint8Array): StudyRoomMessage[] {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')
    this.buffer += text
    if (this.buffer.length > STUDY_ROOM_MAX_FRAME_BYTES && !this.buffer.includes('\n')) {
      this.buffer = ''
      return []
    }
    const parts = this.buffer.split('\n')
    this.buffer = parts.pop() ?? ''
    const messages: StudyRoomMessage[] = []
    for (const part of parts) {
      const message = parseMessage(part)
      if (message) messages.push(message)
    }
    return messages
  }

  reset(): void {
    this.buffer = ''
  }
}

/* ------------------------------------------------------------------ *
 * UDP 发现报文
 * ------------------------------------------------------------------ */

export const DISCOVERY_MAGIC = 'SDROOM1'

export type DiscoveryPacket =
  | { t: 'probe' }
  | { t: 'beacon'; port: number; room: StudyRoomSummary }

export function encodeDiscoveryPacket(packet: DiscoveryPacket): Buffer {
  return Buffer.from(`${DISCOVERY_MAGIC}${JSON.stringify(packet)}`, 'utf-8')
}

export function decodeDiscoveryPacket(data: Uint8Array | string): DiscoveryPacket | null {
  const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')
  if (!text.startsWith(DISCOVERY_MAGIC)) return null
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(text.slice(DISCOVERY_MAGIC.length)) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    raw = parsed as Record<string, unknown>
  } catch {
    return null
  }
  if (raw.t === 'probe') return { t: 'probe' }
  if (raw.t === 'beacon') {
    return { t: 'beacon', port: num(raw.port, 1, 65535), room: parseSummary(raw.room) }
  }
  return null
}

/** 生成短随机 id，主进程侧无法复用渲染层的 uid */
export function createId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
