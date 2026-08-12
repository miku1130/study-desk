/**
 * 验证 IP 限流不被 X-Forwarded-For 伪造绕过。
 *
 * nginx 用的是 $proxy_add_x_forwarded_for，会把客户端发来的 XFF 原样保留在最左侧，
 * 所以如果服务端取最左侧，换个伪造值就能无限建房。这里用两个不同的伪造值建房，
 * 只要第二次被 HOST_LIMIT 拦下，就说明服务端认的是不可伪造的真实 IP。
 */
import { WebSocket } from 'ws'

const URL = process.env.SMOKE_URL ?? 'wss://study.lemon21.cn/ws'

function open(spoofedIp) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(URL, { headers: { 'X-Forwarded-For': spoofedIp } })
    const inbox = []
    const waiters = []
    socket.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      const hit = waiters.findIndex((w) => w.match(msg))
      if (hit >= 0) waiters.splice(hit, 1)[0].resolve(msg)
      else inbox.push(msg)
    })
    socket.on('error', reject)
    socket.on('open', () => {
      socket.send(JSON.stringify({ t: 'hello', v: 1, nickname: '限流探针', catId: 'mikan' }))
      resolve({
        send: (p) => socket.send(JSON.stringify(p)),
        close: () => socket.close(),
        wait: (match, timeout = 4000) => {
          const found = inbox.findIndex(match)
          if (found >= 0) return Promise.resolve(inbox.splice(found, 1)[0])
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error('等待超时')), timeout)
            waiters.push({ match, resolve: (m) => (clearTimeout(timer), res(m)) })
          })
        }
      })
    })
  })
}

const stamp = Date.now().toString(36).slice(-4)
const a = await open('1.2.3.4')
await a.wait((m) => m.t === 'welcome')
a.send({ t: 'create', name: `限流探针${stamp}`, goalMinutes: 30 })
const first = await a.wait((m) => m.t === 'joined' || m.t === 'error')

const b = await open('5.6.7.8')
await b.wait((m) => m.t === 'welcome')
b.send({ t: 'create', name: `限流探针${stamp}b`, goalMinutes: 30 })
const second = await b.wait((m) => m.t === 'joined' || m.t === 'error')

console.log('第一次建房：', first.t === 'joined' ? '成功' : `被拒(${first.code})`)
console.log('换个伪造 IP 再建：', second.t === 'joined' ? '成功' : `被拒(${second.code})`)

const blocked = second.t === 'error' && (second.code === 'HOST_LIMIT' || second.code === 'RATE_LIMITED')
console.log(blocked ? 'PASS  伪造 XFF 无法绕过限流' : 'FAIL  限流仍然信任了伪造的 XFF')

a.close()
b.close()
// 房主一走房间即销毁，不会在大厅里留下探针房间
await new Promise((r) => setTimeout(r, 500))
process.exit(blocked ? 0 : 1)
