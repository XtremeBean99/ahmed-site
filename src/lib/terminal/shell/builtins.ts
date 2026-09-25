// Shell builtins. `ip` is the interpreter (type-only import keeps the module graph acyclic at runtime).
import { VFS } from '../vfs'
import { Stdin } from '../types'
import { lex } from './lexer'
import { parse } from './parser'
import { expandAssignValue } from './expand'
import { evalArith, ArithError } from './arith'
import { unescape, formatPrintf } from '../printf'
import { matchGlob } from '../glob'
import { compilePosix } from '../regex'
import type { Interp, RunIO } from './interp'
import type { VarValue } from './expand'

export type Builtin = (ip: Interp, args: string[], io: RunIO) => number | Promise<number>

function parseNum(s: string | undefined): number {
  if (s === undefined) return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

function nameVal(arg: string): { name: string; value: string | null } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)(=(.*))?$/.exec(arg)
  if (!m) return null
  return { name: m[1], value: m[3] !== undefined ? m[3] : null }
}

const CD: Builtin = async (ip, args, io) => {
  let dir = args[0]
  let print = false
  if (!dir || dir === '~') dir = ip.home
  if (dir === '-') {
    dir = ip.getVar('OLDPWD')?.value || ip.home
    print = true
  }
  const path = VFS.resolve(ip.cwd, dir, ip.home)
  if (!ip.fs.exists(path)) { io.err(`bash: cd: ${dir}: No such file or directory\n`); return 1 }
  if (!ip.fs.isDir(path)) { io.err(`bash: cd: ${dir}: Not a directory\n`); return 1 }
  ip.setOldPwd(ip.cwd)
  ip.setCwd(path)
  if (print) io.out(path + '\n')
  return 0
}

const PWD: Builtin = (ip, args, io) => {
  io.out(ip.cwd + '\n')
  void args
  return 0
}

const ECHO: Builtin = (ip, args, io) => {
  void ip
  let newline = true
  let escapes = false
  let i = 0
  for (; i < args.length; i++) {
    const a = args[i]
    if (a === '-n') { newline = false; continue }
    if (a === '-e') { escapes = true; continue }
    if (a === '-E') { escapes = false; continue }
    if (a === '--') { i++; break }
    if (a.startsWith('-') && a.length > 1) continue
    break
  }
  let out = args.slice(i).join(' ')
  if (escapes) {
    const u = unescape(out)
    out = u.text
    if (u.stop) { io.out(out); return 0 }
  }
  io.out(out + (newline ? '\n' : ''))
  return 0
}

const PRINTF: Builtin = (ip, args, io) => {
  let vname: string | null = null
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-v' && i + 1 < args.length) { vname = args[++i]; continue }
    if (args[i] === '--') { rest.push(...args.slice(i + 1)); break }
    rest.push(args[i])
  }
  if (rest.length === 0) { io.err('bash: printf: usage: printf [-v var] format [arguments]\n'); return 2 }
  const fmt = rest[0]
  const out = formatPrintf(fmt, rest.slice(1))
  if (vname) ip.setVar(vname, out)
  else io.out(out)
  return 0
}

const EXPORT: Builtin = (ip, args, io) => {
  if (args.length === 0 || (args.length === 1 && args[0] === '-p')) {
    for (const [k, v] of [...ip.vars].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (v.exported) io.out(`declare -x ${k}="${v.value.replace(/"/g, '\\"')}"\n`)
    }
    return 0
  }
  for (const a of args) {
    if (a === '-p') continue
    const nv = nameVal(a)
    if (!nv) { io.err(`bash: export: \`${a}': not a valid identifier\n`); return 1 }
    if (nv.value !== null) {
      const v = ip.getVar(nv.name)
      const value = nv.value
      ip.setVarFull(nv.name, { value, exported: true, readonly: v?.readonly ?? false, integer: v?.integer ?? false, lower: v?.lower ?? false, upper: v?.upper ?? false, array: v?.array ?? null, assoc: v?.assoc ?? null })
    } else {
      ip.exportVar(nv.name)
    }
  }
  return 0
}

