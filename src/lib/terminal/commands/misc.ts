// system, utility and fun commands (misc scope). Thin editor launchers delegate to ctx.io.edit.
import type { Cmd, CmdCtx, CmdInfo, ExecResult } from '../types'
import { VFS, FsError } from '../vfs'
import { HOME } from '../seed'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// stable PIDs for this page session
const BASH_PID = 1200 + (Math.floor(performance.now() / 1000) % 400)
const SELF_PID = BASH_PID + 1
const PAGE_LOAD = Date.now() - performance.now()
let pagerSeq = 0
let sfxOn = false

const MEM = [8042044, 1024000, 5012044, 12345, 2006000, 6012044]
const SWAP = [2097148, 0, 2097148]

export const info: Record<string, CmdInfo> = {
  nano: { summary: 'text editor', usage: 'nano [+LINE] [-l] [file]' },
  pico: { summary: 'text editor (nano alias)', usage: 'pico [+LINE] [-l] [file]' },
  edit: { summary: 'text editor (nano alias)', usage: 'edit [+LINE] [-l] [file]' },
  vim: { summary: 'vi improved text editor', usage: 'vim [file]' },
  vi: { summary: 'visual text editor', usage: 'vi [file]' },
  nvim: { summary: 'vim text editor', usage: 'nvim [file]' },
  view: { summary: 'vim in read-only mode', usage: 'view [file]' },
  ex: { summary: 'line editor (vim mode)', usage: 'ex [file]' },
  less: { summary: 'opposite of more', usage: 'less [file]' },
  more: { summary: 'file perusal filter', usage: 'more [file]' },
  most: { summary: 'pager', usage: 'most [file]' },
  whoami: { summary: 'print effective user name', usage: 'whoami' },
  id: { summary: 'print user identity', usage: 'id [OPTION]...' },
  groups: { summary: 'print group memberships', usage: 'groups [user]' },
  hostname: { summary: 'show the system host name', usage: 'hostname' },
  uname: { summary: 'print system information', usage: 'uname [OPTION]...' },
  uptime: { summary: 'tell how long the system has been running', usage: 'uptime' },
  date: { summary: 'print or set the system date and time', usage: 'date [OPTION]... [+FORMAT]' },
  cal: { summary: 'display a calendar', usage: 'cal [MONTH] [YEAR]' },
  env: { summary: 'run a program in a modified environment', usage: 'env [OPTION]... [-] [NAME=VALUE]... [COMMAND [ARG]...]' },
  printenv: { summary: 'print environment variables', usage: 'printenv [VARIABLE]...' },
  free: { summary: 'display amount of free and used memory', usage: 'free [-h|-m]' },
  ps: { summary: 'report process status', usage: 'ps [aux|-ef]' },
  top: { summary: 'display tasks and system status', usage: 'top' },
  htop: { summary: 'interactive process viewer (snapshot)', usage: 'htop' },
  kill: { summary: 'terminate a process', usage: 'kill [-l] [pid]' },
  pgrep: { summary: 'look up processes by name', usage: 'pgrep [pattern]' },
  pkill: { summary: 'signal processes by name', usage: 'pkill [pattern]' },
  nproc: { summary: 'print the number of processors', usage: 'nproc' },
  arch: { summary: 'print machine architecture', usage: 'arch' },
  lscpu: { summary: 'display CPU architecture information', usage: 'lscpu' },
  lsb_release: { summary: 'print distribution-specific information', usage: 'lsb_release -a' },
  tty: { summary: 'print the file name of the terminal', usage: 'tty' },
  w: { summary: 'show who is logged on and what they are doing', usage: 'w' },
  who: { summary: 'show who is logged on', usage: 'who' },
  last: { summary: 'show listing of last logged in users', usage: 'last' },
  locale: { summary: 'get locale-specific information', usage: 'locale' },
  dmesg: { summary: 'print kernel ring buffer messages', usage: 'dmesg' },
  systemctl: { summary: 'control the systemd system', usage: 'systemctl [command]' },
  service: { summary: 'run a System V init script', usage: 'service [name] [command]' },
  lsof: { summary: 'list open files', usage: 'lsof' },
  netstat: { summary: 'print network connections', usage: 'netstat' },
  ifconfig: { summary: 'configure a network interface', usage: 'ifconfig' },
  ip: { summary: 'show / manipulate routing and devices', usage: 'ip [addr|route|link]' },
  ping: { summary: 'send ICMP ECHO_REQUEST to network hosts', usage: 'ping [-c N] host' },
  curl: { summary: 'transfer a URL', usage: 'curl [-V] [url]' },
  wget: { summary: 'retrieve files from the web', usage: 'wget [url]' },
  ssh: { summary: 'OpenSSH remote login client', usage: 'ssh [host]' },
  scp: { summary: 'secure copy (remote file copy)', usage: 'scp [host:]file' },
  sftp: { summary: 'secure file transfer program', usage: 'sftp [host]' },
  git: { summary: 'the stupid content tracker (sandbox subset)', usage: 'git [--version|init|status]' },
  apt: { summary: 'package manager (read-only sandbox)', usage: 'apt [command]' },
  'apt-get': { summary: 'package manager (read-only sandbox)', usage: 'apt-get [command]' },
  sudo: { summary: 'execute a command as another user', usage: 'sudo [-l|-v|command]' },
  su: { summary: 'run a command with substitute user', usage: 'su [-]' },
  passwd: { summary: 'update user authentication tokens', usage: 'passwd' },
  chsh: { summary: 'change login shell', usage: 'chsh' },
  reboot: { summary: 'reboot the machine (not really)', usage: 'reboot' },
  shutdown: { summary: 'power off the machine (not really)', usage: 'shutdown' },
  halt: { summary: 'halt the machine (not really)', usage: 'halt' },
  poweroff: { summary: 'power off the machine (not really)', usage: 'poweroff' },
  mount: { summary: 'mount a filesystem', usage: 'mount' },
  umount: { summary: 'unmount a filesystem', usage: 'umount [target]' },
  crontab: { summary: 'maintain crontab files', usage: 'crontab [-l]' },
  at: { summary: 'queue jobs for later execution', usage: 'at [time]' },
  sleep: { summary: 'delay for a specified amount of time', usage: 'sleep NUMBER[smhd]...' },
  yes: { summary: 'output a string repeatedly', usage: 'yes [STRING]...' },
  clear: { summary: 'clear the terminal screen', usage: 'clear' },
  reset: { summary: 'reset the terminal', usage: 'reset' },
  tput: { summary: 'query terminal capabilities', usage: 'tput CAP [args]' },
  stty: { summary: 'change and print terminal line settings', usage: 'stty size' },
  timeout: { summary: 'run a command with a time limit', usage: 'timeout DURATION COMMAND [ARG]...' },
  watch: { summary: 'execute a program periodically', usage: 'watch [-n SECONDS] COMMAND' },
  'xdg-open': { summary: 'open a file or URL using the default application', usage: 'xdg-open [url]' },
  open: { summary: 'open a file or URL', usage: 'open [url]' },
  dig: { summary: 'DNS lookup utility', usage: 'dig [name]' },
  nslookup: { summary: 'query Internet name servers', usage: 'nslookup [name]' },
  host: { summary: 'DNS lookup utility', usage: 'host [name]' },
  screen: { summary: 'screen manager with terminal emulation', usage: 'screen' },
  tmux: { summary: 'terminal multiplexer', usage: 'tmux' },
  whereis: { summary: 'locate the binary, source, and manual for a command', usage: 'whereis [name]...' },
  apropos: { summary: 'search the manual page names and descriptions', usage: 'apropos [keyword]' },
  whatis: { summary: 'display one-line manual page descriptions', usage: 'whatis [name]...' },
  compgen: { summary: 'display possible completions', usage: 'compgen -c' },
  logname: { summary: 'print the login name', usage: 'logname' },
  users: { summary: 'print the user names of users currently logged in', usage: 'users' },
  mesg: { summary: 'display if messages can be written to the terminal', usage: 'mesg' },
  lsblk: { summary: 'list block devices', usage: 'lsblk' },
  fdisk: { summary: 'manipulate disk partition table', usage: 'fdisk [device]' },
  mkfs: { summary: 'build a Linux filesystem', usage: 'mkfs [device]' },
  changelog: { summary: 'print ~/changelog.txt', usage: 'changelog' },
  sfx: { summary: 'toggle terminal sound effects', usage: 'sfx on|off|status' },
  clock: { summary: 'print the current date and time', usage: 'clock' },
  download: { summary: 'download files to the browser', usage: 'download FILE...' },
  dl: { summary: 'download files to the browser', usage: 'dl FILE...' },
}

