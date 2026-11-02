/**
 * ============================================================================
 *  zip.mjs —— 一个刚好够用的 ZIP 写入器
 * ----------------------------------------------------------------------------
 *  为什么不用 archiver / adm-zip：打包只是一次性的发布动作，
 *  为一个 3KB 的目录树拉一棵依赖树不值得。这里用 node:zlib 的 deflateRaw
 *  手写本地文件头 + 中央目录，产出的 zip 能被 Windows / macOS / Linux 正常识别。
 * ============================================================================
 */
import { deflateRawSync } from 'node:zlib'

/* ---------------------------- CRC32 ---------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* --------------------------- DOS 时间 --------------------------- */

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff
  return { time, day }
}

/* ---------------------------- 写入器 ---------------------------- */

export class ZipWriter {
  constructor() {
    this.chunks = []
    this.entries = []
    this.offset = 0
  }

  /**
   * @param {string} name   zip 内部路径（用 / 分隔）
   * @param {Buffer} data
   * @param {{store?: boolean, mode?: number}} opts
   *        store: 只存储不压缩（留给已经压过的二进制）
   *        mode:   Unix 权限位，默认 0o644
   */
  add(name, data, opts = {}) {
    const store = Boolean(opts.store)
    const mode = opts.mode ?? 0o644
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const method = store ? 0 : 8
    const body = store ? data : deflateRawSync(data, { level: 9 })
    const { time, day } = dosDateTime()

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 文件名标志
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    this.chunks.push(local, nameBuf, body)
    this.entries.push({
      nameBuf,
      crc,
      method,
      time,
      day,
      compSize: body.length,
      rawSize: data.length,
      offset: this.offset,
      mode,
    })
    this.offset += local.length + nameBuf.length + body.length
  }

  finish() {
    const centralStart = this.offset
    let centralSize = 0
    for (const e of this.entries) {
      const h = Buffer.alloc(46)
      h.writeUInt32LE(0x02014b50, 0)
      h.writeUInt16LE(20, 4) // version made by
      h.writeUInt16LE(20, 6) // version needed
      h.writeUInt16LE(0x0800, 8)
      h.writeUInt16LE(e.method, 10)
      h.writeUInt16LE(e.time, 12)
      h.writeUInt16LE(e.day, 14)
      h.writeUInt32LE(e.crc, 16)
      h.writeUInt32LE(e.compSize, 20)
      h.writeUInt32LE(e.rawSize, 24)
      h.writeUInt16LE(e.nameBuf.length, 28)
      h.writeUInt16LE(0, 30) // extra
      h.writeUInt16LE(0, 32) // comment
      h.writeUInt16LE(0, 34) // disk
      h.writeUInt16LE(0, 36) // internal attrs
      h.writeUInt32LE(((0o100000 | e.mode) << 16) >>> 0, 38) // 普通文件 + 权限位
      h.writeUInt32LE(e.offset, 42)
      this.chunks.push(h, e.nameBuf)
      centralSize += h.length + e.nameBuf.length
    }

    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(0, 4)
    end.writeUInt16LE(0, 6)
    end.writeUInt16LE(this.entries.length, 8)
    end.writeUInt16LE(this.entries.length, 10)
    end.writeUInt32LE(centralSize, 12)
    end.writeUInt32LE(centralStart, 16)
    end.writeUInt16LE(0, 20)

    return Buffer.concat([...this.chunks, end])
  }
}