const UNSET: Builtin = (ip, args, io) => {
  let funcMode = false
  for (const a of args) {
    if (a === '-f') { funcMode = true; continue }
    if (a === '-v') { funcMode = false; continue }
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(\[([^\]]*)\])?$/.exec(a)
    if (m && m[2]) {
      const v = ip.getVar(m[1])
      if (v?.array) {
        const idx = Number(m[3])
        if (Number.isInteger(idx)) {
          const arr = v.array.slice()
          arr[idx] = undefined
          ip.setVarFull(m[1], { ...v, array: arr, value: arr[0] ?? '' })
          continue
        }
      }
      if (v?.assoc) { v.assoc.delete(m[3]); continue }
      continue
    }
    if (funcMode) ip.functions.delete(a)
    else ip.unsetVar(a)
  }
  void io
  return 0
}

const SET: Builtin = (ip, args, io) => {
  const newArgs: string[] = []
  let afterDashDash = false
  let hadFlag = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (afterDashDash) { newArgs.push(a); continue }
    if (a === '--') { afterDashDash = true; hadFlag = true; continue }
    if (a === '-e') { ip.options.errexit = true; hadFlag = true; continue }
    if (a === '-u') { ip.options.nounset = true; hadFlag = true; continue }
    if (a === '-x') { ip.options.xtrace = true; hadFlag = true; continue }
    if (a === '+e') { ip.options.errexit = false; hadFlag = true; continue }
    if (a === '+u') { ip.options.nounset = false; hadFlag = true; continue }
    if (a === '+x') { ip.options.xtrace = false; hadFlag = true; continue }
    if (a === '-o') {
      const opt = args[++i]
      hadFlag = true
      if (opt === 'pipefail') ip.options.pipefail = true
      else if (opt === 'errexit') ip.options.errexit = true
      else if (opt === 'nounset') ip.options.nounset = true
      else if (opt === 'xtrace') ip.options.xtrace = true
      continue
    }
    if (a === '+o') {
      const opt = args[++i]
      hadFlag = true
      if (opt === 'pipefail') ip.options.pipefail = false
      else if (opt === 'errexit') ip.options.errexit = false
      else if (opt === 'nounset') ip.options.nounset = false
      else if (opt === 'xtrace') ip.options.xtrace = false
      continue
    }
    newArgs.push(a)
  }
  if (newArgs.length > 0) ip.positionals = newArgs
  else if (!hadFlag) {
    for (const [k, v] of [...ip.vars].sort((a, b) => a[0].localeCompare(b[0]))) {
      io.out(`${k}=${v.value}\n`)
    }
  }
  return 0
}

const SHIFT: Builtin = (ip, args) => {
  const n = args.length ? Math.max(1, parseNum(args[0])) : 1
  ip.positionals = ip.positionals.slice(n)
  return 0
}

const RETURN: Builtin = (ip, args, io) => {
  const status = args.length ? parseNum(args[0]) : ip.lastStatus
  if (ip.sourceNest === 0) {
    io.err('bash: return: can only `return\' from a function or sourced script\n')
    return 1
  }
  ip.setReturn(status)
  return status
}

const EXIT: Builtin = (ip, args) => {
  const status = args.length ? parseNum(args[0]) : ip.lastStatus
  ip.requestExit(status)
  try { ip.io.exit() } catch { /* host may not implement */ }
  return status
}

const BREAK: Builtin = (ip, args) => { ip.setBreak(args.length ? Math.max(1, parseNum(args[0])) : 1); return 0 }
const CONTINUE: Builtin = (ip, args) => { ip.setContinue(args.length ? Math.max(1, parseNum(args[0])) : 1); return 0 }

function arrayWord(arg: string): { name: string; append: boolean; parts: string[] } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)(\+?)=\((.*)\)$/.exec(arg)
  if (!m) return null
  return { name: m[1], append: m[2] === '+=', parts: m[3] === '' ? [] : m[3].split(' ').filter((s) => s !== '') }
}

