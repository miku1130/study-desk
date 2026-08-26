export interface SchedulePdfItem {
  date: string
  start: string
  end: string
  title: string
  location: string
  note: string
  color: string
  allDay: boolean
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
}

export function getDaySchedules(items: unknown, date: string): SchedulePdfItem[] {
  if (!isValidDateKey(date) || !Array.isArray(items)) return []
  return items
    .filter((item): item is Partial<SchedulePdfItem> => Boolean(item) && typeof item === 'object')
    .filter((item) => item.date === date && typeof item.title === 'string' && item.title.trim())
    .map((item) => ({
      date,
      start: typeof item.start === 'string' ? item.start : '',
      end: typeof item.end === 'string' ? item.end : '',
      title: item.title!.trim(),
      location: typeof item.location === 'string' ? item.location.trim() : '',
      note: typeof item.note === 'string' ? item.note.trim() : '',
      color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#4f8fd8',
      allDay: Boolean(item.allDay)
    }))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title)
    })
}

export function scheduleDurationMinutes(item: Pick<SchedulePdfItem, 'start' | 'end' | 'allDay'>): number {
  if (item.allDay) return 0
  const start = parseTime(item.start)
  const end = parseTime(item.end)
  return start !== null && end !== null && end > start ? end - start : 0
}

export function totalScheduleDuration(items: SchedulePdfItem[]): number {
  return items.reduce((total, item) => total + scheduleDurationMinutes(item), 0)
}

