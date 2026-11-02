#!/usr/bin/env node
/**
 * 生成应用图标：纯代码绘制，不依赖任何图像库。
 *
 *   node scripts/build-icon.mjs
 *
 * 产出：
 *   electron/resources/icon.png   1024×1024（electron-builder / Linux / mac 用）
 *   electron/resources/icon.ico   多尺寸（Windows 可执行文件与安装程序用）
 *
 * 图形：靛蓝渐变圆角方块 + 白色 M 折线 + 一条流动曲线，寓意 Markdown → 排版。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'electron', 'resources')

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const dst = y * (size * 4 + 1)
    raw[dst] = 0
    rgba.copy(raw, dst + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 几何小工具 ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => a + (b - a) * t
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

/** 圆角矩形有符号距离场（中心/半宽/圆角半径均为 0..1 归一化坐标） */
function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - hw + r
  const dy = Math.abs(y - cy) - hh + r
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

/** 点到线段距离 */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : clamp01((wx * vx + wy * vy) / len2)
  return Math.hypot(wx - vx * t, wy - vy * t)
}

// ---------- 绘制 ----------
const TOP = hex('#6366f1') // indigo-500
const BOTTOM = hex('#312e81') // indigo-900
const ACCENT = hex('#a5b4fc') // indigo-300

// M 的折线（归一化坐标）
const M_PTS = [
  [0.275, 0.705],
  [0.275, 0.315],
  [0.5, 0.565],
  [0.725, 0.315],
  [0.725, 0.705],
]
const M_STROKE = 0.078

/** 在 size×size 上绘制，ss 倍超采样后盒式降采样 */
function render(size, ss = 4) {
  const S = size * ss
  const acc = new Float32Array(size * size * 4)
  const inv = 1 / S
  const px = new Float32Array(S * S * 4)
  const bg = new Float32Array(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) * inv
      const v = (y + 0.5) * inv
      const i = (y * S + x) * 4

      // 背景：圆角方块 + 对角渐变
      const d = sdRoundRect(u, v, 0.5, 0.5, 0.5, 0.5, 0.235)
      const aa = clamp01(0.5 - d / (1.4 * inv)) // 抗锯齿边缘
      const t = clamp01((u + v) * 0.5)
      bg[i] = mix(TOP[0], BOTTOM[0], t)
      bg[i + 1] = mix(TOP[1], BOTTOM[1], t)
      bg[i + 2] = mix(TOP[2], BOTTOM[2], t)
      bg[i + 3] = aa

      // 顶部柔光
      const glow = clamp01(1 - Math.hypot(u - 0.18, v - 0.1) / 0.85) ** 2 * 0.16
      bg[i] = mix(bg[i], 1, glow)
      bg[i + 1] = mix(bg[i + 1], 1, glow)
      bg[i + 2] = mix(bg[i + 2], 1, glow)

      px[i] = bg[i]
      px[i + 1] = bg[i + 1]
      px[i + 2] = bg[i + 2]
      px[i + 3] = bg[i + 3]
    }
  }

  // M 折线：距离场描边（白）
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) * inv
      const v = (y + 0.5) * inv
      let dist = Infinity
      for (let k = 0; k < M_PTS.length - 1; k++) {
        const [ax, ay] = M_PTS[k]
        const [bx, by] = M_PTS[k + 1]
        dist = Math.min(dist, sdSegment(u, v, ax, ay, bx, by))
      }
      const a = clamp01((M_STROKE / 2 - dist) / (1.6 * inv))
      if (a <= 0) continue
      const i = (y * S + x) * 4
      px[i] = mix(px[i], 1, a)
      px[i + 1] = mix(px[i + 1], 1, a)
      px[i + 2] = mix(px[i + 2], 1, a)
    }
  }

  // 底部流动曲线（强调色，代表 flow）
  const CURVE = [
    [0.26, 0.845],
    [0.42, 0.775],
    [0.58, 0.895],
    [0.74, 0.825],
  ]
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) * inv
      const v = (y + 0.5) * inv
      let dist = Infinity
      for (let k = 0; k < CURVE.length - 1; k++) {
        const [ax, ay] = CURVE[k]
        const [bx, by] = CURVE[k + 1]
        dist = Math.min(dist, sdSegment(u, v, ax, ay, bx, by))
      }
      const a = clamp01((0.022 - dist) / (1.6 * inv)) * 0.9
      if (a <= 0) continue
      const i = (y * S + x) * 4
      px[i] = mix(px[i], ACCENT[0], a)
      px[i + 1] = mix(px[i + 1], ACCENT[1], a)
      px[i + 2] = mix(px[i + 2], ACCENT[2], a)
    }
  }

  // 降采样
  const n = ss * ss
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * S + (x * ss + sx)) * 4
          const al = px[i + 3]
          r += px[i] * al
          g += px[i + 1] * al
          b += px[i + 2] * al
          a += al
        }
      }
      const o = (y * size + x) * 4
      acc[o] = a > 0 ? r / a : 0
      acc[o + 1] = a > 0 ? g / a : 0
      acc[o + 2] = a > 0 ? b / a : 0
      acc[o + 3] = a / n
    }
  }

  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = Math.round(clamp01(acc[i * 4]) * 255)
    out[i * 4 + 1] = Math.round(clamp01(acc[i * 4 + 1]) * 255)
    out[i * 4 + 2] = Math.round(clamp01(acc[i * 4 + 2]) * 255)
    out[i * 4 + 3] = Math.round(clamp01(acc[i * 4 + 3]) * 255)
  }
  return out
}

/** 组装 ICO（PNG 内嵌格式，Vista 以上原生支持） */
function encodeICO(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dirs = []
  let offset = 6 + entries.length * 16
  for (const { size, png } of entries) {
    const d = Buffer.alloc(16)
    d[0] = size >= 256 ? 0 : size
    d[1] = size >= 256 ? 0 : size
    d[2] = 0
    d[3] = 0
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(png.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += png.length
    dirs.push(d)
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)])
}

const SIZES = [16, 24, 32, 48, 64, 128, 256]

const t0 = Date.now()
await fs.mkdir(OUT, { recursive: true })

const big = encodePNG(1024, render(1024, 3))
await fs.writeFile(path.join(OUT, 'icon.png'), big)

const entries = SIZES.map((s) => ({ size: s, png: encodePNG(s, render(s, s <= 32 ? 8 : 4)) }))
await fs.writeFile(path.join(OUT, 'icon.ico'), encodeICO(entries))

console.log(`✓ icon.png  1024×1024  ${(big.length / 1024).toFixed(0)} KB`)
console.log(`✓ icon.ico  ${SIZES.join('/')}  ${(encodeICO(entries).length / 1024).toFixed(0)} KB`)
console.log(`  用时 ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(ROOT, OUT)}`)