// ---- small helpers --------------------------------------------------------------------------------

function helpOut(ctx: CmdCtx, name: string): number {
  const i = info[name]
  ctx.out((i ? i.usage : `Usage: ${name}`) + '\n')
  return 0
}

function pad2(n: number): string { return String(n).padStart(2, '0') }

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) { resolve(); return }
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    const onAbort = () => { clearTimeout(t); resolve() }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function uptimeMinutes(): number {
  return Math.max(0, Math.floor((Date.now() - PAGE_LOAD) / 60000))
}

function parseDuration(s: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(s)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  const mult: Record<string, number> = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }
  return n * (mult[m[2] ?? ''] ?? 1)
}

function tzAbbr(d: Date, utc: boolean): string {
  if (utc) return 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d)
    const p = parts.find((x) => x.type === 'timeZoneName')
    return p ? p.value : 'UTC'
  } catch { return 'UTC' }
}

function tzOffset(d: Date, utc: boolean): string {
  const off = utc ? 0 : -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  return sign + pad2(Math.floor(a / 60)) + pad2(a % 60)
}

function weekOfYearU(d: Date, utc: boolean): string {
  const y = utc ? d.getUTCFullYear() : d.getFullYear()
  const firstSunday = new Date(Date.UTC(y, 0, 1 + ((7 - new Date(Date.UTC(y, 0, 1)).getUTCDay()) % 7)))
  const t = Date.UTC(y, utc ? d.getUTCMonth() : d.getMonth(), utc ? d.getUTCDate() : d.getDate())
  if (t < firstSunday.getTime()) return '00'
  return String(1 + Math.floor((t - firstSunday.getTime()) / 604800000)).padStart(2, '0')
}

function dayOfYear(d: Date, utc: boolean): string {
  const y = utc ? d.getUTCFullYear() : d.getFullYear()
  const start = Date.UTC(y, 0, 1)
  const t = Date.UTC(y, utc ? d.getUTCMonth() : d.getMonth(), utc ? d.getUTCDate() : d.getDate())
  return String(Math.floor((t - start) / 86400000) + 1).padStart(3, '0')
}

function formatDate(d: Date, fmt: string, utc: boolean): string {
  const Y = utc ? d.getUTCFullYear() : d.getFullYear()
  const M = (utc ? d.getUTCMonth() : d.getMonth()) + 1
  const D = utc ? d.getUTCDate() : d.getDate()
  const h = utc ? d.getUTCHours() : d.getHours()
  const mi = utc ? d.getUTCMinutes() : d.getMinutes()
  const s = utc ? d.getUTCSeconds() : d.getSeconds()
  const dow = utc ? d.getUTCDay() : d.getDay()
  let out = ''
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i]
    if (c !== '%') { out += c; continue }
    const k = fmt[++i]
    if (k === undefined) { out += '%'; break }
    switch (k) {
      case '%': out += '%'; break
      case 'Y': out += String(Y); break
      case 'y': out += pad2(Y % 100); break
      case 'm': out += pad2(M); break
      case 'd': out += pad2(D); break
      case 'e': out += String(D).padStart(2); break
      case 'H': out += pad2(h); break
      case 'M': out += pad2(mi); break
      case 'S': out += pad2(s); break
      case 'a': out += DAYS[dow]; break
      case 'A': out += DAYS_FULL[dow]; break
      case 'b': out += MONTHS[M - 1]; break
      case 'B': out += MONTHS_FULL[M - 1]; break
      case 'p': out += h < 12 ? 'AM' : 'PM'; break
      case 'I': out += pad2(h % 12 || 12); break
      case 'Z': out += tzAbbr(d, utc); break
      case 'z': out += tzOffset(d, utc); break
      case 's': out += String(Math.floor(d.getTime() / 1000)); break
      case 'F': out += `${Y}-${pad2(M)}-${pad2(D)}`; break
      case 'T': out += `${pad2(h)}:${pad2(mi)}:${pad2(s)}`; break
      case 'D': out += `${pad2(M)}/${pad2(D)}/${pad2(Y % 100)}`; break
      case 'R': out += `${pad2(h)}:${pad2(mi)}`; break
      case 'u': out += String(dow || 7); break
      case 'w': out += String(dow); break
      case 'U': out += weekOfYearU(d, utc); break
      case 'j': out += dayOfYear(d, utc); break
      case 'n': out += '\n'; break
      case 't': out += '\t'; break
      default: out += '%' + k
    }
  }
  return out
}

function mkDate(y: number, mo: number, d: number, h: number, mi: number, s: number, utc: boolean): Date {
  return utc ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s)
}

function parseDateSpec(spec: string, utc: boolean): Date | null {
  const s = spec.trim()
  if (s === 'now') return new Date()
  if (s === 'tomorrow') return new Date(Date.now() + 86400000)
  if (s === 'yesterday') return new Date(Date.now() - 86400000)
  if (s.startsWith('@')) {
    const n = Number(s.slice(1))
    return Number.isFinite(n) ? new Date(n * 1000) : null
  }
  const daysAgo = /^(\d+)\s+days?\s+ago$/.exec(s)
  if (daysAgo) return new Date(Date.now() - Number(daysAgo[1]) * 86400000)
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
  if (!m) return null
  const [, ys, ms, ds, hs, mis, ss] = m
  const mo = Number(ms) - 1
  if (mo < 0 || mo > 11 || Number(ds) < 1 || Number(ds) > 31) return null
  const hh = hs !== undefined ? Number(hs) : 0
  const mm = mis !== undefined ? Number(mis) : 0
  const sec = ss !== undefined ? Number(ss) : 0
  if (hh > 23 || mm > 59 || sec > 59) return null
  return mkDate(Number(ys), mo, Number(ds), hh, mm, sec, utc)
}

// ---- calendar --------------------------------------------------------------------------------------

