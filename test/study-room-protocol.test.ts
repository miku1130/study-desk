import { describe, it, expect } from 'vitest'
import {
  MessageDecoder,
  STUDY_ROOM_MAX_FRAME_BYTES,
  broadcastAddressesFrom,
  decodeRoomCode,
  encodeMessage,
  encodeRoomCode,
  looksLikePromotion,
  normalizeDisplayText,
  parseMessage,
  primaryLanAddress,
  sanitizeNickname,
  validateNickname,
  validateRoomName
} from '../src/main/studyRoom/protocol'
import type { NetworkInterfaceLike } from '../src/main/studyRoom/protocol'

describe('normalizeDisplayText', () => {
  it('去除零宽字符', () => {
    expect(normalizeDisplayText('小\u200b明\ufeff', 12)).toBe('小明')
  })

  it('全角转半角', () => {
    expect(normalizeDisplayText('ＱＱ１２３', 12)).toBe('QQ123')
    expect(normalizeDisplayText('全角\u3000空格', 12)).toBe('全角 空格')
  })

  it('折叠连续空白并去首尾', () => {
    expect(normalizeDisplayText('  多  个   空格 ', 20)).toBe('多 个 空格')
  })

  it('按长度截断', () => {
    expect(normalizeDisplayText('a'.repeat(20), 12)).toHaveLength(12)
  })

  it('非字符串输入返回空串', () => {
    expect(normalizeDisplayText(123, 12)).toBe('')
    expect(normalizeDisplayText(null, 12)).toBe('')
  })
})

describe('looksLikePromotion', () => {
  it.each(['加我qq123456', '微 信 abc', 'ｗｗｗ.x.com', '13800138000', '代写作业'])(
    '拦截广告文本：%s',
    (text) => {
      expect(looksLikePromotion(text)).toBe(true)
    }
  )

  it.each(['小明', '爱学习的猫', 'Room 3', '高三7班'])('放行正常文本：%s', (text) => {
    expect(looksLikePromotion(text)).toBe(false)
  })
})

describe('validateNickname / validateRoomName', () => {
  it('正常昵称通过并返回归一化值', () => {
    const result = validateNickname('  小明  ')
    expect(result).toEqual({ ok: true, value: '小明', reason: '' })
  })

  it('空昵称给出填写提示', () => {
    const result = validateNickname('')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('请填写昵称')
  })

  it('广告昵称给出拒绝理由', () => {
    const result = validateNickname('加我QQ12345')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('不能包含')
  })

  it('房间名超长会被截断后通过', () => {
    const result = validateRoomName('x'.repeat(30))
    expect(result.ok).toBe(true)
    expect(result.value).toHaveLength(16)
  })

  it('广告房间名给出拒绝理由', () => {
    const result = validateRoomName('进群加微信abc')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('自习室名称')
  })
})

describe('sanitizeNickname', () => {
  it('广告输入回退到默认昵称', () => {
    expect(sanitizeNickname('加我qq12345')).toBe('同学')
    expect(sanitizeNickname('')).toBe('同学')
  })

  it('正常输入原样保留', () => {
    expect(sanitizeNickname('爱学习的猫')).toBe('爱学习的猫')
  })
})

describe('encodeRoomCode / decodeRoomCode', () => {
  it('往返一致', () => {
    const code = encodeRoomCode('192.168.1.7', 45871)
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/)
    expect(decodeRoomCode(code)).toEqual({ address: '192.168.1.7', port: 45871 })
  })

  it('容忍小写与缺失连字符', () => {
    const code = encodeRoomCode('10.20.30.40', 52000)
    expect(decodeRoomCode(code.toLowerCase())).toEqual({ address: '10.20.30.40', port: 52000 })
    expect(decodeRoomCode(code.replace('-', ''))).toEqual({ address: '10.20.30.40', port: 52000 })
  })

  it('容忍 O/I/L 误输入', () => {
    const code = encodeRoomCode('10.0.0.1', 45871)
    expect(decodeRoomCode(code.replace(/0/g, 'O'))).toEqual({ address: '10.0.0.1', port: 45871 })
    const canonical = decodeRoomCode('11111-11111')
    expect(canonical).not.toBeNull()
    expect(decodeRoomCode('IIIII-LLLLL')).toEqual(canonical)
  })

  it('非法输入返回 null', () => {
    expect(decodeRoomCode('')).toBeNull()
    expect(decodeRoomCode('ABC')).toBeNull()
    expect(decodeRoomCode('ABCDE-FGH')).toBeNull()
    expect(decodeRoomCode(12345)).toBeNull()
    // 端口为 0 的码无效
    expect(decodeRoomCode('00000-00000')).toBeNull()
  })

  it('非法地址或端口编码为空串', () => {
    expect(encodeRoomCode('999.0.0.1', 45871)).toBe('')
    expect(encodeRoomCode('1.2.3', 45871)).toBe('')
    expect(encodeRoomCode('1.2.3.4', 0)).toBe('')
    expect(encodeRoomCode('1.2.3.4', 70000)).toBe('')
  })
})

