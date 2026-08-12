import { extname, isAbsolute, resolve } from 'path'

/**
 * studymedia 协议只服务媒体文件。渲染层拿到的是用户自己选过的音图路径，
 * 限定扩展名后，即便将来某处出现注入，也读不到密钥、配置或浏览器数据。
 */
export const SERVABLE_MEDIA_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'mp4',
  'webm'
])

/** 判断路径是否允许通过 studymedia 协议读取 */
export function isServableMediaPath(input: unknown): boolean {
  if (typeof input !== 'string' || !input) return false
  if (input.includes('\0')) return false
  if (!isAbsolute(input)) return false
  // 先规范化再取扩展名，避免 a.png/../../secret 这类路径靠前缀蒙混过关
  const ext = extname(resolve(input)).slice(1).toLowerCase()
  return SERVABLE_MEDIA_EXTENSIONS.has(ext)
}
