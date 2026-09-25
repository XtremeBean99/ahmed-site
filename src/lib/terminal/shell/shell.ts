// Public Shell facade over the interpreter.
import type { VFS } from '../vfs'
import type { TerminalIO, Cmd } from '../types'
import { Interp } from './interp'

export interface ShellOptions {
  fs: VFS
  io: TerminalIO
  commands: Record<string, Cmd>
  home?: string
}

const DEFAULT_PS1 = '\\[\\e[1;32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '

export class Shell {
  private ip: Interp
  readonly ps2 = '> '

  constructor(opts: ShellOptions) {
    this.ip = new Interp(opts)
  }

  get cwd(): string { return this.ip.cwd }
  get history(): string[] { return this.ip.history }
  get lastStatus(): number { return this.ip.lastStatus }

  addHistory(line: string): void {
    this.ip.history.push(line)
  }

  prompt(): string {
    const ps1 = this.ip.getVar('PS1')?.value || DEFAULT_PS1
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const user = this.ip.getVar('USER')?.value ?? 'guest'
    const host = this.ip.getVar('HOSTNAME')?.value ?? 'ahmed'
    const cwd = this.ip.cwd
    const w = cwd === this.ip.home ? '~' : cwd.startsWith(this.ip.home + '/') ? '~' + cwd.slice(this.ip.home.length) : cwd
    const W = w === '~' ? '~' : w.slice(w.lastIndexOf('/') + 1) || '/'
    const dollar = (this.ip.getVar('UID')?.value ?? '1000') === '0' ? '#' : '$'
    let out = ''
    for (let i = 0; i < ps1.length; i++) {
      const c = ps1[i]
      if (c === '\\' && i + 1 < ps1.length) {
        const n = ps1[++i]
        switch (n) {
          case 'u': out += user; break
          case 'h': out += host; break
          case 'w': out += w; break
          case 'W': out += W; break
          case '$': out += dollar; break
          case 'n': out += '\n'; break
          case 't': out += time; break
          case 'e': out += '\x1b'; break
          case '\\': out += '\\'; break
          case '[': case ']': break
          default: out += '\\' + n
        }
        continue
      }
      out += c
    }
    return out
  }

  async run(source: string): Promise<{ incomplete: boolean; status: number }> {
    return this.ip.run(source)
  }

  abort(): void { this.ip.abort() }

  async init(): Promise<void> {
    try {
      const rc = this.ip.home + '/.bashrc'
      if (this.ip.fs.isFile(rc)) {
        const text = this.ip.fs.readFile(rc)
        await this.ip.run(text)
      }
    } catch {
      // init must never throw
    }
  }

  complete(line: string): { start: number; candidates: string[] } {
    return this.ip.complete(line)
  }

  commandNames(): string[] { return this.ip.commandNames() }
}
