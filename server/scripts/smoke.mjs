/**
 * 端到端冒烟：起真实 WebSocket 连接，跑一遍建房 / 随机加入 / 广播 / 房主顺延。
 * 用法：先 npm start，再 node scripts/smoke.mjs
 */
import { WebSocket } from 'ws'

const URL = process.env.SMOKE_URL ?? 'ws://127.0.0.1:3100/ws'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}

function connect(nickname) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(URL)
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
      socket.send(JSON.stringify({ t: 'hello', v: 1, nickname, catId: 'mikan' }))
      resolve({
        socket,
        send: (payload) => socket.send(JSON.stringify(payload)),
        close: () => socket.close(),
        wait: (match, timeout = 3000) => {
          const found = inbox.findIndex(match)
          if (found >= 0) return Promise.resolve(inbox.splice(found, 1)[0])
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`等待消息超时：${match}`)), timeout)
            waiters.push({
              match,
              resolve: (m) => {
                clearTimeout(timer)
                res(m)
              }
            })
          })
        }
      })
    })
  })
}

async function main() {
  const host = await connect('房主')
  await host.wait((m) => m.t === 'welcome')
  check('握手返回 welcome', true)

  host.send({ t: 'create', name: '冒烟自习室', goalMinutes: 60 })
  const joined = await host.wait((m) => m.t === 'joined')
  check('建房成功', Boolean(joined.roomId), joined.roomId)

  const hostRoster = await host.wait((m) => m.t === 'roster')
  check('房主收到 roster', hostRoster.members.length === 1)
  check('房主标记正确', hostRoster.room.hostId === hostRoster.members[0].id)

  const guest = await connect('同学')
  await guest.wait((m) => m.t === 'welcome')
  guest.send({ t: 'quickJoin' })
  const guestJoined = await guest.wait((m) => m.t === 'joined')
  check('随机加入进了已有房间而不是新建', guestJoined.created === false)
  check('随机加入落在同一房间', guestJoined.roomId === joined.roomId)

  const rosterAfterJoin = await host.wait((m) => m.t === 'roster' && m.members.length === 2)
  check('房主侧收到成员加入广播', rosterAfterJoin.members.length === 2)
  check(
    '座位按进房顺序',
    rosterAfterJoin.members[0].nickname === '房主' && rosterAfterJoin.members[1].nickname === '同学'
  )

  // 大厅
  const watcher = await connect('围观')
  await watcher.wait((m) => m.t === 'welcome')
  watcher.send({ t: 'lobby' })
  const lobby = await watcher.wait((m) => m.t === 'lobby')
  check('大厅能看到房间', lobby.rooms.length === 1, `人数=${lobby.rooms[0]?.memberCount}`)

  // 加油
  host.send({ t: 'cheer', cheerId: 'fighting', toId: '' })
  const cheered = await guest.wait((m) => m.t === 'cheered')
  check('加油被转发给房内成员', cheered.cheerId === 'fighting')

  host.send({ t: 'cheer', cheerId: 'buy-now-http://x.com', toId: '' })
  const rejected = await host.wait((m) => m.t === 'error')
  check('白名单外的加油被拒', rejected.code === 'INVALID_NAME')

  // 房主顺延
  host.close()
  const hostNotice = await guest.wait((m) => m.t === 'notice' && m.kind === 'host', 5000)
  check('房主离开后广播顺延通知', hostNotice.text.includes('新房主'), hostNotice.text)

  const rosterAfterLeave = await guest.wait((m) => m.t === 'roster' && m.members.length === 1, 5000)
  check('顺延后房主指向剩余成员', rosterAfterLeave.room.hostId === rosterAfterLeave.members[0].id)
  check('房间名与目标保留', rosterAfterLeave.room.name === '冒烟自习室' && rosterAfterLeave.room.goalMinutes === 60)

  // 空房销毁：服务端应主动把空列表推给正在看大厅的人
  guest.close()
  const lobbyAfter = await watcher.wait((m) => m.t === 'lobby' && m.rooms.length === 0, 5000)
  check('最后一人离开后房间从大厅消失', lobbyAfter.rooms.length === 0)

  watcher.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('冒烟失败：', err.message)
  process.exit(1)
})
