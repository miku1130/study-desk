// 临时验证脚本：加载构建产物并截图（用于阶段性预览，非应用运行时代码）
const { app, BrowserWindow, ipcMain, nativeTheme, protocol, net } = require('electron')
const { join } = require('path')
const { pathToFileURL } = require('url')
const { writeFileSync } = require('fs')

const theme = process.env.SHOT_THEME === 'dark' ? 'dark' : 'light'
const route = process.env.SHOT_ROUTE || ''
const compactPetWidget = route === '/pet-widget'
const compactDesktopWidget = route.startsWith('/desktop-widget/')
const transparentWidget = compactPetWidget || compactDesktopWidget
const minimumWidth = compactPetWidget ? 230 : compactDesktopWidget ? 340 : 760
const minimumHeight = compactPetWidget ? 238 : compactDesktopWidget ? 218 : 600
const width = Math.max(minimumWidth, Number(process.env.SHOT_WIDTH) || 1180)
const height = Math.max(minimumHeight, Number(process.env.SHOT_HEIGHT) || 760)

protocol.registerSchemesAsPrivileged([
  { scheme: 'studymedia', privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true } }
])

const attachmentImage = join(__dirname, '../src/renderer/src/assets/pet/cat-attentive.png')
const attachmentFile = join(__dirname, '../package.json')

