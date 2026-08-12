// 最小窗口高度下验证仪表盘是否出现纵向滚动
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron')
const { join } = require('path')
const { pathToFileURL } = require('url')

function dkey(offset) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const sample = {
  timetable: {
    periods: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
      id: 'p' + i,
      name: '第 ' + i + ' 节',
      start: ['08:00', '08:55', '10:00', '10:55', '14:00', '14:55', '16:00', '19:00'][i - 1],
      end: ['08:45', '09:40', '10:45', '11:40', '14:45', '15:40', '16:45', '19:45'][i - 1]
    })),
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
      { id: '3', text: '复习数据结构第五章', done: false, pomodoros: 0, createdAt: Date.now(), priority: 1 }
    ]
  },
  stats: { days: { [dkey(0)]: { pomodoros: 3, focusMinutes: 75 } } },
  music: { tracks: [], volume: 0.6, loop: 'all' },
  water: { days: { [dkey(0)]: 4 } },
  countdowns: { items: [{ id: 'c1', title: '期末考试', date: dkey(-12), color: '#ff453a', bg: '' }] },
  garden: { coins: 10, trees: [], unlocked: ['evergreen'], current: 'evergreen', streak: 3, lastRewardDate: dkey(0), achievements: [], decors: [], decorOwned: {}, quests: [], questsDate: '', questsCompletedTotal: 0 }
}

ipcMain.handle('store:get', (_e, name) => sample[name] ?? {})
ipcMain.handle('store:set', () => true)
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1130, total: 1500, running: true, completed: 3 }))
ipcMain.handle('app:getVersion', () => '0.2.1')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
app.on('window-all-closed', () => undefined)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const base = pathToFileURL(join(__dirname, '../out/renderer/index.html')).toString()
  nativeTheme.themeSource = 'light'
  for (const h of [620, 680, 760]) {
    const win = new BrowserWindow({
      width: 940,
      height: h,
      show: false,
      webPreferences: { preload: join(__dirname, '../out/preload/index.js'), sandbox: false, contextIsolation: true }
    })
    await win.loadURL(base)
    await wait(1200)
    const metrics = await win.webContents.executeJavaScript(`(() => {
      const vs = document.querySelector('.view-scroll')
      return { scrollH: vs.scrollHeight, clientH: vs.clientHeight, overflow: vs.scrollHeight - vs.clientHeight }
    })()`)
    console.log('height', h, JSON.stringify(metrics))
    win.destroy()
  }
  app.exit(0)
})