const DECLARE: (ip: Interp, args: string[], io: RunIO, localMode?: boolean) => Promise<number> = async (ip, args, io, localMode = false) => {
  void io
  let attrInt = false
  let attrArray = false
  let attrAssoc = false
  let attrExport = false
  let attrReadonly = false
  let attrLower = false
  let attrUpper = false
  let print = false
  const names: string[] = []
  for (const a of args) {
    if (a === '--') continue
    if (/^-[aAixrplu]+$/.test(a) && a.length > 1) {
      if (a.includes('i')) attrInt = true
      if (a.includes('a')) attrArray = true
      if (a.includes('A')) attrAssoc = true
      if (a.includes('x')) attrExport = true
      if (a.includes('r')) attrReadonly = true
      if (a.includes('l')) attrLower = true
      if (a.includes('u')) attrUpper = true
      if (a.includes('p')) print = true
      continue
    }
    if (a === '-p') { print = true; continue }
    names.push(a)
  }
  const printOne = (name: string, v: VarValue) => {
    const flags = (v.exported ? 'x' : '') + (v.readonly ? 'r' : '') + (v.integer ? 'i' : '')
    if (v.array) {
      const parts = v.array.map((x, i) => x === undefined ? '' : `[${i}]="${x.replace(/"/g, '\\"')}"`).filter((s) => s !== '')
      io.out(`declare -a${flags ? ' ' + flags : ''} ${name}=(${parts.join(' ')})` + (parts.length ? '' : '()') + '\n')
    } else if (v.assoc) {
      const parts = [...v.assoc].map(([k, x]) => `[${k}]="${x.replace(/"/g, '\\"')}"`)
      io.out(`declare -A${flags ? ' ' + flags : ''} ${name}=(${parts.join(' ')})` + (parts.length ? '' : '()') + '\n')
    } else {
      io.out(`declare -${v.exported ? 'x' : '-'} ${name}="${v.value.replace(/"/g, '\\"')}"\n`)
    }
  }
  if (print) {
    if (names.length === 0) {
      for (const [k, v] of [...ip.vars].sort((a, b) => a[0].localeCompare(b[0]))) printOne(k, v)
    } else {
      for (const n of names) {
        const v = ip.getVar(n)
        if (v) printOne(n, v)
      }
    }
    return 0
  }
  for (const arg of names) {
    const aw = arrayWord(arg)
    if (aw) {
      const vals: (string | undefined)[] = []
      for (const p of aw.parts) vals.push(await expandAssignValue(p, ip))
      const existing = ip.getVar(aw.name)
      if (aw.append && existing?.array) vals.unshift(...existing.array)
      const v: VarValue = {
        value: vals[0] ?? '',
        exported: attrExport,
        readonly: attrReadonly,
        integer: attrInt,
        lower: attrLower,
        upper: attrUpper,
        array: attrAssoc ? null : vals,
        assoc: null,
      }
      if (localMode) ip.setLocal(aw.name, v)
      else ip.setVarFull(aw.name, v)
      continue
    }
    const nv = nameVal(arg)
    if (!nv) { io.err(`bash: declare: \`${arg}': not a valid identifier\n`); return 1 }
    const existing = ip.getVar(nv.name)
    const value = nv.value === null ? '' : nv.value
    const v: VarValue = {
      value,
      exported: attrExport || (existing?.exported ?? false),
      readonly: attrReadonly || (existing?.readonly ?? false),
      integer: attrInt,
      lower: attrLower,
      upper: attrUpper,
      array: attrArray ? existing?.array ?? [] : attrAssoc ? null : (existing?.array ?? null),
      assoc: attrAssoc ? existing?.assoc ?? new Map() : null,
    }
    if (nv.value !== null && !attrArray && !attrAssoc) {
      try { v.value = await expandAssignValue(nv.value, ip) } catch { v.value = nv.value }
    }
    if (localMode) ip.setLocal(nv.name, v)
    else ip.setVarFull(nv.name, v)
  }
  return 0
}

