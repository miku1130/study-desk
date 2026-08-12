// 临时调试：验证仪表盘在默认窗口尺寸下无纵向滚动
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { join } = require('path')
const { writeFileSync } = require('fs')
const { pathToFileURL } = require('url')

function dkey(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const sample = {
  timetable: {
    periods: [
      { id: 'p1', name: '第 1 节', start: '08:00', end: '08:45' },
      { id: 'p2', name: '第 2 节', start: '08:55', end: '09:40' },
      { id: 'p3', name: '第 3 节', start: '10:00', end: '10:45' },
      { id: 'p4', name: '第 4 节', start: '10:55', end: '11:40' },
      { id: 'p5', name: '第 5 节', start: '14:00', end: '14:45' },
      { id: 'p6', name: '第 6 节', start: '14:55', end: '15:40' },
      { id: 'p7', name: '第 7 节', start: '16:00', end: '16:45' },
      { id: 'p8', name: '第 8 节', start: '19:00', end: '19:45' }
    ],
    lessons: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
      id: 'l' + i,
      day: new Date().getDay() === 0 ? 7 : new Date().getDay(),
      periodId: 'p' + i,
      name: ['高等数学', '大学英语', '线性代数', '数据结构', '大学物理', '程序设计', '体育', '晚自习'][i - 1],
      teacher: '',
      location: 'A10' + i,
      color: ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff453a', '#5ac8fa', '#64d2ff', '#ff375f'][i - 1]
    }))
  },
  todos: {
    items: [
      { id: '1', text: '完成高数第三章习题并整理错题', done: false, pomodoros: 2, createdAt: Date.now(), priority: 3, due: dkey(0), pinned: true },
      { id: '2', text: '背 30 个英语单词', done: false, pomodoros: 0, createdAt: Date.now(), priority: 2, due: dkey(0) },
      { id: '3', text: '复习数据结构第五章', done: false, pomodoros: 0, createdAt: Date.now(), priority: 1 },
      { id: '4', text: '写周报', done: false, pomodoros: 0, createdAt: Date.now(), priority: 0 }
    ]
  },
  stats: { days: { [dkey(0)]: { pomodoros: 3, focusMinutes: 75 } } },
  music: { tracks: [{ id: 'm1', name: '钢琴轻音乐', path: 'C:/f/p.mp3' }], volume: 0.6, loop: 'all' },
  water: { days: { [dkey(0)]: 4 } },
  countdowns: { items: [{ id: 'c1', title: '期末考试', date: dkey(-12), color: '#ff453a', bg: '' }] },
  garden: { coins: 10, trees: [], unlocked: ['evergreen'], current: 'evergreen', streak: 3, lastRewardDate: dkey(0), achievements: [], decors: [], decorOwned: {}, quests: [], questsDate: '', questsCompletedTotal: 0 }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1130, total: 1500, running: true, completed: 3 }))
ipcMain.handle('app:getVersion', () => '0.3.0')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
app.on('window-all-closed', () => undefined)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const base = pathToFileURL(join(__dirname, '../out/renderer/index.html')).toString()
  nativeTheme.themeSource = 'light'
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    x: 20,
    y: 20,
    webPreferences: { preload: join(__dirname, '../out/preload/index.js'), sandbox: false, contextIsolation: true }
  })
  await win.loadURL(base)
  await wait(1500)
  const metrics = await win.webContents.executeJavaScript(`(() => {
    const vs = document.querySelector('.view-scroll')
    return JSON.stringify({ scrollH: vs.scrollHeight, clientH: vs.clientHeight, overflow: vs.scrollHeight - vs.clientHeight })
  })()`)
  console.log('SCROLL METRICS:', metrics)
  const img = await win.webContents.capturePage()
  writeFileSync(join(__dirname, '..', 'dbg-dash.png'), img.toPNG())
  app.exit(0)
})
