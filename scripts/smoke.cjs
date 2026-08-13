// 运行时冒烟验收：加载构建产物，逐路由校验渲染与控制台错误。
const { app, BrowserWindow, ipcMain, nativeTheme, protocol, net } = require('electron')
const { join } = require('path')
const { pathToFileURL } = require('url')
const { writeFileSync } = require('fs')

protocol.registerSchemesAsPrivileged([
  { scheme: 'studymedia', privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true } }
])

const smokeImage = join(__dirname, '../src/renderer/src/assets/pet/cat-attentive.png')
const smokeFile = join(__dirname, '../package.json')

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
      {
        id: 'm1', text: '整理复习提纲', done: false, pomodoros: 0, createdAt: Date.now(), kind: 'memo',
        attachments: [
          { id: 'a-image', kind: 'image', name: '学习图片.png', path: smokeImage, addedAt: Date.now() },
          { id: 'a-file', kind: 'file', name: 'package.json', path: smokeFile, addedAt: Date.now() }
        ]
      },
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
        font: 'handwriting', fontColor: '#fffdf7', accentColor: '#e4bd68',
        memoDisplayMode: 'list', memoImageAttachmentId: ''
      },
      {
        id: 'w3', kind: 'memo', sourceId: '', title: '', enabled: true,
        launchOnStartup: false, locked: false, alwaysOnTop: false, size: 'medium', background: '',
        backgroundColor: '#3a3428', overlayOpacity: 0.4, surfaceOpacity: 1,
        font: 'system', fontColor: '#ffffff', accentColor: '#e4bd68',
        memoDisplayMode: 'image', memoImageAttachmentId: 'a-image'
      }
    ]
  },
  petCompanion: {
    coins: 120,
    catId: 'mikan',
    roomId: 'sunroom',
    furnitureId: 'oak-desk',
    unlockedCats: ['mikan'],
    unlockedRooms: ['sunroom'],
    unlockedFurniture: ['oak-desk'],
    keepsakes: [
      { id: 'gift-1', itemId: 'paper-star', kind: 'gift', source: 'pomodoro', at: Date.now() },
      { id: 'trash-1', itemId: 'pencil-shavings', kind: 'trash', source: 'pomodoro', at: Date.now() - 3600000 }
    ],
    completedSessions: 6,
    abandonedSessions: 1,
    activeClass: null,
    settledClasses: []
  }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('online:search', () => [])
ipcMain.handle('media:download', () => '')
ipcMain.handle('shell:openPath', () => '')
ipcMain.handle('dialog:openFiles', () => [])
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1124, total: 1500, running: true, completed: 2 }))
ipcMain.handle('app:getVersion', () => '0.1.0')
ipcMain.handle('autostart:get', () => false)
// 故意报一个占用失败，验证设置页真的会把热键冲突显示出来
ipcMain.handle('shortcuts:status', () => [
  { action: 'toggleTimer', accelerator: 'CommandOrControl+Alt+P', reason: 'taken' }
])
ipcMain.handle('shortcuts:update', () => [])
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
ipcMain.handle('pet-widget:sync', () => undefined)
ipcMain.handle('pet-widget:hide', () => undefined)
ipcMain.handle('desktop-widget:close', () => true)
ipcMain.handle('desktop-widget:set-pointer-interactive', () => true)
ipcMain.handle('study-room:get-state', () => ({
  status: 'idle', selfId: '', nickname: '小桌', room: null, members: [], error: ''
}))
ipcMain.handle('study-room:get-cheers', () => [
  { id: 'fighting', emoji: '💪', label: '加油' },
  { id: 'clap', emoji: '👏', label: '鼓掌' },
  { id: 'star', emoji: '⭐', label: '点赞' },
  { id: 'flower', emoji: '🌸', label: '送花' },
  { id: 'tea', emoji: '🍵', label: '递杯茶' },
  { id: 'heart', emoji: '💗', label: '打气' },
  { id: 'sparkle', emoji: '✨', label: '厉害' },
  { id: 'rocket', emoji: '🚀', label: '冲刺' }
])
ipcMain.handle('study-room:validate-name', (_e, _kind, text) => ({ ok: true, value: String(text ?? ''), reason: '' }))
ipcMain.handle('study-room:set-nickname', (_e, text) => ({ ok: true, value: String(text ?? ''), reason: '' }))
ipcMain.handle('study-room:host', () => ({ ok: true }))
ipcMain.handle('study-room:join', () => ({ ok: true }))
ipcMain.handle('study-room:leave', () => undefined)
ipcMain.handle('study-room:set-goal', () => true)
ipcMain.handle('study-room:cheer', () => true)
ipcMain.handle('study-room:discover-start', () => undefined)
ipcMain.handle('study-room:discover-stop', () => undefined)
ipcMain.handle('study-room:online-snapshot', () => ({
  status: 'online',
  error: '',
  deviceId: 'smoke-device',
  intro: '一起上岸',
  checkin: { wakeAt: '07:20', sleepAt: '' },
  myRooms: [
    { id: 'r1', code: 'SMOKE001', name: '考研自习室', intro: '安静刷题', memberCount: 3, attendeeCount: 1, focusingCount: 1, isOwner: true }
  ],
  browse: [
    { id: 'r2', name: '早八自习室', intro: '', memberCount: 8, attendeeCount: 4, focusingCount: 2, isOwner: false }
  ],
  room: null,
  wishes: [],
  pendingWishes: []
}))
ipcMain.handle('study-room:online-connect', () => undefined)
ipcMain.handle('study-room:watch-browse', () => undefined)
ipcMain.handle('study-room:go-offline', () => undefined)
ipcMain.handle('study-room:set-intro', () => undefined)
ipcMain.handle('study-room:checkin', () => undefined)
ipcMain.handle('study-room:create', () => undefined)
ipcMain.handle('study-room:join-room', () => undefined)
ipcMain.handle('study-room:quit-room', () => undefined)
ipcMain.handle('study-room:dissolve', () => undefined)
ipcMain.handle('study-room:update-room', () => undefined)
ipcMain.handle('study-room:enter', () => undefined)
ipcMain.handle('study-room:exit', () => undefined)
ipcMain.handle('study-room:set-range', () => undefined)
ipcMain.handle('study-room:wish-add', () => undefined)
ipcMain.handle('study-room:wish-report', () => undefined)
ipcMain.handle('study-room:wish-delete', () => undefined)
ipcMain.handle('study-room:wish-pending', () => undefined)
ipcMain.handle('study-room:wish-restore', () => undefined)