function monthBlockLines(year: number, month: number, mondayFirst: boolean, hlDay: number | null): string[] {
  const title = MONTHS_FULL[month - 1] + ' ' + year
  const padL = Math.floor((20 - title.length) / 2)
  const header = (mondayFirst ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).join(' ')
  const firstDow = new Date(year, month - 1, 1).getDay()
  const offset = mondayFirst ? (firstDow + 6) % 7 : firstDow
  const dim = new Date(year, month, 0).getDate()
  const rows: string[] = []
  let day = 1
  for (let r = 0; day <= dim; r++) {
    const cells: string[] = []
    for (let i = 0; i < 7; i++) {
      if (r === 0 && i < offset) cells.push('  ')
      else if (day > dim) cells.push('  ')
      else {
        const n = day++
        cells.push(hlDay === n ? `\x1b[7m${String(n).padStart(2)}\x1b[0m` : String(n).padStart(2))
      }
    }
    rows.push(cells.join(' '))
  }
  return [' '.repeat(padL) + title, header, ...rows]
}

function monthTrio(year: number, month: number): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = []
  for (const delta of [-1, 0, 1]) {
    let m = month + delta
    let y = year
    if (m < 1) { m += 12; y-- }
    if (m > 12) { m -= 12; y++ }
    out.push({ y, m })
  }
  return out
}

function printMonth(ctx: CmdCtx, year: number, month: number, mondayFirst: boolean, today: { y: number; m: number; d: number }, hl: boolean): void {
  const hlDay = hl && today.y === year && today.m === month ? today.d : null
  const lines = monthBlockLines(year, month, mondayFirst, hlDay)
  ctx.out(lines.map((l) => l.trimEnd()).join('\n') + '\n')
}

function printBlocks(ctx: CmdCtx, blocks: string[][]): void {
  for (let li = 0; li < 8; li++) {
    ctx.out(blocks.map((b) => (b[li] ?? '').padEnd(20)).join('  ').trimEnd() + '\n')
  }
}

function printThree(ctx: CmdCtx, year: number, month: number, mondayFirst: boolean, today: { y: number; m: number; d: number }, hl: boolean): void {
  const blocks = monthTrio(year, month).map((t) => {
    const hlDay = hl && today.y === t.y && today.m === t.m ? today.d : null
    return monthBlockLines(t.y, t.m, mondayFirst, hlDay)
  })
  printBlocks(ctx, blocks)
}

function printYear(ctx: CmdCtx, year: number, mondayFirst: boolean, today: { y: number; m: number; d: number }, hl: boolean): void {
  const title = String(year)
  ctx.out(' '.repeat(Math.floor((64 - title.length) / 2)) + title + '\n')
  for (let row = 0; row < 4; row++) {
    const blocks = [0, 1, 2].map((i) => {
      const m = row * 3 + i + 1
      const hlDay = hl && today.y === year && today.m === m ? today.d : null
      return monthBlockLines(year, m, mondayFirst, hlDay)
    })
    printBlocks(ctx, blocks)
  }
}

// ---- env helpers -----------------------------------------------------------------------------------

async function runWithEnv(ctx: CmdCtx, target: Record<string, string>, argv: string[]): Promise<number> {
  const base = ctx.env
  const saved = new Map<string, string | undefined>()
  const original = new Set(Object.keys(base))
  let mutated = false
  try {
    for (const k of original) { saved.set(k, base[k]); if (!(k in target)) delete base[k] }
    for (const [k, v] of Object.entries(target)) base[k] = v
    mutated = true
  } catch { /* frozen env: run with whatever the shell provides */ }
  try {
    const r = await ctx.exec(argv)
    if (r.out) ctx.out(r.out)
    if (r.err) ctx.err(r.err)
    return r.status
  } finally {
    if (mutated) {
      try {
        for (const k of Object.keys(base)) if (!original.has(k)) delete base[k]
        for (const [k, v] of saved) { if (v === undefined) delete base[k]; else base[k] = v }
      } catch { /* ignore */ }
    }
  }
}

// ---- editors / pagers ------------------------------------------------------------------------------

async function nanoCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, ctx.argv0)
  let lineNumbers = false
  let file: string | undefined
  for (const a of args) {
    if (a === '-l' || a === '--linenumbers') { lineNumbers = true; continue }
    if (/^\+\d+$/.test(a)) continue
    if (a.startsWith('-')) { ctx.err(`nano: invalid option -- '${a.length > 1 ? a[1] : a}'\n`); return 1 }
    file = a
  }
  const abs = file !== undefined ? ctx.resolve(file) : ''
  if (abs !== '' && ctx.fs.isDir(abs)) {
    ctx.err(`Error reading ${file}: Is a directory\n`)
    return 1
  }
  await ctx.io.edit('nano', abs, { lineNumbers })
  return 0
}

function vimLike(name: string, readOnly: boolean): Cmd {
  return async (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    const file = ctx.args.find((a) => !a.startsWith('-'))
    const abs = file !== undefined ? ctx.resolve(file) : ''
    await ctx.io.edit('vim', abs, { readOnly })
    return 0
  }
}

function pagerLike(name: string): Cmd {
  return async (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    const file = ctx.args.find((a) => !a.startsWith('-'))
    if (!ctx.isTTYOut) {
      if (file !== undefined) {
        const abs = ctx.resolve(file)
        try {
          const data = ctx.fs.readFile(abs)
          ctx.out(data.endsWith('\n') ? data : data + '\n')
          return 0
        } catch (e) {
          if (e instanceof FsError) { ctx.err(`${name}: ${file}: ${e.reason}\n`); return 1 }
          throw e
        }
      }
      ctx.out(await ctx.stdin.readAll())
      return 0
    }
    let path = ''
    let tmp = ''
    if (file !== undefined) {
      const abs = ctx.resolve(file)
      if (!ctx.fs.exists(abs)) { ctx.err(`${name}: ${file}: No such file or directory\n`); return 1 }
      if (ctx.fs.isDir(abs)) { ctx.err(`${name}: ${file}: Is a directory\n`); return 1 }
      path = abs
    } else if (ctx.stdin.data !== '') {
      tmp = `/tmp/.pager-${Date.now()}-${pagerSeq++}`
      ctx.fs.writeFile(tmp, ctx.stdin.data)
      path = tmp
    }
    try {
      await ctx.io.edit('less', path, { readOnly: true })
      return 0
    } finally {
      if (tmp) { try { ctx.fs.remove(tmp) } catch { /* already gone */ } }
    }
  }
}

// ---- info commands ---------------------------------------------------------------------------------

function whoamiCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'whoami')
  ctx.out('guest\n')
  return 0
}

function idCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'id')
  const flags: string[] = []
  for (const a of args) {
    if (a.startsWith('-') && a.length > 1) { for (const c of a.slice(1)) flags.push(c); continue }
    ctx.err(`id: extra operand '${a}'\n`)
    return 1
  }
  if (flags.length === 0) {
    ctx.out('uid=1000(guest) gid=1000(guest) groups=1000(guest)\n')
    return 0
  }
  const name = flags.includes('n')
  const sel = flags.filter((f) => f === 'u' || f === 'g' || f === 'G')
  if (sel.length === 0) {
    ctx.out(name ? 'guest\n' : 'uid=1000(guest) gid=1000(guest) groups=1000(guest)\n')
    return 0
  }
  ctx.out(sel.map(() => (name ? 'guest' : '1000')).join(' ') + '\n')
  return 0
}

function groupsCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'groups')
  if (args.length === 0) { ctx.out('guest\n'); return 0 }
  let status = 0
  for (const a of args) {
    if (a === 'guest') ctx.out('guest : guest\n')
    else { ctx.err(`groups: '${a}': no such user\n`); status = 1 }
  }
  return status
}

function hostnameCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'hostname')
  ctx.out('ahmed\n')
  return 0
}

function unameCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'uname')
  if (args.includes('--version')) { ctx.out('uname (GNU coreutils) 8.32\n'); return 0 }
  if (args.length === 0) { ctx.out('Linux\n'); return 0 }
  const map: Record<string, string> = {
    a: 'Linux ahmed 6.8.0-ahmed #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux',
    s: 'Linux', n: 'ahmed', r: '6.8.0-ahmed', v: '#1 SMP PREEMPT_DYNAMIC', m: 'x86_64', o: 'GNU/Linux',
  }
  const parts: string[] = []
  for (const a of args) {
    if (a.startsWith('-') && a.length > 1) {
      for (const c of a.slice(1)) {
        const v = map[c]
        if (v === undefined) { ctx.err(`uname: invalid option -- '${c}'\n`); return 1 }
        parts.push(v)
      }
    } else { ctx.err(`uname: extra operand '${a}'\n`); return 1 }
  }
  ctx.out(parts.join(' ') + '\n')
  return 0
}

function uptimeCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'uptime')
  const t = formatDate(new Date(), '%H:%M:%S', false).padStart(8)
  ctx.out(`${t} up ${uptimeMinutes()} min,  1 user,  load average: 0.00, 0.01, 0.05\n`)
  return 0
}

async function dateCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'date')
  if (args.includes('--version')) { ctx.out('date (GNU coreutils) 8.32\n'); return 0 }
  let utc = false
  let fmt: string | null = null
  let spec: string | null = null
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-u' || a === '--utc' || a === '--universal') { utc = true; continue }
    if (a === '-I') { fmt = '%F'; continue }
    if (a === '-R') { fmt = '%a, %d %b %Y %H:%M:%S %z'; continue }
    if (a === '-d' || a === '--date') {
      if (i + 1 >= args.length) { ctx.err("date: option requires an argument -- 'd'\n"); return 1 }
      spec = args[++i]
      continue
    }
    if (a.startsWith('+')) { fmt = a.slice(1); continue }
    if (a.startsWith('-')) { ctx.err(`date: invalid option -- '${a[1]}'\n`); return 1 }
    ctx.err(`date: extra operand '${a}'\n`)
    return 1
  }
  let d = new Date()
  if (spec !== null) {
    const p = parseDateSpec(spec, utc)
    if (!p) { ctx.err(`date: invalid date '${spec}'\n`); return 1 }
    d = p
  }
  ctx.out(formatDate(d, fmt ?? '%a %b %e %H:%M:%S %Z %Y', utc) + '\n')
  return 0
}

function calCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'cal')
  let three = false
  let yearMode = false
  let monday = false
  const nums: number[] = []
  for (const a of args) {
    if (a.startsWith('-') && a !== '-') {
      for (const ch of a.slice(1)) {
        if (ch === '3') three = true
        else if (ch === 'y') yearMode = true
        else if (ch === 'm') monday = true
        else if (ch === 's') monday = false
        else { ctx.err(`cal: invalid option -- '${ch}'\n`); return 1 }
      }
    } else if (/^\d+$/.test(a)) nums.push(Number(a))
    else { ctx.err(`cal: ${a} is neither a month number (1..12) nor a name\n`); return 1 }
  }
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1
  const today = { y: cy, m: cm, d: now.getDate() }
  const hl = ctx.isTTYOut
  if (yearMode) {
    const y = nums[0] ?? cy
    if (y < 1 || y > 9999) { ctx.err(`cal: ${y} is not a year number (1..9999)\n`); return 1 }
    printYear(ctx, y, monday, today, hl)
    return 0
  }
  if (three) {
    if (nums.length > 2) { ctx.err('cal: too many arguments\n'); return 1 }
    const m = nums[0] ?? cm
    const y = nums[1] ?? cy
    if (m < 1 || m > 12) { ctx.err(`cal: ${m} is not a month number (1..12)\n`); return 1 }
    if (y < 1 || y > 9999) { ctx.err(`cal: ${y} is not a year number (1..9999)\n`); return 1 }
    printThree(ctx, y, m, monday, today, hl)
    return 0
  }
  if (nums.length === 0) { printMonth(ctx, cy, cm, monday, today, hl); return 0 }
  if (nums.length === 1) {
    const n = nums[0]
    if (n >= 1 && n <= 12) { printMonth(ctx, cy, n, monday, today, hl); return 0 }
    if (n < 1 || n > 9999) { ctx.err(`cal: ${n} is not a year number (1..9999)\n`); return 1 }
    printYear(ctx, n, monday, today, hl)
    return 0
  }
  if (nums.length === 2) {
    const [m, y] = nums
    if (m < 1 || m > 12) { ctx.err(`cal: ${m} is not a month number (1..12)\n`); return 1 }
    if (y < 1 || y > 9999) { ctx.err(`cal: ${y} is not a year number (1..9999)\n`); return 1 }
    printMonth(ctx, y, m, monday, today, hl)
    return 0
  }
  ctx.err('cal: too many arguments\n')
  return 1
}

async function envCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'env')
  if (args.includes('--version')) { ctx.out('env (GNU coreutils) 8.32\n'); return 0 }
  let clear = false
  const unset: string[] = []
  const assign: Record<string, string> = {}
  let i = 0
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '-i' || a === '--ignore-environment') { clear = true; continue }
    if (a === '-u' || a === '--unset') {
      const v = args[++i]
      if (v === undefined) { ctx.err("env: option requires an argument -- 'u'\n"); return 125 }
      unset.push(v)
      continue
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a)) {
      const eq = a.indexOf('=')
      assign[a.slice(0, eq)] = a.slice(eq + 1)
      continue
    }
    break
  }
  const base: Record<string, string> = clear ? {} : { ...ctx.env }
  for (const k of unset) delete base[k]
  Object.assign(base, assign)
  const cmdArgs = args.slice(i)
  if (cmdArgs.length === 0) {
    for (const k of Object.keys(base).sort()) ctx.out(`${k}=${base[k]}\n`)
    return 0
  }
  return runWithEnv(ctx, base, cmdArgs)
}

function printenvCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'printenv')
  if (args.includes('--version')) { ctx.out('printenv (GNU coreutils) 8.32\n'); return 0 }
  if (args.length === 0) {
    for (const k of Object.keys(ctx.env).sort()) ctx.out(`${k}=${ctx.env[k]}\n`)
    return 0
  }
  let status = 0
  for (const a of args) {
    if (a in ctx.env) ctx.out(ctx.env[a] + '\n')
    else status = 1
  }
  return status
}

function humanKB(n: number): string {
  if (n === 0) return '0B'
  if (n >= 1048576) return (n / 1048576).toFixed(1) + 'Gi'
  if (n >= 1024) return (n / 1024).toFixed(1) + 'Mi'
  return String(n)
}

function freeCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'free')
  let mode: 'kb' | 'm' | 'h' = 'kb'
  for (const a of args) {
    if (a === '-m') mode = 'm'
    else if (a === '-h' || a === '--human') mode = 'h'
    else if (a.startsWith('-')) { ctx.err(`free: invalid option -- '${a[1]}'\n`); return 1 }
  }
  const fmt = (n: number): string => mode === 'h' ? humanKB(n) : mode === 'm' ? String(Math.round(n / 1024)) : String(n)
  const head = '      ' + ['total', 'used', 'free', 'shared', 'buff/cache', 'available'].map((h) => h.padEnd(12)).join('')
  ctx.out(head + '\n')
  ctx.out('Mem:  ' + MEM.map((v) => fmt(v).padStart(12)).join('') + '\n')
  ctx.out('Swap: ' + SWAP.map((v) => fmt(v).padStart(12)).join('') + '\n')
  return 0
}

function psCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'ps')
  const now = formatDate(new Date(), '%H:%M', false)
  if (args.length === 0) {
    ctx.out('  PID TTY          TIME CMD\n')
    ctx.out(`${BASH_PID} pts/0    00:00:00 bash\n`)
    ctx.out(`${SELF_PID} pts/0    00:00:00 ps\n`)
    return 0
  }
  if (args[0] === 'aux') {
    ctx.out('USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n')
    ctx.out(`guest    ${BASH_PID}  0.0  0.2  18564  9216 pts/0    Ss   ${now}   0:00 bash\n`)
    ctx.out(`guest    ${SELF_PID}  0.0  0.1  10240  4096 pts/0    R+   ${now}   0:00 ps aux\n`)
    return 0
  }
  if (args[0] === '-ef') {
    ctx.out('UID        PID  PPID  C STIME TTY          TIME CMD\n')
    ctx.out(`guest    ${BASH_PID}     0  0 ${now} pts/0    00:00:00 bash\n`)
    ctx.out(`guest    ${SELF_PID}  ${BASH_PID}  0 ${now} pts/0    00:00:00 ps -ef\n`)
    return 0
  }
  ctx.err(`ps: unsupported option '${args[0]}'\n`)
  return 1
}

function topCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'top')
  const now = formatDate(new Date(), '%H:%M:%S', false)
  const up = uptimeMinutes()
  ctx.out(`top - ${now} up ${up} min,  1 user,  load average: 0.00, 0.01, 0.05\n`)
  ctx.out('Tasks: 2 total,   1 running,   1 sleeping,   0 stopped,   0 zombie\n')
  ctx.out('%Cpu(s):  1.2 us,  0.4 sy,  0.0 ni, 98.4 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st\n')
  ctx.out('MiB Mem :   7854.3 total,   4892.6 free,   1000.0 used,   3861.7 buff/cache\n')
  ctx.out('MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5861.4 avail Mem\n\n')
  ctx.out('  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n')
  ctx.out(`${BASH_PID} guest      20   0   18564   9216   8192 S   0.0   0.1   0:00.10 bash\n`)
  ctx.out(`${SELF_PID} guest      20   0   10240   4096   3072 R   0.0   0.0   0:00.03 top\n`)
  return 0
}

function htopCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'htop')
  ctx.out('  1 [|||                       3.1%] Tasks: 2, 1 thr; 1 running\n')
  ctx.out('  2 [                          0.0%]\n')
  ctx.out('  Mem[|||||||||||||||     1.0G/7.7G]\n')
  ctx.out('  Swp[                     0K/2.0G]\n\n')
  ctx.out('  PID USER      PRI  NI  VIRT   RES  SHR S CPU% MEM%   TIME+  Command\n')
  ctx.out(`${BASH_PID} guest      20   0 18564  9216 8192 S  0.0  0.1  0:00.10 bash\n`)
  ctx.out(`${SELF_PID} guest      20   0 10240  4096 3072 R  0.0  0.0  0:00.03 htop\n`)
  return 0
}

function killCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'kill')
  if (args.length === 0) {
    ctx.err('bash: kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n')
    return 2
  }
  if (args[0] === '-l') {
    ctx.out(SIGNAL_LIST)
    return 0
  }
  for (const a of args) {
    if (!/^\d+$/.test(a)) { ctx.err(`bash: kill: ${a}: arguments must be process or job IDs\n`); return 2 }
    ctx.err(`bash: kill: (${a}) - No such process\n`)
  }
  return 1
}

function pgrepCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'pgrep')
  return 1
}

function pkillCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'pkill')
  return 1
}

function nprocCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'nproc')
  ctx.out('4\n')
  return 0
}

function archCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'arch')
  ctx.out('x86_64\n')
  return 0
}

function lscpuCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'lscpu')
  ctx.out('Architecture:            x86_64\n')
  ctx.out('CPU(s):                  4\n')
  ctx.out('Model name:              Imagination CPU 1.0\n')
  ctx.out('CPU max MHz:             2800.0000\n')
  ctx.out('CPU min MHz:              400.0000\n')
  return 0
}

function lsbReleaseCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'lsb_release')
  if (args.length === 0 || args.includes('-a') || args.includes('--all')) {
    ctx.out('Distributor ID: ahmed-os\n')
    ctx.out('Description:    ahmed-os 1.0 (in your browser)\n')
    ctx.out('Release:        1.0\n')
    ctx.out('Codename:       browser\n')
    return 0
  }
  ctx.err('lsb_release: no such option\n')
  return 1
}

function ttyCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'tty')
  ctx.out('/dev/pts/0\n')
  return 0
}

function whoCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'who')
  const t = formatDate(new Date(), '%b %e %H:%M', false)
  ctx.out(`guest    pts/0        ${t} (browser)\n`)
  return 0
}

function wCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'w')
  const t = formatDate(new Date(), '%H:%M:%S', false).padStart(8)
  const login = formatDate(new Date(), '%H:%M', false)
  ctx.out(`${t} up ${uptimeMinutes()} min,  1 user,  load average: 0.00, 0.01, 0.05\n`)
  ctx.out('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\n')
  ctx.out(`guest    pts/0    browser          ${login}    0.00s  0.00s  0.00s bash\n`)
  return 0
}

function lastCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'last')
  const t = formatDate(new Date(), '%a %b %e %H:%M', false)
  ctx.out(`guest    pts/0        browser          ${t}   still logged in\n`)
  return 0
}

function localeCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'locale')
  ctx.out('LANG=C.UTF-8\n')
  ctx.out('LANGUAGE=\n')
  for (const v of ['CTYPE', 'NUMERIC', 'TIME', 'COLLATE', 'MONETARY', 'MESSAGES', 'PAPER', 'NAME', 'ADDRESS', 'TELEPHONE', 'MEASUREMENT', 'IDENTIFICATION']) {
    ctx.out(`LC_${v}="C.UTF-8"\n`)
  }
  ctx.out('LC_ALL=\n')
  return 0
}

function dmesgCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'dmesg')
  ctx.out('[    0.000000] Linux version 6.8.0-ahmed (guest@ahmed) (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC\n')
  ctx.out('[    0.102400] DMI: ahmed-os 1.0 / Imagination Board\n')
  ctx.out('[    1.204800] EXT4-fs (sda): mounted filesystem with ordered data mode\n')
  ctx.out('[    2.500000] random: crng init done\n')
  ctx.out('[    3.100000] input: Imaginary keyboard as /devices/virtual/input/input0\n')
  return 0
}

function systemctlCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'systemctl')
  ctx.err("System has not been booted with systemd as init system (PID 1). Can't operate.\n")
  return 1
}

function serviceCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'service')
  ctx.err("service: this system is not booted with systemd. Can't operate.\n")
  return 1
}

function lsofCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'lsof')
  ctx.out('COMMAND  PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n')
  ctx.out(`bash    ${BASH_PID} guest  cwd    DIR    0,8     4096    2 /home/guest\n`)
  ctx.out(`bash    ${BASH_PID} guest  txt    REG    0,8   102400    3 /usr/bin/bash\n`)
  return 0
}

function netstatCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'netstat')
  ctx.out('Active Internet connections (w/o servers)\n')
  ctx.out('Proto Recv-Q Send-Q Local Address           Foreign Address         State\n')
  ctx.out('tcp        0      0 10.0.0.2:45678          93.184.216.34:443       ESTABLISHED\n')
  ctx.out('Active UNIX domain sockets (w/o servers)\n')
  ctx.out('Proto RefCnt Flags       Type       State         I-Node   Path\n')
  ctx.out('unix  3      [ ]         STREAM     CONNECTED     12345\n')
  return 0
}

function ifconfigCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'ifconfig')
  ctx.out('eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n')
  ctx.out('        inet 10.0.0.2  netmask 255.255.255.0  broadcast 10.0.0.255\n')
  ctx.out('        inet6 fe80::1  prefixlen 64  scopeid 0x20<link>\n')
  ctx.out('        ether 02:42:ac:11:00:02  txqueuelen 1000  (Ethernet)\n')
  ctx.out('        RX packets 1234  bytes 567890 (567.8 KB)\n')
  ctx.out('        TX packets 567  bytes 89012 (89.0 KB)\n\n')
  ctx.out('lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n')
  ctx.out('        inet 127.0.0.1  netmask 255.0.0.0\n')
  ctx.out('        loop  txqueuelen 1000  (Local Loopback)\n')
  return 0
}

function ipCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'ip')
  const obj = args[0]
  if (obj === 'addr' || obj === 'a' || obj === 'address') {
    ctx.out('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n')
    ctx.out('    inet 127.0.0.1/8 scope host lo\n')
    ctx.out('       valid_lft forever preferred_lft forever\n')
    ctx.out('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n')
    ctx.out('    inet 10.0.0.2/24 brd 10.0.0.255 scope global dynamic eth0\n')
    ctx.out('       valid_lft forever preferred_lft forever\n')
    return 0
  }
  if (obj === 'route' || obj === 'r') {
    ctx.out('default via 10.0.0.1 dev eth0\n')
    ctx.out('10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.2\n')
    return 0
  }
  if (obj === 'link' || obj === 'l') {
    ctx.out('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n')
    ctx.out('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n')
    return 0
  }
  ctx.err('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n')
  return 1
}

function pseudoIp(host: string): string {
  let h = 0
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0
  return `93.${h % 256}.${(h >>> 8) % 256}.${(h >>> 16) % 256}`
}