describe('MessageDecoder', () => {
  it('TCP 分片重组成完整消息', () => {
    const decoder = new MessageDecoder()
    expect(decoder.push('{"t":"pi')).toEqual([])
    expect(decoder.push('ng"}\n').map((m) => m.t)).toEqual(['ping'])
  })

  it('一次 push 解出多条消息', () => {
    const decoder = new MessageDecoder()
    const messages = decoder.push('{"t":"ping"}\n{"t":"pong"}\n{"t":"bye"}\n')
    expect(messages.map((m) => m.t)).toEqual(['ping', 'pong', 'bye'])
  })

  it('超长且无换行的异常流被丢弃，之后仍可正常解码', () => {
    const decoder = new MessageDecoder()
    expect(decoder.push('x'.repeat(STUDY_ROOM_MAX_FRAME_BYTES + 1))).toEqual([])
    expect(decoder.push('{"t":"ping"}\n').map((m) => m.t)).toEqual(['ping'])
  })

  it('非法 JSON 行被跳过，不影响后续消息', () => {
    const decoder = new MessageDecoder()
    const messages = decoder.push('not-json\n{"t":"ping"}\n')
    expect(messages.map((m) => m.t)).toEqual(['ping'])
  })

  it('支持 Buffer 输入', () => {
    const decoder = new MessageDecoder()
    expect(decoder.push(Buffer.from(encodeMessage({ t: 'pong' }))).map((m) => m.t)).toEqual([
      'pong'
    ])
  })
})

describe('parseMessage', () => {
  it('cheer 非白名单 id 返回 null（反广告核心）', () => {
    expect(parseMessage('{"t":"cheer","cheerId":"buy-now-http://x.com","toId":""}')).toBeNull()
    expect(parseMessage('{"t":"cheer","cheerId":"联系我qq123","toId":"m1"}')).toBeNull()
  })

  it('cheer 白名单 id 正常解析', () => {
    expect(parseMessage('{"t":"cheer","cheerId":"fighting","toId":"m1"}')).toEqual({
      t: 'cheer',
      cheerId: 'fighting',
      toId: 'm1'
    })
  })

  it('cheered 非白名单 id 同样返回 null', () => {
    expect(
      parseMessage('{"t":"cheered","cheerId":"ad","fromId":"a","fromNickname":"x","toId":"","at":1}')
    ).toBeNull()
  })

  it('hello 中的广告昵称被清洗成 同学', () => {
    const line = JSON.stringify({
      t: 'hello',
      v: 1,
      nickname: '加微信vx12345',
      catId: 'mikan',
      focus: { phase: 'work', running: true, remaining: 100, todayFocusMinutes: 5, todayPomodoros: 1 }
    })
    const message = parseMessage(line)
    expect(message?.t).toBe('hello')
    if (message?.t === 'hello') {
      expect(message.nickname).toBe('同学')
      expect(message.focus.phase).toBe('work')
      expect(message.focus.running).toBe(true)
    }
  })

  it('未知类型与非对象输入返回 null', () => {
    expect(parseMessage('{"t":"chat","text":"广告"}')).toBeNull()
    expect(parseMessage('[1,2,3]')).toBeNull()
    expect(parseMessage('   ')).toBeNull()
  })

  it('focus 缺 todayRoomFocusSeconds 时默认为 0（兼容未升级客户端）', () => {
    const line = JSON.stringify({
      t: 'focus',
      focus: { phase: 'work', running: true, remaining: 60, todayFocusMinutes: 1, todayPomodoros: 0 }
    })
    const message = parseMessage(line)
    expect(message?.t).toBe('focus')
    if (message?.t === 'focus') expect(message.focus.todayRoomFocusSeconds).toBe(0)
  })

  it('todayRoomFocusSeconds 会被清洗：负数与非数字归 0，超限封顶 24 小时', () => {
    const parsedSeconds = (todayRoomFocusSeconds: unknown): number => {
      const line = JSON.stringify({
        t: 'focus',
        focus: {
          phase: 'work',
          running: true,
          remaining: 60,
          todayFocusMinutes: 1,
          todayPomodoros: 0,
          todayRoomFocusSeconds
        }
      })
      const message = parseMessage(line)
      if (message?.t !== 'focus') throw new Error('focus 消息解析失败')
      return message.focus.todayRoomFocusSeconds
    }
    expect(parsedSeconds(3600)).toBe(3600)
    expect(parsedSeconds(-5)).toBe(0)
    expect(parsedSeconds('abc')).toBe(0)
    expect(parsedSeconds(999_999_999)).toBe(24 * 3600)
  })

  it('roster 成员快照原样携带 todayRoomFocusSeconds', () => {
    const line = JSON.stringify({
      t: 'roster',
      room: { roomId: 'r1', name: '自习室' },
      members: [{ id: 'm1', nickname: '小明', todayRoomFocusSeconds: 777 }]
    })
    const message = parseMessage(line)
    expect(message?.t).toBe('roster')
    if (message?.t === 'roster') {
      expect(message.members[0].todayRoomFocusSeconds).toBe(777)
    }
  })
})

