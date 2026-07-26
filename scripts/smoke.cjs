// 运行时冒烟验收：加载构建产物，逐路由校验渲染与控制台错误。
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { join } = require('path')
const { pathToFileURL } = require('url')
const { writeFileSync } = require('fs')

function dkey(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const sample = {
  settings: {
    theme: 'light',
    accent: '#4fae98',
    bell: { enabled: true, onSound: '', offSound: '', volume: 0.8 },
    pomodoro: {
      workMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      longBreakEvery: 4,
      autoStart: false,
      lockscreen: false,
      wallpaper: '',
      sound: '',
      volume: 0.8
    },
    autostart: false,
    hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' }
  },
  timetable: {
    periods: [{ id: 'p1', name: '第 1 节', start: '08:00', end: '08:45' }],
    lessons: [
      { id: 'a', day: 1, periodId: 'p1', name: '高等数学', teacher: '王', location: 'A101', color: '#77b5e8' }
    ]
  },
  todos: {
    items: [
      { id: '1', text: '测试任务', done: false, pomodoros: 0, createdAt: Date.now(), kind: 'task' },
      { id: 'm1', text: '整理复习提纲', done: false, pomodoros: 0, createdAt: Date.now(), kind: 'memo' },
      { id: 'm2', text: '尝试新的学习方法', done: false, pomodoros: 0, createdAt: Date.now() - 1, kind: 'idea' }
    ]
  },
  stats: { days: { [dkey(1)]: { pomodoros: 3, focusMinutes: 75 }, [dkey(0)]: { pomodoros: 2, focusMinutes: 50 } } },
  music: { tracks: [{ id: 'm1', name: '雨声', path: 'C:/fake/rain.mp3' }], volume: 0.6, loop: 'all' },
  water: { days: { [dkey(0)]: 3 } },
  books: {
    items: [
      { id: 'b1', name: '高等数学.pdf', path: 'C:/fake/math.pdf', category: '数学', addedAt: Date.now() },
      { id: 'b2', name: '英语语法.docx', path: 'C:/fake/eng.docx', category: '英语', addedAt: Date.now() }
    ]
  },
  countdowns: { items: [
    { id: 'c1', title: '期末考试', date: dkey(-30), color: '#ff453a', bg: '' },
    { id: 'c2', title: '英语六级', date: dkey(-60), color: '#77b5e8', bg: '' }
  ] },
  desktopWidgets: {
    items: [
      {
        id: 'w1',
        kind: 'countdown',
        sourceId: 'c1',
        title: '期末考试',
        enabled: true,
        launchOnStartup: false,
        locked: false,
        alwaysOnTop: true,
        size: 'medium',
        background: '',
        backgroundColor: '#24312c',
        overlayOpacity: 0.42,
        surfaceOpacity: 1,
        font: 'system',
        fontColor: '#ffffff',
        accentColor: '#7ed4b5'
      },
      {
        id: 'w2', kind: 'memo', sourceId: '', title: '', enabled: true,
        launchOnStartup: false, locked: false, alwaysOnTop: false, size: 'medium', background: '',
        backgroundColor: '#3a3428', overlayOpacity: 0.4, surfaceOpacity: 1,
        font: 'handwriting', fontColor: '#fffdf7', accentColor: '#e4bd68'
      }
    ]
  }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('online:search', () => [])
ipcMain.handle('media:download', () => '')
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1124, total: 1500, running: true, completed: 2 }))
ipcMain.handle('app:getVersion', () => '0.1.0')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
ipcMain.handle('desktop-widget:close', () => true)
ipcMain.handle('desktop-widget:set-pointer-interactive', () => true)

const routes = [
  { hash: '', name: '仪表盘', sel: ['.app-shell', '.sidebar', '.hero'] },
  { hash: '/timetable', name: '课表', sel: ['.tt-grid'] },
  { hash: '/pomodoro', name: '番茄钟', sel: ['.ring', '.timer-card'] },
  { hash: '/music', name: '背景音乐', sel: ['.player'] },
  { hash: '/todo', name: '备忘录中心', sel: ['.memo-tabs', '.quick-card'] },
  { hash: '/bookshelf', name: '学习资料库', sel: ['.library-tools', '.library-stats'] },
  { hash: '/countdown', name: '倒数日', sel: ['.cd-head'] },
  { hash: '/widgets', name: '桌面摆件管理', sel: ['.widgets-page', '.widget-list', '.desktop-widget-card'] },
  { hash: '/stats', name: '专注统计', sel: ['.chart'] },
  { hash: '/garden', name: '专注花园', sel: ['.garden-page', '.plot-grid', '.quest-card'] },
  { hash: '/breathe', name: '深呼吸', sel: ['.breathe', '.orb'] },
  { hash: '/settings', name: '设置', sel: ['.seg', '.swatches'] },
  { hash: '/lock', name: '锁屏专注', sel: ['.lock', '.lock-time'] },
  { hash: '/widget', name: '桌面浮窗', sel: ['.widget', '.w-time'] },
  { hash: '/clockwidget', name: '时钟浮窗', sel: ['.cw', '.cw-clock'] },
  { hash: '/desktop-widget/w1', name: '倒数日桌面摆件', width: 340, height: 218, assertOpaque: true, sel: ['.desktop-widget-root', '.desktop-widget-card', '.countdown-value'] },
  { hash: '/desktop-widget/w2', name: '备忘录桌面摆件', width: 340, height: 218, sel: ['.desktop-widget-root', '.memo-list', '.memo-item'] }
]

