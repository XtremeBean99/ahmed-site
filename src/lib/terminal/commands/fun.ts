// calculators, archivers, jq and the fun command family.
import type { Cmd, CmdCtx, CmdInfo } from '../types'
import { FsError } from '../vfs'
import { runExpr } from './fun-expr'
import { runBc } from './fun-bc'
import { runJq, parseJsonStream, type JqOptions, type JqVal } from './fun-jq'
import { runTar, runZip, runUnzip, runGzip, runZcat } from './fun-archive'
import { figletText, bannerText } from './fun-figlet'
import { COWS } from './fun-cows'
import { FORTUNES, FORTUNES_SHORT } from './fun-data'
import { PAGE_LOAD_AT } from './fun-util'

export const info: Record<string, CmdInfo> = {
  expr: { summary: 'evaluate expressions', usage: 'expr EXPRESSION' },
  bc: { summary: 'arbitrary precision calculator language', usage: 'bc [-lq] [FILE...]' },
  factor: { summary: 'factor numbers into primes', usage: 'factor [NUMBER]...' },
  jq: { summary: 'command-line JSON processor', usage: 'jq [OPTIONS] FILTER [FILE...]' },
  tar: { summary: 'create, list and extract tape archives', usage: 'tar [-ctxvzf] ARCHIVE [FILE...]' },
  zip: { summary: 'package files into a zip archive', usage: 'zip [-r] ARCHIVE FILE...' },
  unzip: { summary: 'list and extract zip archives', usage: 'unzip [-l] [-d DIR] [-o] ARCHIVE' },
  gzip: { summary: 'compress files', usage: 'gzip [-kdfc] FILE...' },
  gunzip: { summary: 'decompress gzip files', usage: 'gunzip [-kfc] FILE...' },
  zcat: { summary: 'decompress gzip files to stdout', usage: 'zcat [FILE...]' },
  figlet: { summary: 'print large letters made of ordinary text', usage: 'figlet [-f FONT] [-w N] [TEXT]' },
  toilet: { summary: 'print large colourful letters', usage: 'toilet [-f FONT] [-w N] [TEXT]' },
  banner: { summary: 'print a large # banner', usage: 'banner [TEXT]' },
  cowsay: { summary: 'a configurable speaking cow', usage: 'cowsay [-f COW] [-e EYES] [-T TONGUE] [-W N] [TEXT]' },
  cowthink: { summary: 'a configurable thinking cow', usage: 'cowthink [-f COW] [-e EYES] [-W N] [TEXT]' },
  fortune: { summary: 'print a random fortune cookie', usage: 'fortune [-s]' },
  lolcat: { summary: 'rainbow colour output', usage: 'lolcat [FILE | TEXT...]' },
  sl: { summary: 'steam locomotive (you meant ls)', usage: 'sl' },
  cmatrix: { summary: 'matrix-style green character rain', usage: 'cmatrix' },
  neofetch: { summary: 'print system information with a logo', usage: 'neofetch' },
  screenfetch: { summary: 'print system information with a logo', usage: 'screenfetch' },
  emacs: { summary: 'text editor (not in this household)', usage: 'emacs' },
}

function usage(ctx: CmdCtx, name: string): boolean {
  if (ctx.args.includes('--help')) {
    ctx.out(info[name].usage + '\n')
    return true
  }
  return false
}

// ---- expr --------------------------------------------------------------------------------------------

const expr: Cmd = (ctx) => {
  if (usage(ctx, 'expr')) return 0
  const r = runExpr(ctx.args)
  if (r.err) ctx.err(r.err)
  if (r.out) ctx.out(r.out)
  return r.status
}

// ---- bc ----------------------------------------------------------------------------------------------

