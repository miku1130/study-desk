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
    accent: '#0a84ff',
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
      { id: 'a', day: 1, periodId: 'p1', name: '高等数学', teacher: '王', location: 'A101', color: '#0a84ff' }
    ]
  },
  todos: { items: [{ id: '1', text: '测试任务', done: false, pomodoros: 0, createdAt: Date.now() }] },
  stats: { days: { [dkey(1)]: { pomodoros: 3, focusMinutes: 75 }, [dkey(0)]: { pomodoros: 2, focusMinutes: 50 } } },
  music: { tracks: [{ id: 'm1', name: '雨声', path: 'C:/fake/rain.mp3' }], volume: 0.6, loop: 'all' },
  water: { days: { [dkey(0)]: 3 } },
  books: {
    items: [
      { id: 'b1', name: '高等数学.pdf', path: 'C:/fake/math.pdf', category: '数学', addedAt: Date.now() },
      { id: 'b2', name: '英语语法.docx', path: 'C:/fake/eng.docx', category: '英语', addedAt: Date.now() }
    ]
  },
  countdowns: { items: [{ id: 'c1', title: '期末考试', date: dkey(-30), color: '#ff453a' }] }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1124, total: 1500, running: true, completed: 2 }))
ipcMain.handle('app:getVersion', () => '0.1.0')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)

const routes = [
  { hash: '', name: '仪表盘', sel: ['.app-shell', '.sidebar', '.hero'] },
  { hash: '/timetable', name: '课表', sel: ['.tt-grid'] },
  { hash: '/pomodoro', name: '番茄钟', sel: ['.ring', '.timer-card'] },
  { hash: '/music', name: '背景音乐', sel: ['.player'] },
  { hash: '/todo', name: '待办', sel: ['.todo-tabs', '.add-bar'] },
  { hash: '/bookshelf', name: '书架', sel: ['.bs-toolbar'] },
  { hash: '/countdown', name: '倒数日', sel: ['.cd-head'] },
  { hash: '/stats', name: '专注统计', sel: ['.chart'] },
  { hash: '/settings', name: '设置', sel: ['.seg', '.swatches'] },
  { hash: '/lock', name: '锁屏专注', sel: ['.lock', '.lock-time'] },
  { hash: '/widget', name: '桌面浮窗', sel: ['.widget', '.w-time'] }
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
    width: 1180,
    height: 760,
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
