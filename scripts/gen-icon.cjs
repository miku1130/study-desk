// 生成透明底品牌应用图标 build/icon.png（256×256），供 electron-builder / 托盘使用。
const { app, BrowserWindow } = require('electron')
const { join } = require('path')
const { writeFileSync, mkdirSync, existsSync } = require('fs')

const html =
  'data:text/html,' +
  encodeURIComponent(`<!doctype html><meta charset=utf-8>
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}canvas{display:block}</style>
<canvas id="mark" width="256" height="256"></canvas>
<script>
const x=document.getElementById('mark').getContext('2d');
x.clearRect(0,0,256,256);
x.lineCap='round';x.lineJoin='round';

// 专注轨道
x.strokeStyle='#f2a477';x.lineWidth=8;
x.beginPath();x.arc(128,128,98,Math.PI*.94,Math.PI*2.1);x.stroke();

// 展开的书
const left=[[52,100],[76,88],[102,89],[126,101],[126,190],[102,178],[76,177],[52,189]];
const right=[[204,100],[180,88],[154,89],[130,101],[130,190],[154,178],[180,177],[204,189]];
function page(points,fill){
  x.beginPath();x.moveTo(points[0][0],points[0][1]);
  points.slice(1).forEach(p=>x.lineTo(p[0],p[1]));x.closePath();
  x.fillStyle=fill;x.fill();x.strokeStyle='#4fae98';x.lineWidth=9;x.stroke();
}
page(left,'#e2ede9');page(right,'#cfe2dc');
x.strokeStyle='rgba(79,174,152,.78)';x.lineWidth=6;
x.beginPath();x.moveTo(128,102);x.lineTo(128,190);x.stroke();

// 书页细节
x.strokeStyle='rgba(79,174,152,.42)';x.lineWidth=4;
[[72,122,88,116,103,117,114,123],[184,122,168,116,153,117,142,123],
 [72,144,88,138,103,139,114,145],[184,144,168,138,153,139,142,145]]
 .forEach(p=>{x.beginPath();x.moveTo(p[0],p[1]);x.bezierCurveTo(...p.slice(2));x.stroke()});

// 轨道上的专注节点
x.fillStyle='#fff';x.strokeStyle='#f2a477';x.lineWidth=6;
x.beginPath();x.arc(203,65,17,0,Math.PI*2);x.fill();x.stroke();
x.fillStyle='#f2a477';x.beginPath();x.arc(203,65,6,0,Math.PI*2);x.fill();
</script>`)

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false
  })
  await win.loadURL(html)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await win.webContents.capturePage()
  const dir = join(__dirname, '..', 'build')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'icon.png'), image.toPNG())
  win.destroy()
  console.log('wrote build/icon.png')
  app.exit(0)
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
