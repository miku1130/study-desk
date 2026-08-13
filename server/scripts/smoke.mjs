/**
 * 端到端冒烟：起真实 WebSocket 连接，跑一遍完整链路。
 *
 * 重点验证「加入自习室」与「进入房间」是两件事：
 * 退出房间之后仍然是成员，只有显式退出自习室才解除关系。
 *
 * 用法：先 npm start，再 node scripts/smoke.mjs
 */
import { WebSocket } from 'ws'

const URL = process.env.SMOKE_URL ?? 'ws://127.0.0.1:3100/ws'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
}

function connect(nickname, deviceId) {
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
      socket.send(JSON.stringify({ t: 'hello', v: 1, nickname, catId: 'mikan', deviceId }))
      resolve({
        send: (payload) => socket.send(JSON.stringify(payload)),
        close: () => socket.close(),
        drain: () => inbox.splice(0, inbox.length),
        wait: (match, timeout = 4000) => {
          const found = inbox.findIndex(match)
          if (found >= 0) return Promise.resolve(inbox.splice(found, 1)[0])
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error('等待消息超时')), timeout)
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
  const stamp = Date.now().toString(36).slice(-5)
  const ownerDevice = `smoke-owner-${stamp}`
  const guestDevice = `smoke-guest-${stamp}`

  const owner = await connect('冒烟主人', ownerDevice)
  const hello = await owner.wait((m) => m.t === 'welcome')
  check('握手返回 welcome', hello.deviceId === ownerDevice)

  // 个人简介
  owner.send({ t: 'profile', intro: '一战成硕' })
  const profile = await owner.wait((m) => m.t === 'profile')
  check('可以设置个人简介', profile.intro === '一战成硕')

  owner.send({ t: 'profile', intro: '加我微信 abc123' })
  const rejected = await owner.wait((m) => m.t === 'error')
  check('简介里的推广内容被拦下', !!rejected.message)

  // 作息打卡
  owner.send({ t: 'checkin', kind: 'wake', time: '07:21' })
  const checkin = await owner.wait((m) => m.t === 'checkin')
  check('起床打卡', checkin.wakeAt === '07:21')
  owner.send({ t: 'checkin', kind: 'wake', time: '09:99' })
  await owner.wait((m) => m.t === 'error')
  check('非法时间被拒', true)

  // 建自习室
  owner.send({ t: 'room:create', name: `冒烟自习室${stamp}`, intro: '一起上岸', goalMinutes: 120 })
  const created = await owner.wait((m) => m.t === 'room:created')
  check('建自习室成功', !!created.roomId && !!created.code, `加入码 ${created.code}`)
  const roomId = created.roomId

  // 握手时已经推过一次空的 rooms:mine，这里必须匹配到含新房间的那条
  const mine = await owner.wait((m) => m.t === 'rooms:mine' && m.rooms.some((r) => r.id === roomId))
  check('建成后出现在我的自习室里', mine.rooms.some((r) => r.id === roomId))

  // 进入房间
  owner.send({ t: 'room:enter', roomId })
  await owner.wait((m) => m.t === 'room:entered')
  const detail = await owner.wait((m) => m.t === 'room:detail')
  check('进入房间拿到详情', detail.room.id === roomId)
  check('主人标记正确', detail.room.isOwner === true)
  check('主人自动是成员', detail.room.isMember === true)
  check('在座人数为 1', detail.room.attendeeCount === 1)
  check('简介带出来了', detail.room.intro === '一起上岸')
  check('打卡时间进了名册', detail.members[0]?.wakeAt === '07:21')

  // 别人用加入码加入自习室
  const guest = await connect('冒烟同学', guestDevice)
  await guest.wait((m) => m.t === 'welcome')
  guest.send({ t: 'room:join', code: created.code })
  const joined = await guest.wait((m) => m.t === 'room:joined')
  check('用加入码加入自习室', joined.roomId === roomId)

  const guestRooms = await guest.wait(
    (m) => m.t === 'rooms:mine' && m.rooms.some((r) => r.id === roomId)
  )
  check('加入后出现在对方的自习室列表', guestRooms.rooms.some((r) => r.id === roomId))

  guest.send({ t: 'room:enter', roomId })
  await guest.wait((m) => m.t === 'room:entered')
  const twoUp = await owner.wait((m) => m.t === 'room:detail' && m.room.attendeeCount === 2, 5000)
  check('主人侧看到对方进入房间', twoUp.room.attendeeCount === 2)
  check('成员数也是 2', twoUp.room.memberCount === 2)

  // 专注计时
  const focus = { phase: 'work', running: true, remaining: 1500, todayPomodoros: 0, todayFocusMinutes: 0 }
  guest.send({ t: 'focus', focus })
  await new Promise((r) => setTimeout(r, 2500))
  guest.send({ t: 'focus', focus })
  const focused = await guest.wait(
    (m) => m.t === 'room:detail' && m.members.some((x) => x.deviceId === guestDevice && x.seconds > 0),
    6000
  )
  const guestRow = focused.members.find((x) => x.deviceId === guestDevice)
  check('专注时长计入房内榜', guestRow.seconds >= 2, `${guestRow.seconds}s`)
  check('连续天数是真实值', guestRow.streakDays >= 1, `连续 ${guestRow.streakDays} 天`)
  check('累计天数是真实值', guestRow.totalDays >= 1, `共 ${guestRow.totalDays} 天`)

  // 房间长期战绩：只算在这间屋里学的
  check('房间累计时长有了', focused.record?.totalSeconds >= 2, `${focused.record?.totalSeconds}s`)
  check('房间连续天数从 1 起步', focused.record?.streakDays === 1)
  check('我在这间屋里的贡献单独记', focused.record?.mySeconds >= 2, `${focused.record?.mySeconds}s`)

  // 许愿墙
  guest.send({ t: 'wish:add', roomId, text: '希望今年顺利上岸' })
  const wishes = await guest.wait((m) => m.t === 'wish:list')
  check('可以发愿', wishes.wishes.some((w) => w.text === '希望今年顺利上岸'))
  check('自己的愿望被标记', wishes.wishes[0].mine === true)

  guest.send({ t: 'wish:add', roomId, text: '加我qq 1234567' })
  const wishBlocked = await guest.wait((m) => m.t === 'error')
  check('带联系方式的愿望发不出去', !!wishBlocked.message)
  check('拒绝理由指出了具体哪一类', /联系方式|网址|推广|数字/.test(wishBlocked.message), wishBlocked.message)

  // 举报到阈值自动隐藏，主人复核后放行
  const wishId = wishes.wishes.find((w) => w.text === '希望今年顺利上岸').id
  const reporters = []
  for (let i = 0; i < 3; i++) {
    const r = await connect(`路人${i}`, `smoke-reporter-${stamp}-${i}`)
    await r.wait((m) => m.t === 'welcome')
    r.send({ t: 'wish:report', id: wishId, roomId })
    await r.wait((m) => m.t === 'notice' && m.kind === 'report')
    reporters.push(r)
  }

  guest.drain()
  guest.send({ t: 'wish:list', roomId })
  const afterHide = await guest.wait((m) => m.t === 'wish:list')
  const mineHidden = afterHide.wishes.find((w) => w.id === wishId)
  check('作者仍看得到自己被隐藏的内容', mineHidden?.hidden === true)

  owner.drain()
  owner.send({ t: 'wish:list', roomId })
  const ownerView = await owner.wait((m) => m.t === 'wish:list')
  check('别人看不到被隐藏的内容', !ownerView.wishes.some((w) => w.id === wishId))

  owner.send({ t: 'wish:pending', roomId })
  const pending = await owner.wait((m) => m.t === 'wish:pending')
  check('主人能看到待复核列表', pending.wishes.some((w) => w.id === wishId))
  check('待复核带着举报数', pending.wishes.find((w) => w.id === wishId)?.reports === 3)

  reporters[0].send({ t: 'wish:restore', id: wishId, roomId })
  const restoreDenied = await reporters[0].wait((m) => m.t === 'error')
  check('普通成员不能放行', !!restoreDenied.message)

  owner.drain()
  owner.send({ t: 'wish:restore', id: wishId, roomId })
  const restored = await owner.wait((m) => m.t === 'wish:list' && m.wishes.some((w) => w.id === wishId))
  check('主人放行后重新可见', restored.wishes.some((w) => w.id === wishId))
  for (const r of reporters) r.close()

  // 关键区分：退出房间 ≠ 退出自习室
  // 先清主人侧积压，否则「1 人在座」会匹配到刚建房时那条旧详情
  owner.drain()
  guest.send({ t: 'room:exit' })
  await guest.wait((m) => m.t === 'room:exited')
  guest.drain()
  guest.send({ t: 'rooms:mine' })
  const stillMember = await guest.wait((m) => m.t === 'rooms:mine')
  check('退出房间后仍然是自习室成员', stillMember.rooms.some((r) => r.id === roomId))

  const backToOne = await owner.wait((m) => m.t === 'room:detail' && m.room.attendeeCount === 1, 5000)
  check('主人侧在座人数回到 1', backToOne.room.attendeeCount === 1)
  check('但成员数仍然是 2', backToOne.room.memberCount === 2)

  // 显式退出自习室才解除关系
  guest.send({ t: 'room:quit', roomId })
  await guest.wait((m) => m.t === 'room:quit')
  const afterQuit = await guest.wait((m) => m.t === 'rooms:mine')
  check('退出自习室后不再是成员', !afterQuit.rooms.some((r) => r.id === roomId))

  // 主人解散。先清掉积压消息，否则会匹配到握手时那条空列表
  owner.drain()
  owner.send({ t: 'room:dissolve', roomId })
  const afterDissolve = await owner.wait((m) => m.t === 'rooms:mine', 5000)
  check('主人可以解散自习室', !afterDissolve.rooms.some((r) => r.id === roomId))

  owner.send({ t: 'room:enter', roomId })
  const gone = await owner.wait((m) => m.t === 'error', 5000)
  check('解散后房间进不去了', !!gone.message)

  owner.close()
  guest.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('冒烟失败：', err.message)
  process.exit(1)
})
