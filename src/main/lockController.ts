/**
 * 锁屏窗口的开关状态机。
 *
 * 单独拆出来是因为这里有个不容易看出来的坑：BrowserWindow.close() 是异步的，
 * 调用之后窗口还活着。若此刻又要开锁屏，就会同时存在两个全屏窗；
 * 更糟的是旧窗口随后触发 closed，会把已经指向新窗口的引用清成 null，
 * 新窗口从此谁也关不掉，用户只能对着一块黑屏按不动。
 */

/** BrowserWindow 中本状态机真正用到的部分 */
export interface LockWindowHandle {
  isDestroyed(): boolean
  destroy(): void
  onClosed(listener: () => void): void
}

export interface LockController {
  open(): void
  close(): void
  isOpen(): boolean
}

export function createLockController(create: () => LockWindowHandle): LockController {
  let current: LockWindowHandle | null = null

  const alive = (): LockWindowHandle | null =>
    current && !current.isDestroyed() ? current : null

  return {
    open(): void {
      // 番茄钟每秒 tick 都会调这里，已经开着就必须彻底静默：
      // 哪怕只是 focus 一下，也会变成每秒抢一次焦点
      if (alive()) return
      const win = create()
      current = win
      // 只有引用还指向自己时才清空，否则会把后开的窗口弄丢
      win.onClosed(() => {
        if (current === win) current = null
      })
    },

    close(): void {
      const win = alive()
      current = null
      // destroy 而不是 close：close 要等渲染进程卸载完才真正消失，
      // 这段空档里的 open 会叠出第二个全屏窗
      win?.destroy()
    },

    isOpen(): boolean {
      return alive() !== null
    }
  }
}