const LOCAL: Builtin = (ip, args, io) => {
  // declarations land in the current function scope (runArgv pushed one already)
  return DECLARE(ip, args, io, true)
}

const READONLY: Builtin = (ip, args, io) => {
  if (args.length === 0 || (args.length === 1 && args[0] === '-p')) {
    for (const [k, v] of [...ip.vars].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (v.readonly) io.out(`declare -r ${k}="${v.value.replace(/"/g, '\\"')}"\n`)
    }
    return 0
  }
  for (const a of args) {
    if (a === '-p') continue
    const nv = nameVal(a)
    if (!nv) { io.err(`bash: readonly: \`${a}': not a valid identifier\n`); return 1 }
    if (nv.value !== null) ip.setVarFull(nv.name, { value: nv.value, exported: false, readonly: true, integer: false, lower: false, upper: false, array: null, assoc: null })
    else {
      const v = ip.getVar(nv.name)
      if (v) v.readonly = true
      else ip.setVarFull(nv.name, { value: '', exported: false, readonly: true, integer: false, lower: false, upper: false, array: null, assoc: null })
    }
  }
  return 0
}

const ALIAS: Builtin = (ip, args, io) => {
  if (args.length === 0) {
    for (const [k, v] of [...ip.aliases].sort((a, b) => a[0].localeCompare(b[0]))) {
      io.out(`alias ${k}='${v.replace(/'/g, "'\\''")}'\n`)
    }
    return 0
  }
  for (const a of args) {
    const eq = a.indexOf('=')
    if (eq <= 0) {
      const v = ip.aliases.get(a)
      if (v) io.out(`alias ${a}='${v.replace(/'/g, "'\\''")}'\n`)
      else { io.err(`bash: alias: ${a}: not found\n`); return 1 }
    } else {
      ip.aliases.set(a.slice(0, eq), a.slice(eq + 1))
    }
  }
  return 0
}

const UNALIAS: Builtin = (ip, args, io) => {
  if (args[0] === '-a') { ip.aliases.clear(); return 0 }
  for (const a of args) {
    if (!ip.aliases.delete(a)) { io.err(`bash: unalias: ${a}: not found\n`); return 1 }
  }
  return 0
}

const SOURCE: Builtin = async (ip, args, io) => {
  if (args.length === 0) { io.err('bash: source: filename argument required\n'); return 2 }
  const path = VFS.resolve(ip.cwd, args[0], ip.home)
  let text: string
  try { text = ip.fs.readFile(path) } catch {
    io.err(`bash: source: ${args[0]}: No such file or directory\n`)
    return 1
  }
  const lr = lex(text)
  if (lr.incomplete) return 0
  const pr = parse(lr.tokens)
  if (!pr.cmd || pr.incomplete) { if (pr.error) io.err(pr.error + '\n'); return pr.incomplete ? 0 : 2 }
  const saved = ip.positionals
  ip.positionals = args.slice(1)
  const prevSource = ip.sourceDepthNow()
  try {
    return await ip.execCmd(pr.cmd, io)
  } finally {
    ip.positionals = saved
    void prevSource
  }
}

const EVAL: Builtin = async (ip, args, io) => {
  const text = args.join(' ')
  const lr = lex(text)
  if (lr.incomplete) return 0
  const pr = parse(lr.tokens)
  if (!pr.cmd || pr.incomplete) { if (pr.error) io.err(pr.error + '\n'); return pr.incomplete ? 0 : 2 }
  return ip.execCmd(pr.cmd, io)
}

const EXEC: Builtin = async (ip, args, io) => {
  if (args.length === 0) return 0
  const status = await ip.runBuiltinOrCommand(args, io)
  ip.requestExit(status)
  try { ip.io.exit() } catch { /* ignore */ }
  return status
}