// 猫咪动画自检：待机是逐帧视频，写字是立绘 + CSS 位移，两种都必须真的在动
const CAT_ANIMATION_PROBE = `(async (scope) => {
  const root = scope ? document.querySelector(scope) : document
  if (!root) return '找不到 ' + scope
  const video = root.querySelector('.pet-animation-video')
  if (video) {
    if (video.readyState < 2 || !video.videoWidth) return '猫咪待机视频未加载'
    await video.play()
    const frameHash = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(video, 0, 0, 64, 64)
      return context.getImageData(0, 0, 64, 64).data.reduce((sum, value, index) => sum + value * ((index % 17) + 1), 0)
    }
    const first = frameHash()
    await new Promise((resolve) => setTimeout(resolve, 180))
    return frameHash() === first ? '猫咪待机动画未播放' : ''
  }
  const still = root.querySelector('.pet-animation-still')
  if (!still) return '猫咪贴图未渲染'
  if (!still.complete || !still.naturalWidth) return '猫咪立绘未加载'
  const running = [still, still.parentElement]
    .filter(Boolean)
    .flatMap((el) => el.getAnimations())
    .filter((a) => a.playState === 'running')
  if (running.length < 2) return '猫咪立绘动画缺失（呼吸与笔触应各有一条）'
  const before = running.map((a) => Number(a.currentTime) || 0)
  await new Promise((resolve) => setTimeout(resolve, 180))
  const after = running.map((a) => Number(a.currentTime) || 0)
  return after.some((value, index) => value > before[index]) ? '' : '猫咪立绘动画时间未推进'
})`