const bc: Cmd = async (ctx) => {
  if (usage(ctx, 'bc')) return 0
  let mathlib = false
  const files: string[] = []
  for (const a of ctx.args) {
    if (a === '-l') mathlib = true
    else if (a === '-q' || a === '-w') continue
    else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`bc: invalid option -- '${a[1]}'\n`)
      return 2
    } else files.push(a)
  }
  let program = ''
  if (files.length > 0) {
    for (const f of files) {
      try {
        program += ctx.fs.readFile(ctx.resolve(f)) + '\n'
      } catch (e) {
        ctx.err(`bc: ${f}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
        return 1
      }
    }
  } else {
    program = await ctx.stdin.readAll()
  }
  const r = runBc(program, { mathlib, quiet: true }, ctx.signal)
  if (r.err) ctx.err(r.err)
  if (r.out) ctx.out(r.out)
  return r.status
}

// ---- factor ------------------------------------------------------------------------------------------

const WHEEL = [4, 2, 4, 2, 4, 6, 2, 6]

function factorize(n: number, signal?: AbortSignal): number[] | null {
  const out: number[] = []
  let x = n
  const div = (p: number): void => {
    while (x % p === 0) {
      out.push(p)
      x = Math.floor(x / p)
    }
  }
  div(2)
  div(3)
  div(5)
  let d = 7
  let wi = 0
  let ticks = 0
  while (d * d <= x) {
    if ((ticks++ & 0xffff) === 0 && signal?.aborted) return null
    if (x % d === 0) {
      out.push(d)
      x = Math.floor(x / d)
    } else {
      d += WHEEL[wi]
      wi = (wi + 1) % WHEEL.length
    }
  }
  if (x > 1) out.push(x)
  return out
}

const factor: Cmd = async (ctx) => {
  if (usage(ctx, 'factor')) return 0
  let nums: string[]
  if (ctx.args.length > 0) nums = ctx.args
  else nums = (await ctx.stdin.readAll()).split(/\s+/).filter(Boolean)
  let status = 0
  for (const raw of nums) {
    if (!/^[0-9]+$/.test(raw)) {
      ctx.err(`factor: '${raw}' is not a valid positive integer\n`)
      status = 1
      continue
    }
    const n = Number(raw)
    if (!Number.isSafeInteger(n) || n < 1) {
      ctx.err(`factor: '${raw}' is not a valid positive integer\n`)
      status = 1
      continue
    }
    const f = factorize(n, ctx.signal)
    if (f === null) return 130
    ctx.out(raw + ':' + (f.length > 0 ? ' ' + f.join(' ') : '') + '\n')
  }
  return status
}

// ---- jq ----------------------------------------------------------------------------------------------

const jq: Cmd = async (ctx) => {
  if (usage(ctx, 'jq')) return 0
  const opts: JqOptions = { raw: false, compact: false, exitStatus: false, slurp: false, nullInput: false, sortKeys: false, tab: false, indent: 2 }
  const vars: Record<string, JqVal> = {}
  const args = ctx.args
  let i = 0
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '-r') opts.raw = true
    else if (a === '-c') opts.compact = true
    else if (a === '-e') opts.exitStatus = true
    else if (a === '-s') opts.slurp = true
    else if (a === '-n') opts.nullInput = true
    else if (a === '-S') opts.sortKeys = true
    else if (a === '--tab') opts.tab = true
    else if (a === '--indent') {
      const n = Number(args[++i])
      if (!Number.isInteger(n) || n < 0 || n > 9) {
        ctx.err('jq: --indent takes a number between 0 and 9\n')
        return 2
      }
      opts.indent = n
    } else if (a === '--arg' || a === '--argjson') {
      const k = args[++i]
      const v = args[++i]
      if (k === undefined || v === undefined) {
        ctx.err(`jq: --${a.slice(2)} takes two arguments\n`)
        return 2
      }
      if (a === '--argjson') {
        try {
          const docs = parseJsonStream(v)
          vars[k] = docs.length > 0 ? docs[0] : null
        } catch {
          ctx.err('jq: invalid JSON text passed to --argjson\n')
          return 2
        }
      } else {
        vars[k] = v
      }
    } else if (a === '--') {
      i++
      break
    } else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`jq: unknown option ${a}\n`)
      return 2
    } else break
  }
  if (i >= args.length) {
    ctx.err('jq: missing filter\n')
    return 2
  }
  const program = args[i++]
  const files = args.slice(i)
  const sources: { name: string; text: string }[] = []
  if (!opts.nullInput) {
    if (files.length > 0) {
      for (const f of files) {
        try {
          sources.push({ name: f, text: ctx.fs.readFile(ctx.resolve(f)) })
        } catch (e) {
          ctx.err(`jq: ${f}: ${e instanceof FsError ? e.reason : 'No such file or directory'}\n`)
          return 2
        }
      }
    } else {
      sources.push({ name: '<stdin>', text: await ctx.stdin.readAll() })
    }
  }
  const r = runJq(program, sources, opts, ctx.env, vars, ctx.signal)
  if (r.err) ctx.err(r.err)
  if (r.out) ctx.out(r.out)
  return r.status
}

// ---- figlet / toilet / banner -----------------------------------------------------------------------

function figletArgs(ctx: CmdCtx): { width: number; text: string } {
  let width = ctx.io.size().cols || 80
  const words: string[] = []
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i]
    if (a === '-f') i++
    else if (a === '-w') {
      const n = Number(ctx.args[++i])
      if (Number.isFinite(n) && n > 0) width = Math.floor(n)
    } else if (a.startsWith('-') && a.length > 1) continue
    else words.push(a)
  }
  return { width, text: words.join(' ') }
}

const figlet: Cmd = async (ctx) => {
  if (usage(ctx, 'figlet')) return 0
  const { width, text } = figletArgs(ctx)
  const input = text.length > 0 ? text : await ctx.stdin.readAll()
  ctx.out(figletText(input.replace(/\s+$/, ''), width))
  return 0
}

const toilet: Cmd = async (ctx) => {
  if (usage(ctx, 'toilet')) return 0
  const { width, text } = figletArgs(ctx)
  const input = text.length > 0 ? text : await ctx.stdin.readAll()
  ctx.out(figletText(input.replace(/\s+$/, ''), width))
  return 0
}

const banner: Cmd = async (ctx) => {
  if (usage(ctx, 'banner')) return 0
  const text = ctx.args.filter((a) => !a.startsWith('-')).join(' ')
  const input = text.length > 0 ? text : await ctx.stdin.readAll()
  ctx.out(bannerText(input.replace(/\s+$/, ''), ctx.io.size().cols || 132))
  return 0
}

// ---- cowsay / cowthink -------------------------------------------------------------------------------

const EYE_MODES: Record<string, string> = {
  b: '==', d: 'xx', g: '$$', p: '@@', s: '**', t: '--', w: 'OO', y: '..',
}

interface CowOpts {
  cow: string
  eyes: string
  tongue: string
  wrap: number
  think: boolean
}

function wrapWords(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let w of words) {
    while (w.length > width && width > 0) {
      if (cur) { lines.push(cur); cur = '' }
      lines.push(w.slice(0, width))
      w = w.slice(width)
    }
    if (cur === '') cur = w
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur !== '') lines.push(cur)
  return lines.length > 0 ? lines : ['']
}

function balloon(lines: string[], think: boolean): string[] {
  const w = Math.max(...lines.map((l) => l.length))
  const out: string[] = [' ' + '_'.repeat(w + 2)]
  if (lines.length === 1) {
    out.push((think ? '( ' : '< ') + lines[0] + (think ? ' )' : ' >'))
  } else {
    for (let i = 0; i < lines.length; i++) {
      const left = i === 0 ? '/' : i === lines.length - 1 ? '\\' : '|'
      const right = i === 0 ? '\\' : i === lines.length - 1 ? '/' : '|'
      out.push(left + ' ' + lines[i].padEnd(w) + ' ' + right)
    }
  }
  out.push(' ' + '-'.repeat(w + 2))
  return out
}

function renderCow(input: string, o: CowOpts): string {
  const lines = wrapWords(input, o.wrap)
  const top = balloon(lines, o.think)
  const art = COWS[o.cow] ?? COWS['default']
  const eye1 = o.eyes[0] ?? 'o'
  const eye2 = o.eyes[1] ?? 'o'
  const say = o.think ? 'o' : '\\'
  const cow = art
    .split('$thoughts').join(say)
    .split('$eyes').join(eye1 + eye2)
    .split('$eye').join(eye1)
    .split('$tongue').join(o.tongue)
  return top.join('\n') + '\n' + cow + '\n'
}

function cowArgs(ctx: CmdCtx, think: boolean): { input: string; opts: CowOpts } {
  const opts: CowOpts = { cow: 'default', eyes: 'oo', tongue: '  ', wrap: 40, think }
  const words: string[] = []
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i]
    if (a === '-f') opts.cow = ctx.args[++i] ?? 'default'
    else if (a === '-e') opts.eyes = (ctx.args[++i] ?? 'oo').slice(0, 2)
    else if (a === '-T') opts.tongue = ctx.args[++i] ?? '  '
    else if (a === '-W') {
      const n = Number(ctx.args[++i])
      if (Number.isFinite(n) && n > 0) opts.wrap = Math.floor(n)
    } else if (a.length === 2 && a[0] === '-' && EYE_MODES[a[1]]) opts.eyes = EYE_MODES[a[1]]
    else if (a.startsWith('-') && a.length > 1) continue
    else words.push(a)
  }
  if (opts.eyes.length < 2) opts.eyes = opts.eyes.padEnd(2, ' ')
  return { input: words.join(' '), opts }
}

const cowsay: Cmd = async (ctx) => {
  if (usage(ctx, 'cowsay')) return 0
  const { input, opts } = cowArgs(ctx, false)
  const text = input.length > 0 ? input : await ctx.stdin.readAll()
  ctx.out(renderCow(text.replace(/\s+$/, ''), opts))
  return 0
}

const cowthink: Cmd = async (ctx) => {
  if (usage(ctx, 'cowthink')) return 0
  const { input, opts } = cowArgs(ctx, true)
  const text = input.length > 0 ? input : await ctx.stdin.readAll()
  ctx.out(renderCow(text.replace(/\s+$/, ''), opts))
  return 0
}

// ---- fortune / lolcat / sl / cmatrix ----------------------------------------------------------------

const fortune: Cmd = (ctx) => {
  if (usage(ctx, 'fortune')) return 0
  const list = ctx.args.includes('-s') ? FORTUNES_SHORT : FORTUNES
  ctx.out(list[Math.floor(Math.random() * list.length)] + '\n')
  return 0
}

const lolcat: Cmd = async (ctx) => {
  const files = ctx.args.filter((a) => a !== '-a' && !a.startsWith('-'))
  let text = ''
  if (files.length === 0) {
    text = await ctx.stdin.readAll()
  } else {
    let allFiles = true
    for (const f of files) {
      if (!ctx.fs.isFile(ctx.resolve(f))) {
        allFiles = false
        break
      }
    }
    if (allFiles) {
      for (const f of files) {
        try {
          text += ctx.fs.readFile(ctx.resolve(f))
        } catch {
          ctx.err(`lolcat: ${f}: No such file or directory\n`)
          return 1
        }
      }
    } else {
      text = files.join(' ')
    }
  }
  if (!ctx.isTTYOut) {
    ctx.out(text)
    return 0
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (let li = 0; li < lines.length; li++) {
    let s = ''
    for (let ci = 0; ci < lines[li].length; ci++) {
      const col = (li * 6 + ci * 2 + 40) % 256
      s += `\x1b[38;5;${col}m` + lines[li][ci]
    }
    out.push(s)
  }
  ctx.out(out.join('\n') + '\x1b[0m\n')
  return 0
}

const SL_TRAIN = [
  '                     (@) (@)',
  '        ==+===      ______|_',
  '        ||  | |    [____|___]',
  '   oo===+==+==oo    OO-----OO',
  '  o_____________________o',
]

const sl: Cmd = (ctx) => {
  if (usage(ctx, 'sl')) return 0
  ctx.out(SL_TRAIN.join('\n') + '\n')
  ctx.out('You meant ls. Anyway.\n')
  return 0
}

const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
const LATIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const cmatrix: Cmd = (ctx) => {
  if (usage(ctx, 'cmatrix')) return 0
  const cols = ctx.io.size().cols || 80
  const pool = KATAKANA + LATIN
  const out: string[] = []
  for (let r = 0; r < 14; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) line += pool[Math.floor(Math.random() * pool.length)]
    out.push(line)
  }
  ctx.out('\x1b[32m' + out.join('\n') + '\n\x1b[0m')
  return 0
}

// ---- neofetch / screenfetch -------------------------------------------------------------------------

const PENGUIN = [
  '   .--.   ',
  '  |o_o |  ',
  '  |:_/ |  ',
  ' //   \\ \\ ',
  '(|     | )',
  "/'\\_   _/`\\",
  '\\___)=(___/',
]

const PIXEL_X = [
  '##....##',
  '.##..##.',
  '..####..',
  '...##...',
  '..####..',
  '.##..##.',
  '##....##',
]

function memMiB(): { used: number; total: number } {
  const perf = globalThis.performance as unknown as { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }
  if (perf && perf.memory && typeof perf.memory.usedJSHeapSize === 'number') {
    const used = Math.max(1, Math.round(perf.memory.usedJSHeapSize / 1048576))
    const total = typeof perf.memory.jsHeapSizeLimit === 'number' && perf.memory.jsHeapSizeLimit > 0
      ? Math.max(used, Math.round(perf.memory.jsHeapSizeLimit / 1048576))
      : 4096
    return { used, total }
  }
  return { used: 512, total: 4096 }
}

function fetchInfo(ctx: CmdCtx, kind: 'neo' | 'screen'): void {
  const { cols, rows } = ctx.io.size()
  const mins = Math.max(0, Math.floor((Date.now() - PAGE_LOAD_AT) / 60000))
  const mem = memMiB()
  const infoLines = [
    'guest@ahmed',
    '----------------',
    'OS: ahmed-os 1.0 (in your browser)',
    'Host: ahmedyhussain.com',
    'Kernel: 6.8.0-ahmed',
    `Uptime: ${mins} mins`,
    'Packages: 90 (bash-js)',
    'Shell: bash 5.2',
    `Resolution: ${cols}x${rows} chars`,
    'Terminal: the monitor on the desk',
    'CPU: 1x imagination',
    `Memory: ${mem.used} MiB / ${mem.total} MiB`,
  ]
  const logo = kind === 'neo' ? PENGUIN : PIXEL_X
  const plainWidth = Math.max(...logo.map((l) => l.length))
  const tty = ctx.isTTYOut
  let out = ''
  const rowsCount = Math.max(logo.length, infoLines.length)
  for (let i = 0; i < rowsCount; i++) {
    let left = (logo[i] ?? '').padEnd(plainWidth)
    if (tty && kind === 'screen') {
      left = left.split('#').join('\x1b[31m#\x1b[0m').split('.').join('\x1b[37m.\x1b[0m')
    }
    out += left + '  ' + (infoLines[i] ?? '') + '\n'
  }
  if (tty) {
    let blocks = ''
    for (const base of [40, 100]) {
      for (let c = 0; c < 8; c++) blocks += `\x1b[${base + c}m   \x1b[0m`
      blocks += '\n'
    }
    out += blocks
  }
  ctx.out(out)
}

const neofetch: Cmd = (ctx) => {
  if (usage(ctx, 'neofetch')) return 0
  fetchInfo(ctx, 'neo')
  return 0
}

const screenfetch: Cmd = (ctx) => {
  if (usage(ctx, 'screenfetch')) return 0
  fetchInfo(ctx, 'screen')
  return 0
}

// ---- emacs -------------------------------------------------------------------------------------------

const emacs: Cmd = (ctx) => {
  ctx.err("emacs: this is a vim/nano household. Try 'nano' or 'vim'.\n")
  return 1
}

const withHelp = (name: string, fn: Cmd): Cmd => (ctx) => {
  if (usage(ctx, name)) return 0
  return fn(ctx)
}

export const commands: Record<string, Cmd> = {
  expr,
  bc,
  factor,
  jq,
  tar: withHelp('tar', runTar),
  zip: withHelp('zip', runZip),
  unzip: withHelp('unzip', runUnzip),
  gzip: withHelp('gzip', (ctx) => runGzip(ctx, false)),
  gunzip: withHelp('gunzip', (ctx) => runGzip(ctx, true)),
  zcat: withHelp('zcat', runZcat),
  figlet,
  toilet,
  banner,
  cowsay,
  cowthink,
  fortune,
  lolcat,
  sl,
  cmatrix,
  neofetch,
  screenfetch,
  emacs,
}
