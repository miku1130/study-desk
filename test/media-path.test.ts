import { describe, it, expect } from 'vitest'
import { isServableMediaPath } from '../src/main/mediaPath'

const isWindows = process.platform === 'win32'
const abs = (p: string): string => (isWindows ? `C:\\${p.replace(/\//g, '\\')}` : `/${p}`)

describe('isServableMediaPath', () => {
  it.each(['photos/a.png', 'music/b.MP3', 'wall/c.jpeg', 'clip/d.webm', 'sound/e.flac'])(
    '放行媒体文件：%s',
    (p) => {
      expect(isServableMediaPath(abs(p))).toBe(true)
    }
  )

  it.each([
    'Users/me/.ssh/id_rsa',
    'Users/me/AppData/Roaming/app/config.json',
    'etc/passwd',
    'project/.env',
    'tmp/payload.exe',
    'notes/secret.txt'
  ])('拒绝非媒体文件：%s', (p) => {
    expect(isServableMediaPath(abs(p))).toBe(false)
  })

  it('拒绝靠目录名伪装扩展名的穿越路径', () => {
    expect(isServableMediaPath(abs('media/cover.png/../../.ssh/id_rsa'))).toBe(false)
    expect(isServableMediaPath(abs('media/a.png/../../secret'))).toBe(false)
  })

  it('穿越后仍落在媒体文件上时放行（扩展名才是判据）', () => {
    expect(isServableMediaPath(abs('media/sub/../cover.png'))).toBe(true)
  })

  it('拒绝相对路径', () => {
    expect(isServableMediaPath('media/cover.png')).toBe(false)
    expect(isServableMediaPath('../cover.png')).toBe(false)
  })

  it('拒绝空值与非字符串', () => {
    expect(isServableMediaPath('')).toBe(false)
    expect(isServableMediaPath(null)).toBe(false)
    expect(isServableMediaPath(123)).toBe(false)
    expect(isServableMediaPath(undefined)).toBe(false)
  })

  it('拒绝含空字节的路径', () => {
    expect(isServableMediaPath(abs('media/cover.png\0.txt'))).toBe(false)
  })

  it('扩展名大小写不敏感', () => {
    expect(isServableMediaPath(abs('media/COVER.PNG'))).toBe(true)
    expect(isServableMediaPath(abs('media/Song.Mp3'))).toBe(true)
  })
})
