// Shared contracts for the terminal. Relative imports only inside src/lib/terminal (tests run via tsx).
import type { VFS } from './vfs'

/** Standard input. Piped/redirected data is served from `data`; when it runs out and a `tty` reader is
 *  attached, lines are pulled from the terminal until the user sends EOF (Ctrl+D). */
export class Stdin {
  private pos = 0
  constructor(public data = '', private tty?: () => Promise<string | null>) {}
  /** Everything remaining (for a tty: reads lines until EOF). */
  async readAll(): Promise<string> {
    let out = this.data.slice(this.pos)
    this.pos = this.data.length
    if (this.tty) {
      for (;;) {
        const l = await this.tty()
        if (l === null) break
        out += l + '\n'
      }
    }
    return out
  }
  /** One line without its newline, or null at EOF. */
  async readLine(): Promise<string | null> {
    if (this.pos < this.data.length) {
      const i = this.data.indexOf('\n', this.pos)
      const line = i < 0 ? this.data.slice(this.pos) : this.data.slice(this.pos, i)
      this.pos = i < 0 ? this.data.length : i + 1
      return line
    }
    return this.tty ? this.tty() : null
  }
}

/** What the host UI provides to the shell. */
export interface TerminalIO {
  /** Print text (may contain ANSI SGR colour codes, `\n`, `\t`). */
  write(s: string): void
  clear(): void
  /** Read a line from the keyboard. null = EOF (Ctrl+D). Rejects never. */
  readLine(prompt?: string): Promise<string | null>
  /** Open a full-screen editor/pager; resolves when the user leaves it. */
  edit(kind: 'nano' | 'vim' | 'less', path: string, opts?: { readOnly?: boolean; lineNumbers?: boolean }): Promise<void>
  /** Leave the terminal app. */
  exit(): void
  /** Offer a text file to the browser as a download. */
  download(name: string, data: string): void
  setSfx(on: boolean): void
  size(): { cols: number; rows: number }
}

export interface ExecResult { status: number; out: string; err: string }

export interface CmdCtx {
  argv0: string
  /** argv without the command name */
  args: string[]
  stdin: Stdin
  out(s: string): void
  err(s: string): void
  fs: VFS
  /** absolute working directory */
  cwd: string
  /** exported environment (snapshot, read-only by convention) */
  env: Record<string, string>
  io: TerminalIO
  signal: AbortSignal
  /** absolute normalised path from a user path (handles ~, relative, ..) */
  resolve(p: string): string
  /** run another command by argv (builtin/function/external), no shell expansion; output captured */
  exec(argv: string[], stdin?: string): Promise<ExecResult>
  /** run shell source in a subshell (own variable scope) with this command's stdin/out/err; args become $1.. */
  runScript(text: string, args?: string[]): Promise<number>
  /** true when stdout is the terminal itself (not a pipe or redirect): safe to colourise / columnise */
  isTTYOut: boolean
  /** every command name available (builtins + external), sorted */
  commandNames(): string[]
  history: string[]
}

export type Cmd = (ctx: CmdCtx) => number | Promise<number>

export interface CmdInfo { summary: string; usage: string }

/** Each commands/*.ts module exports `commands` and `info` in this shape. */
export interface CmdModule {
  commands: Record<string, Cmd>
  info: Record<string, CmdInfo>
}

// ---- editors -------------------------------------------------------------------------------------

export interface KeyInput { key: string; ctrl: boolean; alt: boolean; shift: boolean }

export interface EditorHost {
  /** file contents, or null if it does not exist */
  readFile(path: string): string | null
  /** returns an error message, or null on success */
  writeFile(path: string, data: string): string | null
  exists(path: string): boolean
  /** absolute path for a user-typed path */
  resolve(path: string): string
}

/** A run of text with one style. Styles: 'inv' reverse video, 'sel' selection, 'dim', 'bold', 'err', 'hl' search match. */
export interface Run { t: string; s?: 'inv' | 'sel' | 'dim' | 'bold' | 'err' | 'hl' }
export interface Screen {
  /** exactly `rows` lines; the visible width of each line's runs is at most `cols` */
  lines: Run[][]
  /** cursor cell (0-based) or null to hide */
  cursor: { row: number; col: number } | null
}

export interface Editor {
  key(k: KeyInput): void
  paste(text: string): void
  render(): Screen
  resize(rows: number, cols: number): void
  /** true once the user has left the editor */
  readonly done: boolean
}