const READ: Builtin = async (ip, args, io) => {
  let raw = false
  let prompt: string | null = null
  let arrName: string | null = null
  let delim = '\n'
  let nchars = 0
  const names: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-r') { raw = true; continue }
    if (a === '-s' || a === '-t') continue
    if (a === '-p' && i + 1 < args.length) { prompt = args[++i]; continue }
    if (a === '-a' && i + 1 < args.length) { arrName = args[++i]; continue }
    if (a === '-d' && i + 1 < args.length) { delim = args[++i]; continue }
    if (a === '-n' && i + 1 < args.length) { nchars = parseNum(args[++i]); continue }
    if (a.startsWith('-')) continue
    names.push(a)
  }
  if (prompt !== null) io.err(prompt)
  let line: string | null
  if (nchars > 0) {
    const all = await io.stdin.readAll()
    line = all.slice(0, nchars)
  } else {
    line = await io.stdin.readLine()
  }
  if (line === null) return 1
  if (!raw) {
    let out = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '\\' && i + 1 < line.length) {
        const n = line[++i]
        if (n === 'n') out += '\n'
        else if (n === 't') out += '\t'
        else if (n === '\\') out += '\\'
        else out += n
      } else out += c
    }
    line = out
  }
  const ifs = ip.getVar('IFS')?.value ?? ' \t\n'
  const fields = line.split(/[ \t\n]+/).filter((f) => f !== '')
  if (arrName) {
    const v: VarValue = { value: fields[0] ?? '', exported: false, readonly: false, integer: false, lower: false, upper: false, array: fields, assoc: null }
    ip.setVarFull(arrName, v)
    return 0
  }
  if (names.length === 0) {
    ip.setVar('REPLY', fields.join(' '))
    return 0
  }
  for (let i = 0; i < names.length; i++) {
    if (i === names.length - 1) {
      ip.setVar(names[i], fields.slice(i).join(' '))
    } else if (i < fields.length) {
      ip.setVar(names[i], fields[i])
    } else {
      ip.setVar(names[i], '')
    }
  }
  void delim
  return 0
}

const TYPE: Builtin = (ip, args, io) => {
  let tFlag = false
  let aFlag = false
  const names: string[] = []
  for (const a of args) {
    if (a === '-t') { tFlag = true; continue }
    if (a === '-a') { aFlag = true; continue }
    names.push(a)
  }
  let status = 0
  for (const name of names) {
    const found: string[] = []
    if (ip.aliases.has(name)) found.push('alias')
    if (ip.functions.has(name)) found.push('function')
    if (Object.hasOwn(BUILTINS, name)) found.push('builtin')
    if (ip.commands[name]) found.push('file')
    if (found.length === 0) {
      if (tFlag) { /* print nothing */ } else io.err(`bash: type: ${name}: not found\n`)
      status = 1
      continue
    }
    if (tFlag) {
      io.out(found[0] + '\n')
      continue
    }
    if (aFlag) {
      for (const f of found) io.out(name + ' is ' + (f === 'file' ? `/usr/bin/${name}` : f === 'builtin' ? 'a shell builtin' : f === 'function' ? 'a function' : 'aliased to `' + ip.aliases.get(name) + "'") + '\n')
      continue
    }
    const f = found[0]
    if (f === 'alias') io.out(`${name} is aliased to \`${ip.aliases.get(name)}'\n`)
    else if (f === 'function') io.out(`${name} is a function\n`)
    else if (f === 'builtin') io.out(`${name} is a shell builtin\n`)
    else io.out(`${name} is /usr/bin/${name}\n`)
  }
  return status
}

const COMMAND: Builtin = (ip, args, io) => {
  let v = false
  let V = false
  const rest: string[] = []
  for (const a of args) {
    if (a === '-v') { v = true; continue }
    if (a === '-V') { V = true; continue }
    rest.push(a)
  }
  if (v || V) {
    let status = 0
    for (const name of rest) {
      if (ip.commands[name]) io.out((V ? `${name} is /usr/bin/${name}` : `/usr/bin/${name}`) + '\n')
      else if (Object.hasOwn(BUILTINS, name) || ip.functions.has(name)) io.out(name + '\n')
      else if (ip.aliases.has(name)) io.out((V ? `${name} is aliased to \`${ip.aliases.get(name)}'` : `alias ${name}='${ip.aliases.get(name)}'`) + '\n')
      else status = 1
    }
    return status
  }
  if (rest.length === 0) return 0
  return ip.runArgvBypass(rest, io)
}

