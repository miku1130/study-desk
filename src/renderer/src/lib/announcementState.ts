import type { StartupAnnouncement } from '../types'

export const ANNOUNCEMENT_DISMISSED_KEY = 'studydesk.announcement.dismissed-id'

export interface AnnouncementStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 优先使用服务端公告 id；旧公告没有 id 时用发布日期和标题组成稳定标识。 */
export function announcementIdentity(announcement: StartupAnnouncement): string {
  return (
    announcement.id?.trim() ||
    `${announcement.publishedAt?.trim() ?? ''}:${announcement.title.trim()}`
  )
}

export function isAnnouncementDismissed(
  storage: AnnouncementStorage,
  announcement: StartupAnnouncement
): boolean {
  try {
    return storage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === announcementIdentity(announcement)
  } catch {
    return false
  }
}

export function dismissAnnouncement(
  storage: AnnouncementStorage,
  announcement: StartupAnnouncement
): void {
  try {
    storage.setItem(ANNOUNCEMENT_DISMISSED_KEY, announcementIdentity(announcement))
  } catch {
    // 存储不可用时仍关闭当前弹窗，不影响应用启动。
  }
}
