// 生成应用图标 build/icon.png（256x256，渐变方 + 白色时钟），供 electron-builder 使用。
const { app, BrowserWindow } = require('electron')
const { join } = require('path')
const { writeFileSync, mkdirSync, existsSync } = require('fs')

const html =
  'data:text/html,' +
  encodeURIComponent(`<!doctype html><meta charset=utf-8>
<style>html,body{margin:0;padding:0;overflow:hidden}canvas{display:block}</style><body>
<canvas id=c width=256 height=256></canvas>
<script>
const x=document.getElementById('c').getContext('2d');
const g=x.createLinearGradient(0,0,256,256);
g.addColorStop(0,'#0a84ff');g.addColorStop(1,'#5ac8fa');
x.fillStyle=g;x.fillRect(0,0,256,256);
x.strokeStyle='#ffffff';x.lineWidth=18;x.lineCap='round';
x.beginPath();x.arc(128,132,66,0,Math.PI*2);x.stroke();
x.beginPath();x.moveTo(128,132);x.lineTo(128,86);x.moveTo(128,132);x.lineTo(164,146);x.stroke();
</script></body>`)

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    useContentSize: true,
    frame: false,
    show: false
  })
  await win.loadURL(html)
  await new Promise((r) => setTimeout(r, 500))
  const img = await win.webContents.capturePage()
  const dir = join(__dirname, '..', 'build')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'icon.png'), img.toPNG())
  console.log('icon saved')
  app.exit(0)
})
