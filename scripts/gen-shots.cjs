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
      { id: 'a', day: 1, periodId: 'p1', name: '高等数学', teacher: '王', location: 'A101', color: '#77b5e8' },
      { id: 'b', day: 1, periodId: 'p2', name: '大学英语', teacher: '李', location: 'B202', color: '#30d158' },
      { id: 'c', day: 2, periodId: 'p3', name: '线性代数', teacher: '张', location: 'A305', color: '#ff9f0a' },
      { id: 'd', day: 3, periodId: 'p1', name: '数据结构', teacher: '陈', location: 'C401', color: '#bf5af2' },
      { id: 'e', day: 4, periodId: 'p5', name: '大学物理', teacher: '赵', location: 'D102', color: '#ff453a' },
      { id: 'f', day: 5, periodId: 'p2', name: '程序设计', teacher: '刘', location: 'C402', color: '#5ac8fa' }
    ]
  },
  todos: {
    activeId: '1',
    items: [
      { id: '1', text: '完成高数第三章习题', done: false, pomodoros: 2, createdAt: Date.now(), priority: 3, due: dkey(0), note: '重点是泰勒展开', repeat: 'none', pinned: true, estimatePomodoros: 4, tags: ['数学'], subtasks: [{ id: 's1', text: '例题 1-10', done: true }, { id: 's2', text: '习题 11-24', done: false }] },
      { id: '2', text: '背 30 个英语单词', done: false, pomodoros: 0, createdAt: Date.now(), priority: 2, due: dkey(0), note: '', repeat: 'daily', reminderAt: `${dkey(-1)}T20:00`, tags: ['英语'] },
      { id: '3', text: '给张老师发邮件确认答辩时间', done: false, pomodoros: 0, createdAt: Date.now(), priority: 1, due: dkey(-1), note: '', repeat: 'none', kind: 'memo' },
      { id: '5', text: '把专注花园做成手机壁纸', done: false, pomodoros: 0, createdAt: Date.now(), priority: 0, due: '', note: '', repeat: 'none', kind: 'idea', tags: ['灵感'] },
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
      { id: 'b1', name: '高等数学（同济第七版）.pdf', path: 'C:/fake/math.pdf', category: '数学', addedAt: Date.now(), status: 'reading', totalPages: 460, currentPage: 285, rating: 5, favorite: true, lastOpenedAt: Date.now() - 3600e3, openCount: 26, tags: ['考研'], notes: [{ id: 'n1', text: '泰勒公式的余项形式要记牢：佩亚诺余项适合求极限，拉格朗日余项适合估计误差。', page: 182, createdAt: Date.now() - 86400e3 }, { id: 'n2', text: '第 9 章多元函数极值，条件极值用拉格朗日乘数法。', page: 236, createdAt: Date.now() - 43200e3 }], readLog: [{ id: 'r1', at: Date.now() - 86400e3, minutes: 45 }, { id: 'r2', at: Date.now() - 3600e3, minutes: 30 }] },
      { id: 'b2', name: '新概念英语 3.docx', path: 'C:/fake/eng.docx', category: '英语', addedAt: Date.now(), status: 'reading', progress: 42, rating: 4, lastOpenedAt: Date.now() - 7200e3, openCount: 12 },
      { id: 'b3', name: '算法导论.epub', path: 'C:/fake/algo.epub', category: '计算机', addedAt: Date.now(), status: 'unread', favorite: true },
      { id: 'b4', name: '考研政治大纲.pdf', path: 'C:/fake/politics.pdf', category: '政治', addedAt: Date.now(), status: 'finished', progress: 100, rating: 3 },
      { id: 'b5', name: '英语真题.pptx', path: 'C:/fake/exam.pptx', category: '英语', addedAt: Date.now(), status: 'reference' }
    ]
  },
  garden: (() => {
    const species = ['evergreen', 'pine', 'sakura', 'maple', 'palm', 'xmas', 'evergreen', 'sakura']
    const trees = []
    for (let i = 0; i < 22; i++) {
      const growth = i < 12 ? 3 : i < 19 ? 1 : 0
      trees.push({
        id: 't' + i,
        species: species[i % species.length],
        at: Date.now() - (22 - i) * 5400e3,
        focusMinutes: 25,
        growth,
        golden: i === 7,
        mood: i === 7 ? 'glow' : growth >= 3 ? 'mature' : growth > 0 ? 'growing' : 'sprout',
        plot: i
      })
    }
    return {
      coins: 86,
      trees,
      unlocked: ['evergreen', 'pine', 'sakura', 'maple', 'palm', 'xmas'],
      current: 'sakura',
      streak: 6,
      lastRewardDate: dkey(0),
      achievements: [
        { id: 'first-seed', unlockedAt: Date.now() - 20 * 86400e3 },
        { id: 'ten-trees', unlockedAt: Date.now() - 6 * 86400e3 },
        { id: 'one-day-streak', unlockedAt: Date.now() - 3600e3 },
        { id: 'golden-tree', unlockedAt: Date.now() - 4 * 86400e3 },
        { id: 'collector', unlockedAt: Date.now() - 2 * 86400e3 }
      ],
      decors: [
        { id: 'd1', kind: 'lantern', plot: 25 },
        { id: 'd2', kind: 'pond', plot: 30 },
        { id: 'd3', kind: 'bench', plot: 33 },
        { id: 'd4', kind: 'fountain', plot: 36 },
        { id: 'd5', kind: 'tent', plot: 41 },
        { id: 'd6', kind: 'windchime', plot: 44 }
      ],
      decorOwned: { windchime: 1 },
      quests: [],
      questsDate: '',
      questsCompletedTotal: 12
    }
  })(),
  countdowns: {
    items: [
      { id: 'c1', title: '期末考试', date: dkey(-12), color: '#ff453a', bg: '' },
      { id: 'c2', title: '英语六级', date: dkey(-30), color: '#77b5e8', bg: '' },
      { id: 'c3', title: '寒假', date: dkey(-45), color: '#67bfa4', bg: '' }
    ]
  },
  desktopWidgets: {
    items: [
      {
        id: 'w1', kind: 'countdown', sourceId: 'c1', title: '期末考试', enabled: true,
        launchOnStartup: true, locked: false, alwaysOnTop: true, size: 'medium', background: '',
        backgroundColor: '#24312c', overlayOpacity: 0.42, surfaceOpacity: 0.94,
        font: 'system', fontColor: '#ffffff', accentColor: '#7ed4b5'
      },
      {
        id: 'w2', kind: 'memo', sourceId: '5', title: '灵感便签', enabled: true,
        launchOnStartup: false, locked: true, alwaysOnTop: true, size: 'small', background: '',
        backgroundColor: '#3a3428', overlayOpacity: 0.38, surfaceOpacity: 0.96,
        font: 'handwriting', fontColor: '#fffdf7', accentColor: '#e4bd68'
      }
    ]
  }
}

