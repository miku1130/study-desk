import { describe, expect, it } from 'vitest'
import {
  attachmentKind,
  fileNameFromPath,
  mergeTodoAttachments
} from '../src/renderer/src/lib/todoAttachments'

describe('备忘录附件', () => {
  it('从 Windows 和 Unix 路径提取文件名', () => {
    expect(fileNameFromPath('C:\\study\\notes\\chapter-1.pdf')).toBe('chapter-1.pdf')
    expect(fileNameFromPath('/home/user/photo.png')).toBe('photo.png')
  })

  it('按扩展名识别可直接展示的图片', () => {
    expect(attachmentKind('diagram.PNG')).toBe('image')
    expect(attachmentKind('report.docx')).toBe('file')
  })

  it('合并附件时忽略重复路径', () => {
    const first = mergeTodoAttachments([], ['C:\\study\\photo.png'])
    const merged = mergeTodoAttachments(first, [
      'c:\\study\\PHOTO.png',
      'C:\\study\\report.pdf'
    ])
    expect(merged).toHaveLength(2)
    expect(merged.map((item) => item.kind)).toEqual(['image', 'file'])
  })
})