const BUILTIN: Builtin = (ip, args, io) => {
  if (args.length === 0) return 0
  return ip.runBuiltin(args[0], args.slice(1), io)
}

const WHICH: Builtin = (ip, args, io) => {
  let status = 0
  for (const name of args) {
    if (ip.commands[name]) io.out(`/usr/bin/${name}\n`)
    else status = 1
  }
  return status
}

const HASH: Builtin = () => 0

const HISTORY: Builtin = (ip, args, io) => {
  if (args[0] === '-c') { ip.history.length = 0; return 0 }
  const list = ip.history
  const n = args.length ? parseNum(args[0]) : 0
  const items = n > 0 ? list.slice(-n) : list
  items.forEach((cmd, idx) => {
    const num = n > 0 ? list.length - items.length + idx + 1 : idx + 1
    io.out(`${String(num).padStart(5)}  ${cmd}\n`)
  })
  return 0
}

const LET: Builtin = (ip, args, io) => {
  let result = 0
  for (const a of args) {
    try { result = evalArith(a, ip.arithEnv) } catch (e) {
      if (e instanceof ArithError) { io.err(`bash: let: ${a}: ${e.message}\n`); return 1 }
      throw e
    }
  }
  return result === 0 ? 1 : 0
}

const TEST: Builtin = (ip, args) => {
  const items = args.map((t) => ({ text: t, quoted: false }))
  return evalTestItems(items, ip) ? 0 : 1
}

const TEST_BRACKET: Builtin = (ip, args) => {
  const a = args.slice()
  if (a[a.length - 1] === ']') a.pop()
  const items = a.map((t) => ({ text: t, quoted: false }))
  return evalTestItems(items, ip) ? 0 : 1
}

const TRUE: Builtin = () => 0
const FALSE: Builtin = () => 1
const COLON: Builtin = () => 0

const JOBS: Builtin = () => 0
const WAIT: Builtin = () => 0
const SHOPT: Builtin = () => 0
const TRAP: Builtin = () => 0
const UMASK: Builtin = (ip, args, io) => {
  if (args.length === 0) { io.out('0022\n'); return 0 }
  return 0
}
const ULIMIT: Builtin = (ip, args, io) => {
  if (args.length === 0) { io.out('unlimited\n'); return 0 }
  return 0
}

const GETOPTS: Builtin = (ip, args) => {
  // basic getopts: OPTIND/OPTARG
  if (args.length < 2) return 2
  const optstring = args[0]
  const name = args[1]
  const words = args.length > 2 ? args.slice(2) : ip.positionals
  const optind = parseNum(ip.getVar('OPTIND')?.value)
  const idx = Math.max(0, optind - 1)
  if (idx >= words.length) {
    ip.setVar('OPTIND', '1')
    return 1
  }
  const word = words[idx]
  if (!word.startsWith('-') || word === '-') {
    ip.setVar('OPTIND', String(idx + 2))
    return 1
  }
  const opt = word[1]
  const spec = optstring.indexOf(opt)
  if (spec < 0) {
    ip.setVar(name, '?')
    ip.setVar('OPTIND', String(idx + 2))
    return 0
  }
  ip.setVar(name, opt)
  if (optstring[spec + 1] === ':') {
    const rest = word.slice(2)
    if (rest) ip.setVar('OPTARG', rest)
    else if (idx + 1 < words.length) ip.setVar('OPTARG', words[idx + 1])
    else { ip.setVar(name, '?'); return 0 }
    ip.setVar('OPTIND', String(idx + 2))
  } else {
    ip.setVar('OPTIND', String(idx + 1))
  }
  return 0
}

