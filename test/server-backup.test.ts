import { describe, expect, it } from 'vitest'
import { backupFileName, expiredBackups } from '../server/src/backup'

describe('备份文件名', () => {
  it('按时间排序即按时间先后，文件名里不能有冒号', () => {
    const early = backupFileName(new Date(2026, 0, 2, 3, 4, 5).getTime())
    const late = backupFileName(new Date(2026, 10, 20, 21, 22, 23).getTime())
    expect(early < late).toBe(true)
    expect(early).not.toContain(':')
    expect(early).toMatch(/^study-room-\d{8}-\d{6}\.db$/)
  })
})

describe('备份保留策略', () => {
  const files = [
    'study-room-20260810-030000.db',
    'study-room-20260811-030000.db',
    'study-room-20260812-030000.db',
    'study-room-20260813-030000.db'
  ]

  it('只留最近 N 份，多出来的从最旧开始删', () => {
    expect(expiredBackups(files, 2)).toEqual([
      'study-room-20260810-030000.db',
      'study-room-20260811-030000.db'
    ])
  })

  it('份数没超就一个都不删', () => {
    expect(expiredBackups(files, 4)).toEqual([])
    expect(expiredBackups(files, 10)).toEqual([])
  })

  it('无关文件不参与，更不会被删掉', () => {
    const mixed = [...files, 'readme.txt', 'study-room.db', 'study-room.db-wal']
    expect(expiredBackups(mixed, 1)).toEqual([
      'study-room-20260810-030000.db',
      'study-room-20260811-030000.db',
      'study-room-20260812-030000.db'
    ])
  })

  it('乱序传入也按时间判断，不依赖调用方先排好', () => {
    const shuffled = [files[2], files[0], files[3], files[1]]
    expect(expiredBackups(shuffled, 1)).toEqual([
      'study-room-20260810-030000.db',
      'study-room-20260811-030000.db',
      'study-room-20260812-030000.db'
    ])
  })

  it('keep 传 0 或负数时按至少保留 1 份处理，别把备份删空', () => {
    expect(expiredBackups(files, 0)).toEqual(files.slice(0, 3))
    expect(expiredBackups(files, -5)).toEqual(files.slice(0, 3))
  })
})
