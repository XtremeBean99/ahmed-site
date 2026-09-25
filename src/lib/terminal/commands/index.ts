import type { Cmd, CmdInfo, CmdModule } from '../types'
import * as files from './files'
import * as text from './text'
import * as sed from './sed'
import * as awk from './awk'
import * as misc from './misc'
import * as fun from './fun'

const modules: CmdModule[] = [files, text, sed, awk, misc, fun]

/** Shell builtins live in shell/, but `help` and `man` describe them too. */
const BUILTIN_INFO: Record<string, CmdInfo> = {
  cd: { summary: 'change the working directory', usage: 'cd [DIR | -]' },
  pwd: { summary: 'print the working directory', usage: 'pwd [-LP]' },
  echo: { summary: 'print arguments', usage: 'echo [-neE] [ARG]...' },
  printf: { summary: 'formatted output', usage: 'printf [-v VAR] FORMAT [ARG]...' },
  export: { summary: 'export variables to child commands', usage: 'export [NAME[=VALUE]]...' },
  unset: { summary: 'remove variables or functions', usage: 'unset [-fv] NAME...' },
  set: { summary: 'set shell options and positional parameters', usage: 'set [-euxo] [--] [ARG]...' },
  alias: { summary: 'define or list aliases', usage: "alias [NAME[='VALUE']]..." },
  unalias: { summary: 'remove aliases', usage: 'unalias [-a] NAME...' },
  source: { summary: 'run a script in the current shell', usage: 'source FILE [ARG]...' },
  eval: { summary: 'run arguments as shell code', usage: 'eval [ARG]...' },
  read: { summary: 'read a line into variables', usage: 'read [-rs] [-p PROMPT] [-a ARRAY] [NAME]...' },
  type: { summary: 'describe how a name is interpreted', usage: 'type [-ta] NAME...' },
  command: { summary: 'run a command bypassing functions and aliases', usage: 'command [-vV] COMMAND [ARG]...' },
  history: { summary: 'show or clear the command history', usage: 'history [N | -c]' },
  test: { summary: 'evaluate a conditional expression', usage: 'test EXPR   or   [ EXPR ]   or   [[ EXPR ]]' },
  declare: { summary: 'declare variables and give them attributes', usage: 'declare [-aAixrp] NAME[=VALUE]...' },
  local: { summary: 'declare function-local variables', usage: 'local NAME[=VALUE]...' },
  shift: { summary: 'shift positional parameters', usage: 'shift [N]' },
  exit: { summary: 'leave the terminal', usage: 'exit [N]' },
  which: { summary: 'locate a command', usage: 'which NAME...' },
}

const CATEGORIES: [string, string[]][] = [
  ['Files', ['ls', 'cd', 'pwd', 'cat', 'head', 'tail', 'touch', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'find', 'tree', 'stat', 'du', 'df', 'chmod', 'file', 'ln', 'dd']],
  ['Text', ['grep', 'sed', 'awk', 'sort', 'uniq', 'cut', 'tr', 'wc', 'diff', 'tee', 'xargs', 'nl', 'paste', 'column', 'rev', 'tac', 'fold']],
  ['Editors', ['nano', 'vim', 'vi', 'less', 'more']],
  ['Shell', ['echo', 'printf', 'export', 'alias', 'history', 'source', 'read', 'test', 'type', 'exit', 'clear']],
  ['System', ['date', 'cal', 'uname', 'whoami', 'id', 'uptime', 'env', 'ps', 'free', 'sleep', 'hostname']],
  ['Tools', ['bc', 'expr', 'jq', 'base64', 'md5sum', 'sha256sum', 'xxd', 'tar', 'gzip', 'zip', 'seq', 'factor']],
  ['Site', ['download', 'changelog', 'sfx', 'clock', 'neofetch']],
  ['Fun', ['cowsay', 'fortune', 'figlet', 'lolcat', 'sl', 'cmatrix']],
]

function infoTable(): Record<string, CmdInfo> {
  const t: Record<string, CmdInfo> = { ...BUILTIN_INFO }
  for (const m of modules) Object.assign(t, m.info)
  return t
}

export const INFO: Record<string, CmdInfo> = { ...infoTable(), help: { summary: 'list commands or describe one', usage: 'help [COMMAND]' }, man: { summary: 'show the manual page for a command', usage: 'man COMMAND' } }

const help: Cmd = (ctx) => {
  const want = ctx.args[0]
  if (want) {
    const i = INFO[want]
    if (!i) { ctx.err(`help: no help topics match '${want}'.  Try 'help' or 'man ${want}'.\n`); return 1 }
    ctx.out(`${want}: ${i.summary}\n\nUsage: ${i.usage}\n`)
    return 0
  }
  const b = '\x1b[1m'
  const r = '\x1b[0m'
  const names = new Set(ctx.commandNames())
  let s = `${b}ahmed-os terminal${r}: real bash on a virtual disk saved in this browser.\n\n`
  for (const [cat, list] of CATEGORIES) {
    const have = list.filter((n) => names.has(n) || INFO[n])
    if (have.length) s += `${b}${cat.padEnd(8)}${r}${have.join(' ')}\n`
  }
  s += `\n${'man CMD'.padEnd(16)}manual for a command       ${'compgen -c'.padEnd(12)}every command\n`
  s += `${'nano f / vim f'.padEnd(16)}edit a file               ${'download f'.padEnd(12)}save a file to your computer\n`
  s += `Save files in ${b}~/Desktop${r} to see them on the desktop. Tab completes, Ctrl+C stops, Esc leaves.\n`
  ctx.out(s)
  return 0
}

const man: Cmd = async (ctx) => {
  const name = ctx.args.filter((a) => !a.startsWith('-'))[0]
  if (!name) { ctx.err('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1 }
  const i = INFO[name]
  if (!i) { ctx.err(`No manual entry for ${name}\n`); return 16 }
  const up = name.toUpperCase()
  const body = `${up}(1)                  ahmed-os Manual                  ${up}(1)\n\nNAME\n       ${name} - ${i.summary}\n\nSYNOPSIS\n       ${i.usage.split('\n').join('\n       ')}\n\nDESCRIPTION\n       ${i.summary[0].toUpperCase() + i.summary.slice(1)}.\n       Run '${name} --help' for the option summary.\n\nahmed-os 1.0                                              ${up}(1)\n`
  if (!ctx.isTTYOut) { ctx.out(body); return 0 }
  const tmp = `/tmp/.man-${Date.now()}`
  ctx.fs.writeFile(tmp, body)
  try { await ctx.io.edit('less', tmp, { readOnly: true }) } finally { try { ctx.fs.remove(tmp) } catch { /* already gone */ } }
  return 0
}

export const COMMANDS: Record<string, Cmd> = Object.assign({}, ...modules.map((m) => m.commands), { help, man })