describe('broadcastAddressesFrom', () => {
  const interfaces: Record<string, NetworkInterfaceLike[] | undefined> = {
    以太网: [{ family: 'IPv4', internal: false, address: '192.168.1.7', netmask: '255.255.255.0' }],
    WLAN: [
      { family: 'IPv6', internal: false, address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::' },
      { family: 4, internal: false, address: '10.1.2.3', netmask: '255.255.0.0' }
    ],
    Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
    残缺: [{ family: 'IPv4', internal: false, address: '', netmask: '' }],
    空: undefined
  }

  it('按 ip | ~mask 推导定向广播地址', () => {
    const list = broadcastAddressesFrom(interfaces)
    expect(list).toContain('192.168.1.255')
    expect(list).toContain('10.1.255.255')
  })

  it('跳过 internal 与 IPv6，始终包含受限广播地址', () => {
    const list = broadcastAddressesFrom(interfaces)
    expect(list).not.toContain('127.255.255.255')
    expect(list).toContain('255.255.255.255')
  })

  it('空输入也至少给出受限广播地址', () => {
    expect(broadcastAddressesFrom({})).toEqual(['255.255.255.255'])
  })
})

describe('primaryLanAddress', () => {
  it('优先 192.168 网段', () => {
    const address = primaryLanAddress({
      a: [{ family: 'IPv4', internal: false, address: '172.16.0.5', netmask: '255.255.0.0' }],
      b: [{ family: 'IPv4', internal: false, address: '192.168.1.7', netmask: '255.255.255.0' }]
    })
    expect(address).toBe('192.168.1.7')
  })

  it('其次 10 网段', () => {
    const address = primaryLanAddress({
      a: [{ family: 'IPv4', internal: false, address: '172.16.0.5', netmask: '255.255.0.0' }],
      b: [{ family: 'IPv4', internal: false, address: '10.0.0.8', netmask: '255.0.0.0' }]
    })
    expect(address).toBe('10.0.0.8')
  })

  it('无优选网段时取第一个候选，internal 不参与', () => {
    const address = primaryLanAddress({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
      a: [{ family: 'IPv4', internal: false, address: '172.16.0.5', netmask: '255.255.0.0' }]
    })
    expect(address).toBe('172.16.0.5')
  })

  it('没有任何候选时回退 127.0.0.1', () => {
    expect(primaryLanAddress({})).toBe('127.0.0.1')
  })
})