function settingsFor() {
  return {
    theme: currentTheme,
    accent: '#4fae98',
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
ipcMain.handle('fs:exists', () => true)
ipcMain.handle('online:search', () => [])
ipcMain.handle('media:download', () => '')
ipcMain.handle('pomodoro:getState', () => ({ phase: 'work', remaining: 1124, total: 1500, running: true, completed: 3 }))
ipcMain.handle('app:getVersion', () => '0.3.2')
ipcMain.handle('autostart:get', () => false)
ipcMain.handle('tray:setIcon', () => undefined)
ipcMain.handle('window:minimize', () => undefined)
ipcMain.handle('window:maximize', () => false)
ipcMain.handle('window:close', () => undefined)
ipcMain.handle('window:isMaximized', () => false)
ipcMain.handle('desktop-widget:close', () => true)
ipcMain.handle('desktop-widget:set-pointer-interactive', () => true)

const roomMember = (id, nickname, catId, over) => ({
  id, nickname, catId, host: false, phase: 'work', running: true, remaining: 1124,
  todayFocusMinutes: 75, todayPomodoros: 3, todayRoomFocusSeconds: 2760,
  roomFocusSeconds: 1560, roomPomodoros: 2,
  cheers: 4, joinedAt: Date.now() - 3600000, online: true, ...over
})
ipcMain.handle('study-room:get-state', () => ({
  status: 'joined',
  selfId: 'm2',
  nickname: '小桌',
  room: {
    roomId: 'r1', name: '三楼晚自习', code: 'C0M84-0AVQF', hostNickname: '班长',
    memberCount: 4, maxMembers: 24, goalMinutes: 180, focusMinutes: 122,
    createdAt: Date.now() - 5400000
  },
  members: [
    roomMember('m1', '班长', 'mikan', { host: true, roomFocusSeconds: 2280, roomPomodoros: 3, cheers: 7 }),
    roomMember('m2', '小桌', 'sesame', { roomFocusSeconds: 1980, cheers: 5 }),
    roomMember('m3', '同桌阿七', 'cloud', { roomFocusSeconds: 1620, roomPomodoros: 2, cheers: 3 }),
    roomMember('m4', '晚风', 'mikan', { phase: 'short', running: true, remaining: 214, roomFocusSeconds: 900, roomPomodoros: 1, cheers: 2 })
  ],
  error: ''
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

app.on('window-all-closed', () => undefined)

const shots = [
  { route: '', theme: 'light', name: 'dashboard' },
  { route: '', theme: 'dark', name: 'dashboard-dark' },
  { route: '/timetable', theme: 'light', name: 'timetable' },
  { route: '/pomodoro', theme: 'dark', name: 'pomodoro' },
  { route: '/garden', theme: 'light', name: 'garden', scrollTo: '.plot-grid' },
  { route: '/bookshelf', theme: 'light', name: 'bookshelf' },
  { route: '/countdown', theme: 'light', name: 'countdown' },
  { route: '/todo', theme: 'light', name: 'todo' },
  { route: '/music', theme: 'dark', name: 'music' },
  { route: '/study-room', theme: 'light', name: 'study-room', height: 1000 },
  { route: '/stats', theme: 'light', name: 'stats' },
  { route: '/settings', theme: 'light', name: 'settings' },
  { route: '/widgets', theme: 'light', name: 'desktop-widgets' },
  { route: '/desktop-widget/w1', theme: 'dark', name: 'desktop-widget', width: 340, height: 218 }
].filter((shot) => !process.env.ONLY_SHOTS || process.env.ONLY_SHOTS.split(',').includes(shot.name))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const dir = join(__dirname, '..', 'docs', 'screenshots')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const base = pathToFileURL(join(__dirname, '../out/renderer/index.html')).toString()

  for (const s of shots) {
    currentTheme = s.theme
    nativeTheme.themeSource = s.theme
    // 必须可见窗口：隐藏窗口的合成器不光栅化滚动内容层，capturePage 会得到空白内容区
    const win = new BrowserWindow({
      width: s.width ?? 1180,
      height: s.height ?? 760,
      show: process.env.OFFSCREEN_SHOTS !== '1',
      x: 40,
      y: 40,
      transparent: s.name === 'desktop-widget',
      frame: s.name !== 'desktop-widget',
      backgroundColor: s.name === 'desktop-widget' ? '#00000000' : s.theme === 'dark' ? '#202925' : '#f5f5ef',
      webPreferences: {
        preload: join(__dirname, '../out/preload/index.js'),
        offscreen: process.env.OFFSCREEN_SHOTS === '1',
        sandbox: false,
        contextIsolation: true
      }
    })
    await win.loadURL(s.route ? `${base}#${s.route}` : base)
    await wait(1500)
    if (s.scrollTo) {
      await win.webContents.executeJavaScript(
        `document.querySelector('${s.scrollTo}')?.scrollIntoView({ block: 'center' })`
      )
      await wait(400)
    }
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${s.name}.png`), img.toPNG())
    win.destroy()
    console.log('saved', s.name)
  }
  app.exit(0)
})
