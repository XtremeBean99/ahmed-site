import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'room', 'cursor')
await mkdir(out, { recursive: true })

const svg = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" shape-rendering="crispEdges" viewBox="0 0 24 24">${paths}</svg>`

// Arrow pointer: dark #3d2e1e body, light #e8d5b0 fill
const pointer = svg('<path d="M2 2 L2 17 L6 13 L9 20 L12 19 L9 12 L15 12 Z" fill="#e8d5b0" stroke="#3d2e1e" stroke-width="1.5"/>')
// "Grab" hand-ish blob for interactive elements
const grab = svg('<rect x="6" y="4" width="12" height="14" rx="3" fill="#e8d5b0" stroke="#3d2e1e" stroke-width="1.5"/><rect x="9" y="1" width="2" height="6" fill="#3d2e1e"/><rect x="13" y="1" width="2" height="6" fill="#3d2e1e"/>')

await sharp(Buffer.from(pointer)).png().toFile(join(out, 'pointer.png'))
await sharp(Buffer.from(grab)).png().toFile(join(out, 'grab.png'))
console.log('cursors -> public/room/cursor/')
