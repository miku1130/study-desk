// 临时验证脚本：加载构建产物并截图（用于阶段性预览，非应用运行时代码）
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { join } = require('path')
const { writeFileSync } = require('fs')

const theme = process.env.SHOT_THEME === 'dark' ? 'dark' : 'light'
const route = process.env.SHOT_ROUTE || ''

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
      { id: '4', text: '整理错题本', done: true, pomodoros: 3, createdAt: Date.now(), priority: 0, due: '', completedAt: Date.now() }
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

app.whenReady().then(async () => {
  nativeTheme.themeSource = theme
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    show: false,
    frame: false,
    backgroundColor: theme === 'dark' ? '#201d29' : '#eef0f4',
    webPreferences: {
      preload: join(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  const url = `file://${join(__dirname, '../out/renderer/index.html')}${route ? '#' + route : ''}`
  await win.loadURL(url)
  await new Promise((r) => setTimeout(r, 1700))
  const img = await win.webContents.capturePage()
  const name = `shot-${theme}${route ? '-' + route.replace(/\//g, '') : ''}.png`
  writeFileSync(join(__dirname, '..', name), img.toPNG())
  console.log('saved', name)
  app.quit()
})
