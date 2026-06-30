// 为 README 批量生成界面截图到 docs/screenshots/
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { join } = require('path')
const { writeFileSync, mkdirSync, existsSync } = require('fs')
const { pathToFileURL } = require('url')

function dkey(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

let currentTheme = 'light'

const sample = {
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
      { id: 'a', day: 1, periodId: 'p1', name: '高等数学', teacher: '王', location: 'A101', color: '#0a84ff' },
      { id: 'b', day: 1, periodId: 'p2', name: '大学英语', teacher: '李', location: 'B202', color: '#30d158' },
      { id: 'c', day: 2, periodId: 'p3', name: '线性代数', teacher: '张', location: 'A305', color: '#ff9f0a' },
      { id: 'd', day: 3, periodId: 'p1', name: '数据结构', teacher: '陈', location: 'C401', color: '#bf5af2' },
      { id: 'e', day: 4, periodId: 'p5', name: '大学物理', teacher: '赵', location: 'D102', color: '#ff453a' },
      { id: 'f', day: 5, periodId: 'p2', name: '程序设计', teacher: '刘', location: 'C402', color: '#5ac8fa' }
    ]
  },
  todos: {
    items: [
      { id: '1', text: '完成高数第三章习题', done: false, pomodoros: 2, createdAt: Date.now(), priority: 3, due: dkey(0), note: '', repeat: 'none' },
      { id: '2', text: '背 30 个英语单词', done: false, pomodoros: 0, createdAt: Date.now(), priority: 2, due: dkey(0), note: '重点', repeat: 'daily' },
      { id: '3', text: '复习数据结构', done: false, pomodoros: 0, createdAt: Date.now(), priority: 1, due: dkey(-1), note: '', repeat: 'none' },
      { id: '4', text: '整理错题本', done: true, pomodoros: 3, createdAt: Date.now(), priority: 0, due: '', note: '', repeat: 'none', completedAt: Date.now() }
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
      { id: 'c1', title: '期末考试', date: dkey(-12), color: '#ff453a', bg: '' },
      { id: 'c2', title: '英语六级', date: dkey(-30), color: '#0a84ff', bg: '' },
      { id: 'c3', title: '寒假', date: dkey(-45), color: '#30d158', bg: '' }
    ]
  }
}

function settingsFor() {
  return {
    theme: currentTheme,
    accent: '#0a84ff',
    appBg: '',
    appBgOpacity: 0.18,
    bell: { enabled: true, onSound: '', offSound: '', volume: 0.8 },
    pomodoro: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4, autoStart: false, lockscreen: true, wallpaper: '', sound: '', volume: 0.8 },
    water: { enabled: true, intervalMin: 60, goalCups: 8 },
    health: { sitEnabled: true, sitIntervalMin: 45, eyeEnabled: true, eyeIntervalMin: 30 },
    autostart: false,
    widget: false,
    hotkeys: { toggleTimer: 'CommandOrControl+Alt+P', toggleWindow: 'CommandOrControl+Alt+S' }
  }
}

ipcMain.handle('store:get', (_e, name) => (name === 'settings' ? settingsFor() : sample[name] ?? {}))
ipcMain.handle('store:set', () => true)
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1124, total: 1500, running: true, completed: 3 }))
ipcMain.handle('app:getVersion', () => '0.1.0')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)

app.on('window-all-closed', () => undefined)

const shots = [
  { route: '', theme: 'light', name: 'dashboard' },
  { route: '', theme: 'dark', name: 'dashboard-dark' },
  { route: '/timetable', theme: 'light', name: 'timetable' },
  { route: '/pomodoro', theme: 'dark', name: 'pomodoro' },
  { route: '/bookshelf', theme: 'light', name: 'bookshelf' },
  { route: '/countdown', theme: 'light', name: 'countdown' },
  { route: '/todo', theme: 'light', name: 'todo' },
  { route: '/music', theme: 'dark', name: 'music' },
  { route: '/stats', theme: 'light', name: 'stats' },
  { route: '/settings', theme: 'light', name: 'settings' }
]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const dir = join(__dirname, '..', 'docs', 'screenshots')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const base = pathToFileURL(join(__dirname, '../out/renderer/index.html')).toString()

  for (const s of shots) {
    currentTheme = s.theme
    nativeTheme.themeSource = s.theme
    const win = new BrowserWindow({
      width: 1180,
      height: 760,
      show: false,
      backgroundColor: s.theme === 'dark' ? '#201d29' : '#eef0f4',
      webPreferences: {
        preload: join(__dirname, '../out/preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })
    await win.loadURL(s.route ? `${base}#${s.route}` : base)
    await wait(1500)
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${s.name}.png`), img.toPNG())
    win.destroy()
    console.log('saved', s.name)
  }
  app.exit(0)
})