const BASH: Builtin = async (ip, args, io) => {
  return runBashLike(ip, args, io)
}
const SH: Builtin = async (ip, args, io) => {
  return runBashLike(ip, args, io)
}

async function runBashLike(ip: Interp, args: string[], io: RunIO): Promise<number> {
  let command: string | null = null
  let scriptFile: string | null = null
  const opts = { errexit: false, xtrace: false }
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-c') { command = args[++i] ?? ''; continue }
    if (a === '-e') { opts.errexit = true; continue }
    if (a === '-x') { opts.xtrace = true; continue }
    if (a.startsWith('-') && a !== '-') continue
    if (command === null && scriptFile === null && rest.length === 0) { scriptFile = a; continue }
    rest.push(a)
  }
  if (command !== null) {
    const savedOptions = { ...ip.options }
    const savedArgv0 = ip.argv0
    ip.options.errexit = opts.errexit
    ip.options.xtrace = opts.xtrace
    ip.argv0 = rest[0] ?? 'bash'
    const savedPos = ip.positionals
    ip.positionals = rest.slice(1)
    try {
      return await ip.runScriptText(command, ip.argv0, rest.slice(1), io)
    } finally {
      ip.options = savedOptions
      ip.argv0 = savedArgv0
      ip.positionals = savedPos
    }
  }
  if (scriptFile !== null) {
    const path = VFS.resolve(ip.cwd, scriptFile, ip.home)
    try {
      const text = ip.fs.readFile(path)
      const savedOptions = { ...ip.options }
      ip.options.errexit = opts.errexit
      ip.options.xtrace = opts.xtrace
      try {
        return await ip.runScriptText(text, path, rest, io)
      } finally {
        ip.options = savedOptions
      }
    } catch {
      io.err(`bash: ${scriptFile}: No such file or directory\n`)
      return 127
    }
  }
  const text = await io.stdin.readAll()
  if (!text) return 0
  return ip.runScriptText(text, 'bash', [], io)
}

export const BUILTINS: Record<string, Builtin> = {
  cd: CD, pwd: PWD, echo: ECHO, printf: PRINTF, export: EXPORT, unset: UNSET, set: SET, shift: SHIFT,
  return: RETURN, exit: EXIT, break: BREAK, continue: CONTINUE, declare: DECLARE, typeset: DECLARE,
  local: LOCAL, readonly: READONLY, alias: ALIAS, unalias: UNALIAS, source: SOURCE, '.': SOURCE,
  eval: EVAL, exec: EXEC, read: READ, type: TYPE, command: COMMAND, builtin: BUILTIN, which: WHICH,
  hash: HASH, history: HISTORY, let: LET, test: TEST, '[': TEST_BRACKET, true: TRUE, false: FALSE,
  ':': COLON, jobs: JOBS, wait: WAIT, umask: UMASK, ulimit: ULIMIT, getopts: GETOPTS, bash: BASH, sh: SH,
  shopt: SHOPT, trap: TRAP,
}

// ---- test / [ / [[ evaluator (shared) ----------------------------------------------------------

export interface TestHost {
  fs: VFS
  cwd: string
  home: string
  setArrayVar(name: string, values: string[]): void
}

export function evalTestItems(items: { text: string; quoted: boolean }[], ip: TestHost): boolean {
  return evalOr(items, ip)
}