// 防止销毁窗口后所有窗口关闭触发默认自动退出，中断验收循环
app.on('window-all-closed', () => undefined)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function makeConsoleHandler(errors) {
  return (...args) => {
    let level
    let message
    if (args.length && args[0] && typeof args[0] === 'object' && 'level' in args[0]) {
      level = args[0].level
      message = args[0].message
    } else {
      level = args[1]
      message = args[2]
    }
    if (level === 3 || level === 'error') errors.push(String(message))
  }
}

async function checkRoute(route) {
  const errors = []
  const win = new BrowserWindow({
    width: route.width ?? 1180,
    height: route.height ?? 760,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  win.webContents.on('console-message', makeConsoleHandler(errors))
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code !== -3) errors.push(`did-fail-load(${code}) ${desc}`)
  })
  win.webContents.on('render-process-gone', (_e, d) => errors.push(`render-gone ${d.reason}`))

  const base = pathToFileURL(join(__dirname, '../out/renderer/index.html')).toString()
  try {
    await win.loadURL(route.hash ? `${base}#${route.hash}` : base)
  } catch (e) {
    errors.push('loadURL: ' + (e && e.message))
  }
  await wait(1300)

  let domOk = false
  try {
    domOk = await win.webContents.executeJavaScript(
      `(() => { const root = document.querySelector('#app'); if (!root || root.childElementCount === 0) return false; const sel = ${JSON.stringify(
        route.sel
      )}; return sel.every((s) => !!document.querySelector(s)) })()`
    )
  } catch (e) {
    errors.push('executeJavaScript: ' + (e && e.message))
  }
  if (route.assertOpaque) {
    const surfaceOpacity = await win.webContents.executeJavaScript(
      `getComputedStyle(document.querySelector('.widget-surface')).opacity`
    )
    const transparentShell = await win.webContents.executeJavaScript(
      `getComputedStyle(document.documentElement).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)'`
    )
    if (surfaceOpacity !== '1') {
      errors.push(`100% 不透明度未生效: ${surfaceOpacity}`)
    }
    if (!transparentShell) {
      errors.push('摆件窗口外层背景不透明')
    }
  }

  if (route.hash === '/widgets' && domOk) {
    const editorResult = await win.webContents.executeJavaScript(`(async () => {
      const edit = document.querySelector('button[title="编辑外观"]')
      if (!edit) return '缺少编辑按钮'
      edit.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      const slider = document.querySelector('.range-field input[type="range"]')
      const surface = document.querySelector('.editor-preview .widget-surface')
      if (!slider || !surface) return '编辑弹窗未打开'
      slider.value = '0.37'
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 80))
      return getComputedStyle(surface).opacity === '0.37' ? '' : '属性未实时预览'
    })()`)
    if (editorResult) errors.push(editorResult)
  }


  if (route.hash === '/desktop-widget/w1' && domOk) {
    const interactionResult = await win.webContents.executeJavaScript(`(async () => {
      const cycle = document.querySelector('button[title="切换倒数日"]')
      const lock = document.querySelector('.widget-lock-toggle')
      if (!cycle || !lock) return '缺少倒数切换或锁定按钮'
      cycle.click()
      await new Promise((resolve) => setTimeout(resolve, 60))
      if (!document.querySelector('.widget-title')?.textContent?.includes('英语六级')) return '倒数日未切换'
      lock.click()
      await new Promise((resolve) => setTimeout(resolve, 60))
      return document.querySelector('.widget-lock-toggle')?.getAttribute('title') === '解锁摆件' ? '' : '锁定状态未更新'
    })()`)
    if (interactionResult) errors.push(interactionResult)
  }

  if (route.hash === '/desktop-widget/w2' && domOk) {
    const memoResult = await win.webContents.executeJavaScript(`(async () => {
      const before = document.querySelectorAll('.memo-item').length
      document.querySelector('button[title="快捷记录"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 30))
      const input = document.querySelector('.memo-quick input')
      if (!input) return '快捷记录输入框未打开'
      input.value = '桌面快捷记录测试'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.memo-quick')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 60))
      return document.querySelectorAll('.memo-item').length === before + 1 ? '' : '快捷记录未保存到列表'
    })()`)
    if (memoResult) errors.push(memoResult)
  }

  win.destroy()
  return { route, domOk, errors }
}

app.whenReady().then(async () => {
  const lines = []
  const log = (s) => lines.push(s)
  try {
    nativeTheme.themeSource = 'light'
    const results = []
    for (const r of routes) {
      results.push(await checkRoute(r))
    }

    let pass = 0
    let fail = 0
    log('========== 运行时冒烟验收 ==========')
    for (const res of results) {
      const ok = res.domOk && res.errors.length === 0
      if (ok) pass += 1
      else fail += 1
      log(
        `${ok ? 'PASS' : 'FAIL'}  ${res.route.name}  路由=${res.route.hash || '/'}  DOM=${
          res.domOk ? 'ok' : 'MISSING'
        }  错误=${res.errors.length}`
      )
      for (const er of res.errors) log(`        ↳ ${er}`)
    }
    log('-----------------------------------')
    log(`总计 ${results.length} 路由：通过 ${pass} / 失败 ${fail}`)

    const report = lines.join('\n')
    writeFileSync(join(__dirname, '..', 'smoke-report.txt'), report, 'utf-8')
    console.log(report)
    app.exit(fail > 0 ? 1 : 0)
  } catch (e) {
    writeFileSync(
      join(__dirname, '..', 'smoke-report.txt'),
      'SMOKE CRASH:\n' + (e && e.stack ? e.stack : String(e)),
      'utf-8'
    )
    app.exit(2)
  }
})
