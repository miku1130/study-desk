// 生成竖屏（1080x1920）抖音推广视频：真实软件截图 + 中文字幕 + 淡入淡出，静音便于配 BGM。
// 依赖系统已安装 ffmpeg，字体使用 Windows 自带微软雅黑。
const { execFileSync } = require('child_process')
const { join } = require('path')
const { existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync, statSync } = require('fs')

const root = join(__dirname, '..')
const shotsDir = join(root, 'docs', 'screenshots')
const outDir = join(root, 'docs', 'promo')
const tmp = join(outDir, 'tmp')
const out = join(outDir, 'study-desk-douyin.mp4')

const W = 1080
const H = 1920
const FPS = 30
const DUR = 3
// 微软雅黑；复制到无盘符冒号的相对路径，规避 ffmpeg drawtext 对 fontfile+textfile 同现时的转义解析 bug
const SYS_FONT = 'C:/Windows/Fonts/msyh.ttc'
const FONT = 'docs/promo/tmp/font.ttc'
const ACCENT = '0x38b0ff'

const scenes = [
  { card: true, title: '学习桌面\nStudyDesk', cap: '一个桌面，管好整个学习日常' },
  { img: 'dashboard.png', title: '一屏总览', cap: '课表 · 专注 · 待办 · 喝水' },
  { img: 'timetable.png', title: '智能课表', cap: '到点自动响铃 · 上课不迟到' },
  { img: 'pomodoro.png', title: '番茄钟 + 锁屏专注', cap: '学不进去也能进入状态' },
  { img: 'music.png', title: '背景轻音乐', cap: '在线畅听 · 一键导入歌单' },
  { img: 'todo.png', title: '待办清单', cap: '今天 / 计划一目了然 · 倒数日提醒' },
  { img: 'stats.png', title: '专注统计', cap: '看得见的坚持 · 完成番茄还能种树' },
  { card: true, title: '免费 · 开源 · Windows', cap: 'GitHub 搜 study-desk' }
]

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    cwd: root,
    stdio: 'inherit'
  })
}

function relTxt(name, content) {
  const p = join(tmp, name)
  writeFileSync(p, content, 'utf-8')
  return `docs/promo/tmp/${name}`.replace(/\\/g, '/')
}

function drawtext(txtRel, size, color, y) {
  return `drawtext=fontfile=${FONT}:textfile=${txtRel}:fontcolor=${color}:fontsize=${size}:x=(w-text_w)/2:y=${y}:line_spacing=14:shadowcolor=black@0.5:shadowx=2:shadowy=2`
}

function buildScene(i, s) {
  const scenePath = join(tmp, `scene${i}.mp4`)
  const titleRel = relTxt(`s${i}t.txt`, s.title)
  const capRel = relTxt(`s${i}c.txt`, s.cap)
  const fadeOut = (DUR - 0.4).toFixed(2)

  if (s.card) {
    const filter =
      `[0:v]${drawtext(titleRel, 92, 'white', 720)},` +
      `${drawtext(capRel, 50, ACCENT, 1080)},` +
      `format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOut}:d=0.4[v]`
    ff([
      '-f', 'lavfi', '-t', String(DUR), '-i', `color=c=0x0b0b16:s=${W}x${H}:r=${FPS}`,
      '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', scenePath
    ])
    return scenePath
  }

  const img = join(shotsDir, s.img)
  const filter =
    `[1:v]scale=960:-2:force_original_aspect_ratio=decrease,setsar=1[s];` +
    `[0:v][s]overlay=(W-w)/2:(H-h)/2[ov];` +
    `[ov]${drawtext(titleRel, 60, 'white', 210)}[t];` +
    `[t]${drawtext(capRel, 46, ACCENT, 1560)},` +
    `format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOut}:d=0.4[v]`
  ff([
    '-f', 'lavfi', '-t', String(DUR), '-i', `color=c=0x0b0b16:s=${W}x${H}:r=${FPS}`,
    '-loop', '1', '-t', String(DUR), '-i', img,
    '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', scenePath
  ])
  return scenePath
}

function main() {
  if (rmSync) {
    try { rmSync(tmp, { recursive: true, force: true }) } catch { /* noop */ }
  }
  mkdirSync(tmp, { recursive: true })
  copyFileSync(SYS_FONT, join(tmp, 'font.ttc'))

  const missing = scenes.filter((s) => s.img && !existsSync(join(shotsDir, s.img)))
  if (missing.length) {
    console.error('缺少截图：', missing.map((m) => m.img).join(', '))
    process.exit(1)
  }

  const files = []
  scenes.forEach((s, i) => {
    console.log(`渲染分镜 ${i + 1}/${scenes.length} ...`)
    files.push(buildScene(i, s))
  })

  const listPath = join(tmp, 'list.txt')
  writeFileSync(listPath, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'), 'utf-8')

  const silent = join(tmp, 'concat.mp4')
  ff(['-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silent])

  // 加静音音轨，兼容各平台上传
  ff([
    '-i', silent,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest', '-c:v', 'copy', '-c:a', 'aac', out
  ])

  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* noop */ }

  const kb = Math.round(statSync(out).size / 1024)
  console.log(`\n完成：${out}  (${kb} KB)`)
  console.log('分辨率 1080x1920 · 时长约 ' + scenes.length * DUR + 's · 静音（发布时配 BGM）')
}

main()
