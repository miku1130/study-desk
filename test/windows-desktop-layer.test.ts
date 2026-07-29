import { describe, expect, it } from 'vitest'
import { nativeWindowHandleToBigInt, parseDesktopLayerStatus } from '../src/main/windowsDesktopLayer'

describe('Windows desktop layer bridge', () => {
  it('reads 32-bit and 64-bit Electron window handles', () => {
    const handle32 = Buffer.alloc(4)
    handle32.writeUInt32LE(0x1234abcd)
    expect(nativeWindowHandleToBigInt(handle32)).toBe(0x1234abcdn)

    const handle64 = Buffer.alloc(8)
    handle64.writeBigUInt64LE(0x12345678abcdef01n)
    expect(nativeWindowHandleToBigInt(handle64)).toBe(0x12345678abcdef01n)
  })

  it('parses the final JSON status line from PowerShell output', () => {
    const output = [
      'diagnostic output',
      '{"supported":true,"attached":true,"parentClass":"Progman","hostClass":"Progman"}'
    ].join('\r\n')

    expect(parseDesktopLayerStatus(output)).toMatchObject({
      supported: true,
      attached: true,
      parentClass: 'Progman',
      hostClass: 'Progman'
    })
  })
})
