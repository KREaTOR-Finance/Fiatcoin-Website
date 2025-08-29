import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const projectRoot = path.resolve(process.cwd())
const assetsDir = path.join(projectRoot, 'assets')
const publicDir = path.join(projectRoot, 'public')

const CANDIDATE_FILES = [
  'logo-source.png',
  'logo-source.jpg',
  'logo-source.jpeg',
  'logo-source.webp',
  'logo-source.svg'
]

function findSource() {
  for (const f of CANDIDATE_FILES) {
    const p = path.join(assetsDir, f)
    if (fs.existsSync(p)) return p
  }
  return null
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function makePng(sharpInput, outPath, size) {
  const buf = await sharp(sharpInput).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer()
  await fs.promises.writeFile(outPath, buf)
  return buf
}

async function main() {
  await ensureDir(assetsDir)
  await ensureDir(publicDir)

  const src = findSource()
  if (!src) {
    console.error('[icons] No source image found. Please add one of these files to \'assets/\':')
    console.error('        ' + CANDIDATE_FILES.join(', '))
    console.error('        Example: assets/logo-source.png')
    process.exitCode = 1
    return
  }

  console.log(`[icons] Using source: ${path.relative(projectRoot, src)}`)

  // Generate PNGs
  const png16 = await makePng(src, path.join(publicDir, 'icon-16.png'), 16)
  const png32 = await makePng(src, path.join(publicDir, 'icon-32.png'), 32)
  const png48 = await makePng(src, path.join(publicDir, 'icon-48.png'), 48)
  await makePng(src, path.join(publicDir, 'apple-touch-icon.png'), 180)
  await makePng(src, path.join(publicDir, 'fiatcoin.png'), 512)
  await makePng(src, path.join(publicDir, 'icon-192.png'), 192)
  await makePng(src, path.join(publicDir, 'icon-512.png'), 512)

  // ICO from 16/32/48
  console.log('[icons] Building favicon.ico')
  const ico = await pngToIco([png16, png32, png48])
  await fs.promises.writeFile(path.join(publicDir, 'favicon.ico'), ico)

  console.log('[icons] Done. Files written to /public:')
  console.log('  - favicon.ico')
  console.log('  - apple-touch-icon.png')
  console.log('  - fiatcoin.png, icon-16.png, icon-32.png, icon-48.png, icon-192.png, icon-512.png')
}

main().catch((err) => {
  console.error('[icons] Error:', err)
  process.exit(1)
})