async function pingCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'ping')
  let count = 4
  let host = ''
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-c') {
      const v = args[++i]
      if (v === undefined || !/^\d+$/.test(v)) { ctx.err('ping: invalid count of packets\n'); return 2 }
      count = Math.max(0, Math.min(20000, Number(v)))
    } else if (a.startsWith('-c') && a.length > 2 && /^\d+$/.test(a.slice(2))) {
      count = Math.max(0, Math.min(20000, Number(a.slice(2))))
    } else if (a.startsWith('-')) { ctx.err(`ping: invalid option -- '${a[1]}'\n`); return 2 }
    else host = a
  }
  if (!host) { ctx.err('ping: usage error: Destination address required\n'); return 2 }
  const known = !host.includes(' ') && (host.includes('.') || host === 'localhost')
  if (!known) { ctx.err(`ping: ${host}: Name or service not known\n`); return 2 }
  const ip = host === 'localhost' ? '127.0.0.1' : pseudoIp(host)
  ctx.out(`PING ${host} (${ip}) 56(84) bytes of data.\n`)
  const times: number[] = []
  for (let i = 1; i <= count; i++) {
    if (ctx.signal.aborted) return 130
    await delay(200, ctx.signal)
    if (ctx.signal.aborted) return 130
    const t = 10 + Math.random() * 50
    times.push(t)
    ctx.out(`64 bytes from ${ip}: icmp_seq=${i} ttl=57 time=${t.toFixed(1)} ms\n`)
  }
  const sum = times.reduce((a, b) => a + b, 0)
  const avg = times.length ? sum / times.length : 0
  const min = times.length ? Math.min(...times) : 0
  const max = times.length ? Math.max(...times) : 0
  const mdev = times.length > 1 ? Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length) : 0
  ctx.out(`\n--- ${host} ping statistics ---\n`)
  ctx.out(`${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 200}ms\n`)
  ctx.out(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/${mdev.toFixed(3)} ms\n`)
  return 0
}

function extractHost(url: string): string {
  const u = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/, 1)[0]
  return u || url
}

function curlCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'curl')
  if (args.includes('-V') || args.includes('--version')) {
    ctx.out('curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0\n')
    return 0
  }
  const url = args.find((a) => !a.startsWith('-'))
  if (!url) { ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n"); return 2 }
  ctx.err(`curl: (6) Could not resolve host: ${extractHost(url)}\n`)
  return 6
}

function wgetCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'wget')
  const url = args.find((a) => !a.startsWith('-'))
  if (!url) { ctx.err('wget: missing URL\n'); return 1 }
  const host = extractHost(url)
  ctx.err(`Resolving ${host} (${host})... failed: Temporary failure in name resolution.\n`)
  ctx.err(`wget: unable to resolve host address '${host}'\n`)
  return 4
}

function sshLike(name: string): Cmd {
  return (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    let host = ctx.args.find((a) => !a.startsWith('-')) ?? ''
    if (name !== 'ssh') host = host.split(':')[0]
    ctx.err(`${name}: connect to host ${host} port 22: Connection refused\n`)
    return 255
  }
}

function findGitDir(fs: VFS, cwd: string): string | null {
  let cur = cwd
  for (;;) {
    if (fs.isDir(cur + '/.git')) return cur + '/.git'
    if (cur === '/') return null
    cur = VFS.dirname(cur)
  }
}

function gitCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.length === 0) {
    ctx.err('usage: git [--version] [init|status]\n')
    return 1
  }
  if (args[0] === '--version') {
    ctx.out('git version 2.43.0\n')
    return 0
  }
  if (args[0] === 'init') {
    const dir = ctx.resolve('.git')
    if (ctx.fs.isDir(dir)) {
      ctx.out(`Reinitialized existing Git repository in ${dir}/\n`)
    } else if (ctx.fs.get(dir)) {
      ctx.err(`fatal: cannot create directory at '${dir}': File exists\n`)
      return 1
    } else {
      ctx.fs.mkdir(dir)
      ctx.out(`Initialized empty Git repository in ${dir}/\n`)
    }
    return 0
  }
  if (args[0] === 'status') {
    const dir = findGitDir(ctx.fs, ctx.cwd)
    if (dir) {
      ctx.out('On branch main\n\nNo commits yet\n\nnothing to commit (create/copy files and use "git add" to track)\n')
      return 0
    }
    ctx.err('fatal: not a git repository (or any of the parent directories): .git\n')
    return 128
  }
  ctx.err(`git: '${args[0]}' is not supported in this sandbox\n`)
  return 1
}

function aptLike(name: string): Cmd {
  return (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    ctx.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n')
    return 100
  }
}

function sudoCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args[0] === '-l' || args[0] === '-v') {
    ctx.err('Sorry, user guest may not run sudo on ahmed.\n')
    return 1
  }
  if (args.length === 0) {
    ctx.err('usage: sudo -h | -l | -v | command\n')
    return 1
  }
  ctx.err('guest is not in the sudoers file.  This incident will be reported.\n')
  return 1
}

function suCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'su')
  ctx.err('su: Authentication failure\n')
  return 1
}

function passwdCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'passwd')
  ctx.err('passwd: Authentication token manipulation error\n')
  return 1
}

function chshCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'chsh')
  ctx.err('chsh: PAM: Authentication failure\n')
  return 1
}

function powerCmd(name: string): Cmd {
  return (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    ctx.err('Failed to connect to bus: browser tabs cannot power off. Nice try.\n')
    return 1
  }
}

function mountCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'mount')
  ctx.out('proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)\n')
  ctx.out('sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)\n')
  ctx.out('/dev/sda on / type ext4 (rw,relatime)\n')
  return 0
}

function umountCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'umount')
  if (ctx.args.length === 0) {
    ctx.err("umount: bad usage\nTry 'umount --help' for more information.\n")
    return 1
  }
  ctx.err(`umount: ${ctx.args[0]}: not mounted.\n`)
  return 1
}

function crontabCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'crontab')
  ctx.err('no crontab for guest\n')
  return 1
}

function atCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'at')
  ctx.err('at: not supported in this sandbox\n')
  return 1
}

// ---- utilities -------------------------------------------------------------------------------------

async function sleepCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'sleep')
  if (args.includes('--version')) { ctx.out('sleep (GNU coreutils) 8.32\n'); return 0 }
  if (args.length === 0) { ctx.err('sleep: missing operand\n'); return 1 }
  let total = 0
  for (const a of args) {
    const secs = parseDuration(a)
    if (secs === null) { ctx.err(`sleep: invalid time interval '${a}'\n`); return 1 }
    total += secs
  }
  total = Math.min(total, 30)
  if (total <= 0) return 0
  await delay(total * 1000, ctx.signal)
  return ctx.signal.aborted ? 130 : 0
}

async function yesCmd(ctx: CmdCtx): Promise<number> {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'yes')
  if (ctx.args.includes('--version')) { ctx.out('yes (GNU coreutils) 8.32\n'); return 0 }
  const line = (ctx.args.length ? ctx.args.join(' ') : 'y') + '\n'
  const limit = 20000
  let written = 0
  while (written < limit) {
    if (ctx.signal.aborted) return 130
    const n = Math.min(1000, limit - written)
    ctx.out(line.repeat(n))
    written += n
  }
  return 0
}

function clearCmd(ctx: CmdCtx): number {
  ctx.io.clear()
  return 0
}

function resetCmd(ctx: CmdCtx): number {
  ctx.io.clear()
  return 0
}

function ansiFg(n: number): string {
  if (n >= 0 && n <= 7) return `\x1b[3${n}m`
  if (n >= 8 && n <= 15) return `\x1b[9${n - 8}m`
  return `\x1b[38;5;${Math.max(0, Math.min(255, n))}m`
}

function tputCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'tput')
  const cap = args[0]
  switch (cap) {
    case 'clear': ctx.out('\x1b[H\x1b[2J'); break
    case 'cols': ctx.out(String(ctx.io.size().cols)); break
    case 'lines': ctx.out(String(ctx.io.size().rows)); break
    case 'colors': ctx.out('256'); break
    case 'bold': ctx.out('\x1b[1m'); break
    case 'sgr0': ctx.out('\x1b[0m'); break
    case 'setaf': ctx.out(ansiFg(Number(args[1]))); break
    default: ctx.err(`tput: unknown terminfo capability '${cap ?? ''}'\n`); return 1
  }
  return 0
}

function sttyCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'stty')
  if (args[0] === 'size') {
    const s = ctx.io.size()
    ctx.out(`${s.rows} ${s.cols}\n`)
    return 0
  }
  ctx.out('speed 38400 baud; line = 0;\n')
  return 0
}

async function timeoutCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'timeout')
  if (args.includes('--version')) { ctx.out('timeout (GNU coreutils) 8.32\n'); return 0 }
  if (args.length < 2) {
    ctx.err("timeout: missing operand\nTry 'timeout --help' for more information.\n")
    return 125
  }
  const secs = parseDuration(args[0])
  if (secs === null) { ctx.err(`timeout: invalid time interval '${args[0]}'\n`); return 125 }
  const argv = args.slice(1)
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => { timedOut = true; resolve(true) }, Math.min(secs, 86400) * 1000)
  })
  const abortPromise = new Promise<boolean>((resolve) => {
    if (ctx.signal.aborted) { resolve(true); return }
    ctx.signal.addEventListener('abort', () => resolve(true), { once: true })
  })
  const child = ctx.exec(argv).then((r) => ({ type: 'done' as const, r }))
  const winner = await Promise.race([
    child,
    timeoutPromise.then(() => ({ type: 'timeout' as const, r: undefined })),
    abortPromise.then(() => ({ type: 'abort' as const, r: undefined })),
  ])
  if (timer) clearTimeout(timer)
  if (winner.type === 'timeout' || timedOut) return 124
  if (winner.type === 'abort') return 130
  const r: ExecResult = winner.r
  if (r.out) ctx.out(r.out)
  if (r.err) ctx.err(r.err)
  return r.status
}

async function watchCmd(ctx: CmdCtx): Promise<number> {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'watch')
  let interval = 2
  let i = 0
  while (i < args.length && args[i].startsWith('-')) {
    const a = args[i]
    if (a === '-n' || a === '--interval') {
      const v = args[i + 1]
      const secs = v === undefined ? null : parseDuration(v)
      if (secs === null) { ctx.err('watch: invalid interval\n'); return 1 }
      interval = secs
      i += 2
    } else {
      ctx.err(`watch: unrecognized option '${a}'\n`)
      return 1
    }
  }
  const cmdline = args.slice(i).join(' ')
  if (!cmdline) { ctx.err('watch: missing command\n'); return 1 }
  for (let run = 0; run < 3; run++) {
    if (ctx.signal.aborted) return 130
    ctx.out(`Every ${interval.toFixed(1)}s: ${cmdline}    ahmed: ${formatDate(new Date(), '%a %b %e %H:%M:%S %Y', false)}\n\n`)
    const r = await ctx.exec(args.slice(i))
    if (r.out) ctx.out(r.out)
    if (r.err) ctx.err(r.err)
    ctx.out('\n')
    if (run < 2) await delay(interval * 1000, ctx.signal)
  }
  return 0
}

function xdgOpenCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'xdg-open')
  const target = ctx.args[0] ?? ''
  ctx.err(`xdg-open: no method available for opening '${target}'\n`)
  return 1
}

function dnsFailCmd(name: string): Cmd {
  return (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    ctx.err('connection timed out; no servers could be reached\n')
    return 1
  }
}

function screenCmd(name: string): Cmd {
  return (ctx: CmdCtx) => {
    if (ctx.args.includes('--help')) return helpOut(ctx, ctx.argv0)
    ctx.err(`${name}: sessions are not available in this terminal\n`)
    return 1
  }
}

function whereisCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'whereis')
  if (args.length === 0) { ctx.err('whereis: usage: whereis [name ...]\n'); return 1 }
  const names = ctx.commandNames()
  for (const a of args) {
    if (names.includes(a)) ctx.out(`${a}: /usr/bin/${a}\n`)
    else ctx.out(`${a}:\n`)
  }
  return 0
}

function whatisCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'whatis')
  if (args.length === 0) { ctx.err('whatis: missing argument\n'); return 1 }
  for (const a of args) {
    const i = info[a]
    ctx.out(i ? `${a} - ${i.summary}\n` : `${a}: nothing appropriate.\n`)
  }
  return 0
}

function aproposCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'apropos')
  const kw = args.join(' ').trim()
  if (!kw) { ctx.err('apropos: missing argument\n'); return 1 }
  const low = kw.toLowerCase()
  const hits = Object.entries(info)
    .filter(([n, i]) => n.toLowerCase().includes(low) || i.summary.toLowerCase().includes(low))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  if (hits.length === 0) { ctx.out(`${kw}: nothing appropriate.\n`); return 0 }
  for (const [n, i] of hits) ctx.out(`${n} - ${i.summary}\n`)
  return 0
}

function compgenCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, 'compgen')
  if (args.includes('-c')) {
    for (const n of ctx.commandNames()) ctx.out(n + '\n')
    return 0
  }
  if (args.includes('-A')) return 0
  ctx.err('compgen: usage: compgen [-c]\n')
  return 1
}

function lognameCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'logname')
  ctx.out('guest\n')
  return 0
}

function usersCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'users')
  ctx.out('guest\n')
  return 0
}

function mesgCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'mesg')
  ctx.out('is y\n')
  return 0
}

function lsblkCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'lsblk')
  ctx.out('NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\n')
  ctx.out('sda      8:0    0   256G  0 disk /\n')
  ctx.out('sda1     8:1    0   512M  0 part /boot\n')
  return 0
}

function fdiskCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'fdisk')
  ctx.err('fdisk: Permission denied\n')
  return 1
}

function mkfsCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'mkfs')
  ctx.err('mkfs: Permission denied\n')
  return 1
}

function changelogCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'changelog')
  const abs = ctx.resolve('~/changelog.txt')
  try {
    const data = ctx.fs.readFile(abs)
    ctx.out(data.endsWith('\n') ? data : data + '\n')
    return 0
  } catch (e) {
    if (e instanceof FsError) { ctx.err(`changelog: ${abs}: ${e.reason}\n`); return 1 }
    throw e
  }
}

function sfxCmd(ctx: CmdCtx): number {
  const a = ctx.args[0]
  if (a === 'on') { sfxOn = true; ctx.io.setSfx(true); ctx.out('SFX: on\n'); return 0 }
  if (a === 'off') { sfxOn = false; ctx.io.setSfx(false); ctx.out('SFX: off\n'); return 0 }
  if (a === 'status') { ctx.out(`SFX: ${sfxOn ? 'on' : 'off'}\n`); return 0 }
  ctx.err('usage: sfx on|off|status\n')
  return 1
}

function clockCmd(ctx: CmdCtx): number {
  if (ctx.args.includes('--help')) return helpOut(ctx, 'clock')
  ctx.out(new Date().toLocaleString() + '\n')
  return 0
}

function downloadCmd(ctx: CmdCtx): number {
  const args = ctx.args
  if (args.includes('--help')) return helpOut(ctx, ctx.argv0)
  if (args.length === 0) { ctx.err('download: missing file operand\n'); return 1 }
  let status = 0
  for (const a of args) {
    const abs = ctx.resolve(a)
    const n = ctx.fs.get(abs)
    if (!n) { ctx.err(`download: ${a}: No such file or directory\n`); status = 1; continue }
    if (n.t === 'd') { ctx.err(`download: ${a}: Is a directory\n`); status = 1; continue }
    const data = ctx.fs.readFile(abs)
    const base = VFS.basename(abs)
    ctx.io.download(base, data)
    ctx.out(`Saving ${base}...\n`)
  }
  return status
}

// ---- data tables -----------------------------------------------------------------------------------

const SIGNAL_LIST = [
  ' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP',
  ' 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1',
  '11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM',
  '16) SIGSTKFLT\t17) SIGCHLD\t18) SIGCONT\t19) SIGSTOP\t20) SIGTSTP',
  '21) SIGTTIN\t22) SIGTTOU\t23) SIGURG\t24) SIGXCPU\t25) SIGXFSZ',
  '26) SIGVTALRM\t27) SIGPROF\t28) SIGWINCH\t29) SIGIO\t30) SIGPWR',
  '31) SIGSYS',
].join('\n') + '\n'

export const commands: Record<string, Cmd> = {
  nano: nanoCmd, pico: nanoCmd, edit: nanoCmd,
  vim: vimLike('vim', false), vi: vimLike('vi', false), nvim: vimLike('nvim', false),
  view: vimLike('view', true), ex: vimLike('ex', false),
  less: pagerLike('less'), more: pagerLike('more'), most: pagerLike('most'),
  whoami: whoamiCmd,
  id: idCmd,
  groups: groupsCmd,
  hostname: hostnameCmd,
  uname: unameCmd,
  uptime: uptimeCmd,
  date: dateCmd,
  cal: calCmd,
  env: envCmd,
  printenv: printenvCmd,
  free: freeCmd,
  ps: psCmd,
  top: topCmd,
  htop: htopCmd,
  kill: killCmd,
  pgrep: pgrepCmd,
  pkill: pkillCmd,
  nproc: nprocCmd,
  arch: archCmd,
  lscpu: lscpuCmd,
  lsb_release: lsbReleaseCmd,
  tty: ttyCmd,
  w: wCmd,
  who: whoCmd,
  last: lastCmd,
  locale: localeCmd,
  dmesg: dmesgCmd,
  systemctl: systemctlCmd,
  service: serviceCmd,
  lsof: lsofCmd,
  netstat: netstatCmd,
  ifconfig: ifconfigCmd,
  ip: ipCmd,
  ping: pingCmd,
  curl: curlCmd,
  wget: wgetCmd,
  ssh: sshLike('ssh'),
  scp: sshLike('scp'),
  sftp: sshLike('sftp'),
  git: gitCmd,
  apt: aptLike('apt'),
  'apt-get': aptLike('apt-get'),
  sudo: sudoCmd,
  su: suCmd,
  passwd: passwdCmd,
  chsh: chshCmd,
  reboot: powerCmd('reboot'),
  shutdown: powerCmd('shutdown'),
  halt: powerCmd('halt'),
  poweroff: powerCmd('poweroff'),
  mount: mountCmd,
  umount: umountCmd,
  crontab: crontabCmd,
  at: atCmd,
  sleep: sleepCmd,
  yes: yesCmd,
  clear: clearCmd,
  reset: resetCmd,
  tput: tputCmd,
  stty: sttyCmd,
  timeout: timeoutCmd,
  watch: watchCmd,
  'xdg-open': xdgOpenCmd,
  open: xdgOpenCmd,
  dig: dnsFailCmd('dig'),
  nslookup: dnsFailCmd('nslookup'),
  host: dnsFailCmd('host'),
  screen: screenCmd('screen'),
  tmux: screenCmd('tmux'),
  whereis: whereisCmd,
  apropos: aproposCmd,
  whatis: whatisCmd,
  compgen: compgenCmd,
  logname: lognameCmd,
  users: usersCmd,
  mesg: mesgCmd,
  lsblk: lsblkCmd,
  fdisk: fdiskCmd,
  mkfs: mkfsCmd,
  changelog: changelogCmd,
  sfx: sfxCmd,
  clock: clockCmd,
  download: downloadCmd,
  dl: downloadCmd,
}
