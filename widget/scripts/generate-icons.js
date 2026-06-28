const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg')
const outDir = path.join(__dirname, '..', 'assets')

const sizes = [16, 32, 48, 64, 128, 256]

async function main() {
  const svg = fs.readFileSync(svgPath, 'utf8')

  for (const size of sizes) {
    const pngPath = path.join(outDir, `icon-${size}.png`)
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(pngPath)
    console.log(`Generated ${pngPath}`)
  }

  // Generate icon.ico from 256x256 PNG (electron-builder handles conversion)
  const icon256 = path.join(outDir, 'icon-256.png')
  console.log(`\nDone. Use icon-256.png for builds.`)
}

main().catch(console.error)
