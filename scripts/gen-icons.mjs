// Generates public/icon-192.png and icon-512.png (no dependencies).
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [243, 234, 216], BODY = [200, 85, 61], INK = [43, 33, 24]

function crc32(buf) {
  let c, crc = ~0
  for (const b of buf) {
    c = (crc ^ b) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function inRoundRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r)
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
function render(size) {
  const s = size / 512
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0
    for (let px = 0; px < size; px++) {
      const x = px / s, y = py / s
      let col = BG
      if (inRoundRect(x, y, 96, 176, 320, 208, 28)) col = BODY
      if ((x - 176) ** 2 + (y - 280) ** 2 <= 52 * 52) col = BG
      if ((x - 176) ** 2 + (y - 280) ** 2 <= 20 * 20) col = INK
      if (inRoundRect(x, y, 256, 236, 120, 14, 7) || inRoundRect(x, y, 256, 274, 120, 14, 7) || inRoundRect(x, y, 256, 312, 80, 14, 7)) col = BG
      // antenna
      const t = (x - 330) / 70, ly = 176 - t * 72
      if (t >= 0 && t <= 1 && Math.abs(y - ly) < 7) col = INK
      const o = py * (size * 3 + 1) + 1 + px * 3
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
for (const size of [192, 512]) writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), render(size))
console.log('icons written')
