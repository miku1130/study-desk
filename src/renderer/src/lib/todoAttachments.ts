import type { TodoAttachment, TodoAttachmentKind } from '../types'
import { uid } from '../types'

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif',
  'svg'
])

export const TODO_IMAGE_FILTER = [
  { name: '图片', extensions: Array.from(IMAGE_EXTENSIONS) }
]

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

export function attachmentKind(path: string): TodoAttachmentKind {
  const extension = fileNameFromPath(path).split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'file'
}

export function createTodoAttachment(path: string, forcedKind?: TodoAttachmentKind): TodoAttachment {
  return {
    id: uid(),
    kind: forcedKind ?? attachmentKind(path),
    name: fileNameFromPath(path),
    path,
    addedAt: Date.now()
  }
}

export function mergeTodoAttachments(
  current: TodoAttachment[],
  paths: string[],
  forcedKind?: TodoAttachmentKind
): TodoAttachment[] {
  const known = new Set(current.map((item) => item.path.toLocaleLowerCase()))
  const next = [...current]
  for (const path of paths) {
    const normalized = path.trim()
    if (!normalized || known.has(normalized.toLocaleLowerCase())) continue
    known.add(normalized.toLocaleLowerCase())
    next.push(createTodoAttachment(normalized, forcedKind))
  }
  return next.slice(0, 20)
}