const C = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#5ac8fa']
function dkey(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const sample = {
  settings: {
    theme,
    accent: '#0a84ff',
    bell: { enabled: true, onSound: '', offSound: '', volume: 0.8 },
    pomodoro: {
      workMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      longBreakEvery: 4,
      autoStart: false,
      lockscreen: true,
      wallpaper: '',
      sound: '',
      volume: 0.8
    },
    autostart: false,
    hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' }
  },
  timetable: {
    periods: [
      { id: 'p1', name: '第 1 节', start: '08:00', end: '08:45' },
      { id: 'p2', name: '第 2 节', start: '08:55', end: '09:40' },
      { id: 'p3', name: '第 3 节', start: '10:00', end: '10:45' },
      { id: 'p4', name: '第 4 节', start: '10:55', end: '11:40' },
      { id: 'p5', name: '第 5 节', start: '14:00', end: '14:45' },
      { id: 'p6', name: '第 6 节', start: '14:55', end: '15:40' }
    ],
    lessons: [
      { id: 'a', day: 1, periodId: 'p1', name: '高等数学', teacher: '王', location: 'A101', color: C[0] },
      { id: 'b', day: 1, periodId: 'p2', name: '大学英语', teacher: '李', location: 'B202', color: C[1] },
      { id: 'c', day: 2, periodId: 'p3', name: '线性代数', teacher: '张', location: 'A305', color: C[2] },
      { id: 'd', day: 3, periodId: 'p1', name: '数据结构', teacher: '陈', location: 'C401', color: C[4] },
      { id: 'e', day: 4, periodId: 'p5', name: '大学物理', teacher: '赵', location: 'D102', color: C[3] },
      { id: 'f', day: 5, periodId: 'p2', name: '程序设计', teacher: '刘', location: 'C402', color: C[5] }
    ]
  },
  todos: {
    items: [
      { id: '1', text: '完成高数第三章习题', done: false, pomodoros: 2, createdAt: Date.now(), priority: 3, due: dkey(0), note: '' },
      { id: '2', text: '背 30 个英语单词', done: false, pomodoros: 0, createdAt: Date.now(), priority: 2, due: dkey(0), note: '重点章节' },
      { id: '3', text: '复习数据结构', done: false, pomodoros: 0, createdAt: Date.now(), priority: 1, due: dkey(-1), note: '' },
      { id: '4', text: '整理错题本', done: true, pomodoros: 3, createdAt: Date.now(), priority: 0, due: '', completedAt: Date.now() },
      {
        id: '5', text: '课堂板书与复习资料', done: false, pomodoros: 0, createdAt: Date.now() + 1,
        priority: 0, due: '', note: '图片直接查看，配置文件可以点击打开。', kind: 'memo',
        attachments: [
          { id: 'shot-image', kind: 'image', name: '课堂板书.png', path: attachmentImage, addedAt: Date.now() },
          { id: 'shot-file', kind: 'file', name: 'package.json', path: attachmentFile, addedAt: Date.now() }
        ]
      }
    ]
  },
  stats: {
    days: {
      [dkey(6)]: { pomodoros: 4, focusMinutes: 100 },
      [dkey(5)]: { pomodoros: 6, focusMinutes: 150 },
      [dkey(4)]: { pomodoros: 3, focusMinutes: 75 },
      [dkey(3)]: { pomodoros: 8, focusMinutes: 200 },
      [dkey(2)]: { pomodoros: 5, focusMinutes: 125 },
      [dkey(1)]: { pomodoros: 7, focusMinutes: 175 },
      [dkey(0)]: { pomodoros: 3, focusMinutes: 75 }
    }
  },
  music: {
    tracks: [
      { id: 'm1', name: '雨声白噪音', path: 'C:/fake/rain.mp3' },
      { id: 'm2', name: '咖啡馆环境音', path: 'C:/fake/cafe.mp3' },
      { id: 'm3', name: '钢琴轻音乐', path: 'C:/fake/piano.mp3' }
    ],
    volume: 0.6,
    loop: 'all'
  },
  water: { days: { [dkey(0)]: 4 } },
  books: {
    items: [
      { id: 'b1', name: '高等数学（同济第七版）.pdf', path: 'C:/fake/math.pdf', category: '数学', addedAt: Date.now() },
      { id: 'b2', name: '新概念英语 3.docx', path: 'C:/fake/eng.docx', category: '英语', addedAt: Date.now() },
      { id: 'b3', name: '算法导论.epub', path: 'C:/fake/algo.epub', category: '计算机', addedAt: Date.now() },
      { id: 'b4', name: '考研政治大纲.pdf', path: 'C:/fake/politics.pdf', category: '政治', addedAt: Date.now() },
      { id: 'b5', name: '英语真题.pptx', path: 'C:/fake/exam.pptx', category: '英语', addedAt: Date.now() }
    ]
  },
  countdowns: {
    items: [
      { id: 'c1', title: '期末考试', date: dkey(-12), color: '#ff453a' },
      { id: 'c2', title: '英语六级', date: dkey(-30), color: '#0a84ff' },
      { id: 'c3', title: '寒假', date: dkey(-45), color: '#30d158' }
    ]
  },
  desktopWidgets: {
    items: [
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
        memoDisplayMode: 'image', memoImageAttachmentId: 'shot-image'
      }
    ]
  },
  petCompanion: {
    coins: 120,
    catId: 'mikan',
    roomId: 'sunroom',
    furnitureId: 'floor-lamp',
    unlockedCats: ['mikan', 'cloud'],
    unlockedRooms: ['sunroom', 'rainy'],
    unlockedFurniture: ['oak-desk', 'floor-lamp'],
    keepsakes: [
      { id: 'gift-1', itemId: 'paper-star', kind: 'gift', source: 'pomodoro', at: Date.now() },
      { id: 'gift-2', itemId: 'pressed-flower', kind: 'gift', source: 'class', at: Date.now() - 86400000 },
      { id: 'trash-1', itemId: 'pencil-shavings', kind: 'trash', source: 'pomodoro', at: Date.now() - 172800000 }
    ],
    completedSessions: 8,
    abandonedSessions: 1,
    activeClass: null,
    settledClasses: []
  }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('pomodoro:getState', () => ({
  phase: 'work',
  remaining: 1124,
  total: 1500,
  running: true,
  completed: 3
}))
ipcMain.handle('app:getVersion', () => '0.1.0')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
ipcMain.handle('pet-widget:sync', () => undefined)
ipcMain.handle('pet-widget:hide', () => undefined)
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('shell:openPath', () => '')
ipcMain.handle('dialog:openFiles', () => [])

app.whenReady().then(async () => {
  nativeTheme.themeSource = theme
  protocol.handle('studymedia', (request) => {
    const url = new URL(request.url)
    const path = url.searchParams.get('p')
    return path ? net.fetch(pathToFileURL(path).toString()) : new Response('missing path', { status: 400 })
  })
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: transparentWidget,
    backgroundColor: transparentWidget ? '#00000000' : theme === 'dark' ? '#201d29' : '#eef0f4',
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })

  const url = `file://${join(__dirname, '../out/renderer/index.html')}${route ? '#' + route : ''}`
  await win.loadURL(url)
  win.showInactive()
  await new Promise((r) => setTimeout(r, 1800))
  if (route === '/todo') {
    const memoTabActive = await win.webContents.executeJavaScript(`(async () => {
      const tab = document.querySelectorAll('.memo-tab')[2]
      if (!tab) return false
      tab.click()
      await new Promise((resolve) => setTimeout(resolve, 100))
      return tab.classList.contains('active')
    })()`)
    if (!memoTabActive) throw new Error('备忘录标签未激活')
    const attachmentReady = await win.webContents.executeJavaScript(`new Promise((resolve) => {
      const deadline = Date.now() + 2000
      const check = () => document.querySelector('.memo-attachments img') ? resolve(true) : Date.now() >= deadline ? resolve(false) : setTimeout(check, 40)
      check()
    })`)
    if (!attachmentReady) throw new Error('备忘录附件未渲染')
  }
  if (compactDesktopWidget) {
    await win.webContents.executeJavaScript(`new Promise((resolve) => {
      const deadline = Date.now() + 2000
      const check = () => document.querySelector('.desktop-widget-card') || Date.now() >= deadline ? resolve(true) : setTimeout(check, 40)
      check()
    })`)
  }
  await win.webContents.executeJavaScript(`Promise.all([...document.images].map((image) => image.complete ? true : new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }) })))`)
  await win.webContents.executeJavaScript(`Promise.all([...document.querySelectorAll('video')].map((video) => video.play().catch(() => undefined)))`)
  await new Promise((r) => setTimeout(r, 300))
  if (process.env.SHOT_DEBUG) {
    const metrics = await win.webContents.executeJavaScript(`(() => {
      const target = document.querySelector('.focus-space') || document.querySelector('.lock-layout') || document.querySelector('.pet-widget-root')
      if (!target) return { missing: true }
      const rect = target.getBoundingClientRect()
      const style = getComputedStyle(target)
      return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, display: style.display, opacity: style.opacity, visibility: style.visibility, scrollTop: document.querySelector('.view-scroll')?.scrollTop }
    })()`)
    console.log('metrics', metrics)
  }
  const img = await win.webContents.capturePage()
  win.hide()
  const name = `shot-${theme}${route ? '-' + route.replace(/\//g, '') : ''}.png`
  const output = process.env.SHOT_OUT || join(__dirname, '..', name)
  writeFileSync(output, img.toPNG())
  console.log('saved', output)
  app.quit()
})