function evalOr(items: { text: string; quoted: boolean }[], ip: TestHost): boolean {
  const idx = findTopOp(items, ['-o'])
  if (idx >= 0) return evalOr(items.slice(0, idx), ip) || evalOr(items.slice(idx + 1), ip)
  return evalAnd(items, ip)
}
function evalAnd(items: { text: string; quoted: boolean }[], ip: TestHost): boolean {
  const idx = findTopOp(items, ['-a'])
  if (idx >= 0) return evalAnd(items.slice(0, idx), ip) && evalAnd(items.slice(idx + 1), ip)
  return evalNot(items, ip)
}
function evalNot(items: { text: string; quoted: boolean }[], ip: TestHost): boolean {
  if (items.length > 0 && items[0].text === '!') return !evalNot(items.slice(1), ip)
  return evalPrim(items, ip)
}
function findTopOp(items: { text: string; quoted: boolean }[], ops: string[]): number {
  let depth = 0
  for (let i = 0; i < items.length; i++) {
    const t = items[i].text
    if (t === '(') depth++
    else if (t === ')') depth--
    else if (depth === 0 && ops.includes(t)) return i
  }
  return -1
}
function evalPrim(items: { text: string; quoted: boolean }[], ip: TestHost): boolean {
  if (items.length === 0) return false
  if (items.length === 1) return items[0].text !== ''
  if (items.length === 2) {
    const [a, b] = items
    if (a.text === '!') return !(b.text !== '')
    return unaryTest(a.text, b.text, ip)
  }
  if (items.length === 3) {
    const [a, op, b] = items
    if (a.text === '(' && b.text === ')') return op.text !== ''
    return binaryTest(a, op, b, ip)
  }
  if (items.length === 4 && items[0].text === '!' && items[1].text === '(' && items[3].text === ')') {
    return !evalPrim([items[2]], ip)
  }
  if (items.length >= 3) return binaryTest(items[0], items[1], items[2], ip)
  return false
}
function unaryTest(op: string, arg: string, ip: TestHost): boolean {
  switch (op) {
    case '-z': return arg === ''
    case '-n': return arg !== ''
    case '-e': return ip.fs.exists(VFS.resolve(ip.cwd, arg, ip.home))
    case '-f': return ip.fs.isFile(VFS.resolve(ip.cwd, arg, ip.home))
    case '-d': return ip.fs.isDir(VFS.resolve(ip.cwd, arg, ip.home))
    case '-s': {
      const p = VFS.resolve(ip.cwd, arg, ip.home)
      try { return ip.fs.stat(p).t === 'f' && ip.fs.readFile(p).length > 0 } catch { return false }
    }
    case '-r': case '-w': case '-x': return ip.fs.exists(VFS.resolve(ip.cwd, arg, ip.home))
    case '-L': case '-h': return false
    default: return arg !== ''
  }
}
function binaryTest(a: { text: string; quoted: boolean }, op: { text: string; quoted: boolean }, b: { text: string; quoted: boolean }, ip: TestHost): boolean {
  switch (op.text) {
    case '=': case '==': {
      if (!b.quoted && /[*?[]/.test(b.text)) return matchGlob(b.text, a.text)
      return a.text === b.text
    }
    case '!=': {
      if (!b.quoted && /[*?[]/.test(b.text)) return !matchGlob(b.text, a.text)
      return a.text !== b.text
    }
    case '<': return a.text < b.text
    case '>': return a.text > b.text
    case '=~': {
      try {
        const re = compilePosix(b.text, { ere: true })
        const m = re.exec(a.text)
        ip.setArrayVar('BASH_REMATCH', m ? [...m].map((x) => x ?? '') : [])
        return m !== null
      } catch {
        return false
      }
    }
    case '-eq': return num(a.text) === num(b.text)
    case '-ne': return num(a.text) !== num(b.text)
    case '-lt': return num(a.text) < num(b.text)
    case '-le': return num(a.text) <= num(b.text)
    case '-gt': return num(a.text) > num(b.text)
    case '-ge': return num(a.text) >= num(b.text)
    case '-nt': case '-ot': {
      const pa = VFS.resolve(ip.cwd, a.text, ip.home)
      const pb = VFS.resolve(ip.cwd, b.text, ip.home)
      try {
        const ta = ip.fs.stat(pa).mtime
        const tb = ip.fs.stat(pb).mtime
        return op.text === '-nt' ? ta > tb : ta < tb
      } catch { return false }
    }
    default: return a.text === b.text
  }
}
function num(s: string): number {
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}
