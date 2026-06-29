const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg')
const outDir = path.join(__dirname, '..', 'assets')

const sizes = [16, 32, 48, 64, 128, 256]

function createIco(pngBuffers) {
  const numImages = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(numImages, 4)

  let offset = 6 + numImages * 16
  const dirEntries = []
  const imageData = []

  for (const { size, data } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    dirEntries.push(entry)
    imageData.push(data)
  }

  return Buffer.concat([header, ...dirEntries, ...imageData])
}

async function main() {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const pngBuffers = []

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
    const pngPath = path.join(outDir, `icon-${size}.png`)
    fs.writeFileSync(pngPath, buf)
    console.log(`Generated ${pngPath}`)
    pngBuffers.push({ size, data: buf })
  }

  const icoPath = path.join(outDir, 'icon.ico')
  fs.writeFileSync(icoPath, createIco(pngBuffers))
  console.log(`Generated ${icoPath}`)

  console.log(`\nDone. Use icon.ico for builds.`)
}

main().catch(console.error)
