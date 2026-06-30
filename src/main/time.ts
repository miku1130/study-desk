/** 本地日期键 YYYY-MM-DD（不依赖 electron，便于单元测试复用）。 */
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
