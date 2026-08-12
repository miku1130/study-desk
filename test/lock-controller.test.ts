import { describe, expect, it } from 'vitest'
import { createLockController, type LockWindowHandle } from '../src/main/lockController'

/** 模拟 BrowserWindow：closed 回调由测试手动触发，用来重现「关闭是异步的」 */
function makeFakeWindow(): LockWindowHandle & {
  destroyed: boolean
  focused: number
  focus: () => void
  emitClosed: () => void
} {
  let closedListener: (() => void) | null = null
  return {
    destroyed: false,
    focused: 0,
    isDestroyed() {
      return this.destroyed
    },
    destroy() {
      this.destroyed = true
    },
    focus() {
      this.focused += 1
    },
    onClosed(listener) {
      closedListener = listener
    },
    emitClosed() {
      closedListener?.()
    }
  }
}

describe('锁屏窗口生命周期', () => {
  it('重复 open 不会叠出第二个全屏窗，也不抢焦点', () => {
    const created: ReturnType<typeof makeFakeWindow>[] = []
    const lock = createLockController(() => {
      const win = makeFakeWindow()
      created.push(win)
      return win
    })

    lock.open()
    lock.open()
    lock.open()

    expect(created).toHaveLength(1)
    // 番茄钟每秒 tick 都会调 open，这里但凡有点动作都会变成每秒一次
    expect(created[0].focused).toBe(0)
  })

  it('close 之后再 open 会重新建一个', () => {
    const created: ReturnType<typeof makeFakeWindow>[] = []
    const lock = createLockController(() => {
      const win = makeFakeWindow()
      created.push(win)
      return win
    })

    lock.open()
    lock.close()
    expect(created[0].destroyed).toBe(true)
    expect(lock.isOpen()).toBe(false)

    lock.open()
    expect(created).toHaveLength(2)
    expect(lock.isOpen()).toBe(true)
  })

  it('旧窗口迟到的 closed 不会把新窗口的引用清掉', () => {
    const created: ReturnType<typeof makeFakeWindow>[] = []
    const lock = createLockController(() => {
      const win = makeFakeWindow()
      created.push(win)
      return win
    })

    lock.open()
    const first = created[0]
    lock.close()
    lock.open()
    const second = created[1]

    // 第一个窗口这时才真正销毁完毕并回调
    first.emitClosed()

    expect(lock.isOpen()).toBe(true)
    lock.close()
    expect(second.destroyed).toBe(true)
    expect(created).toHaveLength(2)
  })

  it('窗口被外部销毁后 open 能重新建出来', () => {
    const created: ReturnType<typeof makeFakeWindow>[] = []
    const lock = createLockController(() => {
      const win = makeFakeWindow()
      created.push(win)
      return win
    })

    lock.open()
    created[0].destroyed = true
    expect(lock.isOpen()).toBe(false)

    lock.open()
    expect(created).toHaveLength(2)
  })

  it('没开过的时候 close 不报错', () => {
    const lock = createLockController(() => makeFakeWindow())
    expect(() => lock.close()).not.toThrow()
    expect(lock.isOpen()).toBe(false)
  })
})