export function buildSchedulePdfHtml(date: string, items: SchedulePdfItem[]): string {
  const dateLabel = formatDateLabel(date)
  const allDayItems = items.filter((item) => item.allDay)
  const timedItems = items.filter((item) => !item.allDay)
  const totalMinutes = totalScheduleDuration(items)
  const rows = timedItems.map(scheduleRow).join('')
  const allDayMarkup = allDayItems.length
    ? `<section class="section"><div class="section-title"><span class="section-dot all-day-dot"></span><h2>全天安排</h2><span class="section-count">${allDayItems.length} 项</span></div><div class="all-day-list">${allDayItems.map(allDayRow).join('')}</div></section>`
    : ''
  const timelineMarkup = timedItems.length
    ? `<section class="section"><div class="section-title"><span class="section-dot"></span><h2>时间安排</h2><span class="section-count">${timedItems.length} 项</span></div><table><thead><tr><th class="time-col">时间</th><th>计划事项</th><th class="place-col">地点</th><th class="duration-col">时长</th></tr></thead><tbody>${rows}</tbody></table></section>`
    : ''
  const emptyMarkup = !items.length
    ? '<div class="empty"><div class="empty-mark">—</div><h2>今天没有安排</h2><p>留出一点空白，也是一种计划。</p></div>'
    : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>StudyDesk - ${escapeHtml(dateLabel)} 计划表</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #243334; background: #ffffff; font-family: "Microsoft YaHei", "Noto Sans CJK SC", "PingFang SC", sans-serif; font-size: 11px; line-height: 1.55; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 17mm 15mm; position: relative; }
  .topline { display: flex; align-items: center; justify-content: space-between; color: #6b7c7d; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
  .brand { color: #2f8f7b; font-weight: 800; }
  .header { margin-top: 22mm; padding-bottom: 9mm; border-bottom: 2px solid #2f8f7b; }
  .eyebrow { margin: 0 0 7px; color: #2f8f7b; font-size: 10px; font-weight: 800; letter-spacing: .18em; }
  h1 { margin: 0; color: #1e3031; font-size: 27px; line-height: 1.15; font-weight: 800; }
  .date { margin-top: 8px; color: #6b7c7d; font-size: 12px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 9mm 0 10mm; }
  .summary-card { min-height: 55px; padding: 11px 13px; border: 1px solid #dce8e4; border-radius: 6px; background: #f5faf8; }
  .summary-label { color: #758584; font-size: 9px; }
  .summary-value { margin-top: 4px; color: #244a43; font-size: 18px; font-weight: 800; }
  .section { margin-top: 9mm; page-break-inside: avoid; }
  .section-title { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .section-title h2 { margin: 0; color: #2c4141; font-size: 13px; font-weight: 800; }
  .section-dot { width: 7px; height: 7px; border-radius: 50%; background: #2f8f7b; }
  .all-day-dot { background: #d58b48; }
  .section-count { margin-left: auto; color: #82918f; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { padding: 8px 9px; border-bottom: 1px solid #cbdad6; color: #72817f; font-size: 9px; font-weight: 700; text-align: left; }
  td { padding: 11px 9px; border-bottom: 1px solid #e7eeec; vertical-align: top; }
  tbody tr { page-break-inside: avoid; }
  .time-col { width: 24%; } .place-col { width: 24%; } .duration-col { width: 13%; text-align: right; }
  .time { color: #2f8f7b; font-size: 11px; font-weight: 800; white-space: nowrap; }
  .event { position: relative; padding-left: 12px; }
  .event:before { content: ""; position: absolute; top: 3px; bottom: 3px; left: 0; width: 3px; border-radius: 2px; background: var(--event-color); }
  .event-title { color: #263b3b; font-size: 11px; font-weight: 800; }
  .event-note { margin-top: 3px; color: #788887; font-size: 9px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .place, .duration { color: #6e7f7d; font-size: 10px; overflow-wrap: anywhere; }
  .duration { text-align: right; white-space: nowrap; }
  .all-day-list { display: grid; gap: 6px; }
  .all-day-item { display: flex; gap: 10px; padding: 10px 12px; border: 1px solid #f0dfca; border-radius: 5px; background: #fff9f2; page-break-inside: avoid; }
  .all-day-bar { width: 3px; flex: 0 0 3px; border-radius: 2px; background: var(--event-color); }
  .all-day-copy { min-width: 0; } .all-day-title { font-weight: 800; } .all-day-meta { margin-top: 2px; color: #8b7b6c; font-size: 9px; }
  .empty { margin-top: 20mm; padding: 24mm 0; border: 1px dashed #cbdad6; border-radius: 6px; color: #758584; text-align: center; }
  .empty-mark { color: #2f8f7b; font-size: 24px; font-weight: 300; } .empty h2 { margin: 7px 0 2px; color: #385050; font-size: 15px; } .empty p { margin: 0; font-size: 10px; }
  .footer { position: absolute; right: 17mm; bottom: 9mm; left: 17mm; display: flex; justify-content: space-between; padding-top: 5px; border-top: 1px solid #e2ebe8; color: #96a3a1; font-size: 8px; }
</style>
</head>
<body><main class="page">
  <div class="topline"><span class="brand">STUDYDESK</span><span>DAILY PLAN</span></div>
  <header class="header"><p class="eyebrow">DAILY SCHEDULE</p><h1>${escapeHtml(dateLabel)}</h1><p class="date">${escapeHtml(date)}</p></header>
  <section class="summary">
    <div class="summary-card"><div class="summary-label">今日计划</div><div class="summary-value">${items.length} 项</div></div>
    <div class="summary-card"><div class="summary-label">专注时段</div><div class="summary-value">${timedItems.length} 项</div></div>
    <div class="summary-card"><div class="summary-label">预计投入</div><div class="summary-value">${formatDuration(totalMinutes)}</div></div>
  </section>
  ${allDayMarkup}${timelineMarkup}${emptyMarkup}
  <footer class="footer"><span>由 StudyDesk 生成</span><span>${escapeHtml(date)}</span></footer>
</main></body></html>`
}

function parseTime(value: string): number | null {
  const match = TIME_PATTERN.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}小时${remainder ? ` ${remainder}分` : ''}` : `${remainder}分钟`
}

function formatDateLabel(date: string): string {
  const match = DATE_KEY_PATTERN.exec(date)
  if (!match) return date
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })
}

function scheduleRow(item: SchedulePdfItem): string {
  const duration = scheduleDurationMinutes(item)
  return `<tr><td class="time">${escapeHtml(item.start)} - ${escapeHtml(item.end)}</td><td><div class="event" style="--event-color:${item.color}"><div class="event-title">${escapeHtml(item.title)}</div>${item.note ? `<div class="event-note">${escapeHtml(item.note)}</div>` : ''}</div></td><td class="place">${escapeHtml(item.location || '未填写')}</td><td class="duration">${duration ? `${duration} 分钟` : '—'}</td></tr>`
}

function allDayRow(item: SchedulePdfItem): string {
  const meta = [item.location, item.note].filter(Boolean).map(escapeHtml).join(' · ')
  return `<div class="all-day-item" style="--event-color:${item.color}"><span class="all-day-bar"></span><div class="all-day-copy"><div class="all-day-title">${escapeHtml(item.title)}</div>${meta ? `<div class="all-day-meta">${meta}</div>` : ''}</div></div>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
