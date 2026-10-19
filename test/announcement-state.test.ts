import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_DISMISSED_KEY,
  announcementIdentity,
  dismissAnnouncement,
  isAnnouncementDismissed
} from '../src/renderer/src/lib/announcementState'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = { ...initial }
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value
    }
  }
}

describe('announcement read state', () => {
  it('remembers the dismissed announcement id', () => {
    const storage = memoryStorage()
    const announcement = {
      enabled: true,
      id: 'v0.8.12-announcement',
      title: '新版公告',
      content: '内容'
    }

    expect(isAnnouncementDismissed(storage, announcement)).toBe(false)
    dismissAnnouncement(storage, announcement)
    expect(storage.getItem(ANNOUNCEMENT_DISMISSED_KEY)).toBe('v0.8.12-announcement')
    expect(isAnnouncementDismissed(storage, announcement)).toBe(true)
  })

  it('shows a different announcement id again', () => {
    const storage = memoryStorage({ [ANNOUNCEMENT_DISMISSED_KEY]: 'old-announcement' })
    expect(
      isAnnouncementDismissed(storage, {
        enabled: true,
        id: 'new-announcement',
        title: '新公告',
        content: '内容'
      })
    ).toBe(false)
  })

  it('uses title and published date for old announcements without an id', () => {
    const storage = memoryStorage()
    const announcement = {
      enabled: true,
      title: '旧版公告',
      content: '内容',
      publishedAt: '2026-10-19'
    }
    expect(announcementIdentity(announcement)).toBe('2026-10-19:旧版公告')
    dismissAnnouncement(storage, announcement)
    expect(isAnnouncementDismissed(storage, announcement)).toBe(true)
  })
})