const routes = [
  { hash: '', name: '仪表盘', sel: ['.app-shell', '.sidebar', '.hero'] },
  { hash: '/timetable', name: '课表', sel: ['.tt-grid'] },
  { hash: '/pomodoro', name: '番茄钟', sel: ['.ring', '.timer-card'] },
  { hash: '/music', name: '背景音乐', sel: ['.player'] },
  { hash: '/todo', name: '备忘录中心', sel: ['.memo-tabs', '.quick-card'] },
  { hash: '/bookshelf', name: '学习资料库', sel: ['.library-tools', '.library-stats'] },
  { hash: '/countdown', name: '倒数日', sel: ['.cd-head'] },
  { hash: '/widgets', name: '桌面摆件管理', sel: ['.widgets-page', '.widget-list', '.desktop-widget-card'] },
  { hash: '/study-room', name: '自习室', sel: ['.study-room-page', '.online-lobby', '.code-input'] },
  { hash: '/stats', name: '专注统计', sel: ['.chart'] },
  { hash: '/garden', name: '专注花园', sel: ['.garden-page', '.plot-grid', '.quest-card'] },
  { hash: '/pet', name: '猫咪伴学', sel: ['.pet-page', '.pet-room', '.wardrobe-grid', '.collection-grid'] },
  { hash: '/breathe', name: '深呼吸', sel: ['.breathe', '.orb'] },
  { hash: '/settings', name: '设置', sel: ['.seg', '.swatches'] },
  { hash: '/lock', name: '锁屏专注', sel: ['.lock', '.lock-time'] },
  { hash: '/widget', name: '桌面浮窗', sel: ['.widget', '.w-time'] },
  { hash: '/clockwidget', name: '时钟浮窗', sel: ['.cw', '.cw-clock'] },
  { hash: '/pet-widget', name: '猫咪伴学挂件', width: 230, height: 238, sel: ['.pet-widget-root', '.widget-cat', '.widget-bubble'] },
  { hash: '/desktop-widget/w1', name: '倒数日桌面摆件', width: 340, height: 218, assertOpaque: true, sel: ['.desktop-widget-root', '.desktop-widget-card', '.countdown-value'] },
  { hash: '/desktop-widget/w2', name: '备忘录桌面摆件', width: 340, height: 218, sel: ['.desktop-widget-root', '.memo-list', '.memo-item'] },
  { hash: '/desktop-widget/w3', name: '纯图片桌面摆件', width: 340, height: 218, sel: ['.desktop-widget-root', '.desktop-widget-card', '.memo-pure-image'] }
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
  const verifiesVisibleAnimation = ['/pet', '/lock', '/pet-widget'].includes(route.hash)
  if (verifiesVisibleAnimation) win.showInactive()
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

    const pureModeResult = await win.webContents.executeJavaScript(`(async () => {
      const memoRow = document.querySelectorAll('.widget-row')[1]
      const edit = memoRow?.querySelector('button[title="编辑外观"]')
      if (!edit) return '缺少备忘录外观编辑按钮'
      edit.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      const pureImage = [...document.querySelectorAll('.memo-mode-segmented button')].find((button) => button.textContent?.includes('纯图片'))
      if (!pureImage || pureImage.disabled) return '纯图片模式不可选择'
      pureImage.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      const thumbnail = document.querySelector('.memo-image-picker button')
      if (!thumbnail) return '缺少备忘录图片选择器'
      thumbnail.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      return document.querySelector('.editor-preview .memo-pure-image') ? '' : '纯图片预览未实时更新'
    })()`)
    if (pureModeResult) errors.push(pureModeResult)
  }

  if (route.hash === '/pet' && domOk) {
    const petResult = await win.webContents.executeJavaScript(`(async () => {
      const room = document.querySelector('.room-background')
      if (!room?.complete || !room.naturalWidth) return '房间背景未加载'
      const animationError = await (${CAT_ANIMATION_PROBE})('.cat-image')
      if (animationError) return animationError
      document.querySelector('.cat-button')?.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      if (!document.querySelector('.cat-bubble')) return '摸猫反馈未出现'
      const furnitureTab = [...document.querySelectorAll('.wardrobe-tabs button')].find((button) => button.textContent?.includes('家具'))
      furnitureTab?.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      const lamp = [...document.querySelectorAll('.wardrobe-item')].find((button) => button.textContent?.includes('蘑菇台灯'))
      lamp?.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      return lamp?.textContent?.includes('使用中') ? '' : '购买并切换家具未生效'
    })()`)
    if (petResult) errors.push(petResult)
  }

  if (route.hash === '/todo' && domOk) {
    const attachmentResult = await win.webContents.executeJavaScript(`(async () => {
      const memoTab = [...document.querySelectorAll('.memo-tab')].find((button) => button.textContent?.includes('备忘录'))
      memoTab?.click()
      await new Promise((resolve) => setTimeout(resolve, 80))
      const image = document.querySelector('.memo-attachments img')
      const file = document.querySelector('.memo-attachments .file-open')
      if (!image || !file) return '备忘录附件未渲染'
      if (!image.complete) await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }))
      if (!image.naturalWidth) return '备忘录图片未直接展示'
      file.click()
      await new Promise((resolve) => setTimeout(resolve, 30))
      return ''
    })()`)
    if (attachmentResult) errors.push(attachmentResult)
  }

  if ((route.hash === '/lock' || route.hash === '/pet-widget') && domOk) {
    const animationResult = await win.webContents.executeJavaScript(`(${CAT_ANIMATION_PROBE})('')`)
    if (animationResult) errors.push(animationResult)
  }

  if (verifiesVisibleAnimation) win.hide()


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
      if (document.querySelectorAll('.memo-item').length !== before + 1) return '快捷记录未保存到列表'
      const image = document.querySelector('.widget-memo-attachments img')
      const file = document.querySelector('.widget-memo-attachments .file-open')
      if (!image || !file) return '桌面备忘录附件未适配'
      if (!image.complete) await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }))
      return image.naturalWidth ? '' : '桌面备忘录图片未加载'
    })()`)
    if (memoResult) errors.push(memoResult)
  }

  if (route.hash === '/desktop-widget/w3' && domOk) {
    const pureImageResult = await win.webContents.executeJavaScript(`(async () => {
      const image = document.querySelector('.memo-pure-image')
      if (!image) return '纯图片未渲染'
      if (!image.complete) await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }))
      if (!image.naturalWidth) return '纯图片未加载'
      if (document.querySelector('.widget-surface, .widget-head, .memo-body')) return '纯图片模式仍显示卡片内容'
      return ''
    })()`)
    if (pureImageResult) errors.push(pureImageResult)
  }

  win.destroy()
  return { route, domOk, errors }
}

app.whenReady().then(async () => {
  const lines = []
  const log = (s) => lines.push(s)
  try {
    protocol.handle('studymedia', (request) => {
      const url = new URL(request.url)
      const path = url.searchParams.get('p')
      return path ? net.fetch(pathToFileURL(path).toString()) : new Response('missing path', { status: 400 })
    })
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
