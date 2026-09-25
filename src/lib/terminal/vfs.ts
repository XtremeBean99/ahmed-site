// In-memory POSIX-ish filesystem with JSON (de)serialisation. Paths are absolute, '/'-separated.

export interface FileNode { t: 'f'; data: string; mode: number; mtime: number }
export interface DirNode { t: 'd'; kids: Record<string, Node>; mode: number; mtime: number }
export type Node = FileNode | DirNode

export type FsCode = 'ENOENT' | 'EEXIST' | 'EISDIR' | 'ENOTDIR' | 'ENOTEMPTY' | 'EINVAL' | 'EACCES'
const MESSAGES: Record<FsCode, string> = {
  ENOENT: 'No such file or directory',
  EEXIST: 'File exists',
  EISDIR: 'Is a directory',
  ENOTDIR: 'Not a directory',
  ENOTEMPTY: 'Directory not empty',
  EINVAL: 'Invalid argument',
  EACCES: 'Permission denied',
}
export class FsError extends Error {
  constructor(public code: FsCode, public path: string) {
    super(`${path}: ${MESSAGES[code]}`)
  }
  /** just "No such file or directory" (no path), for `cmd: path: msg` formatting */
  get reason(): string { return MESSAGES[this.code] }
}

export const MAX_TOTAL_BYTES = 1_500_000

export class VFS {
  root: DirNode = { t: 'd', kids: {}, mode: 0o755, mtime: Date.now() }
  private listeners = new Set<() => void>()
  /** silence change events while seeding/loading */
  private quiet = 0

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private touch() { if (!this.quiet) for (const l of this.listeners) l() }
  batch<T>(fn: () => T): T { this.quiet++; try { return fn() } finally { this.quiet--; this.touch() } }

  // ---- paths ----
  /** Normalise `p` against `cwd` (absolute result, no `.`/`..`/trailing slash). `~` and `~/x` expand to `home`. */
  static resolve(cwd: string, p: string, home = '/home/guest'): string {
    if (p === '~' || p.startsWith('~/')) p = home + p.slice(1)
    const parts = (p.startsWith('/') ? p : cwd + '/' + p).split('/')
    const out: string[] = []
    for (const s of parts) {
      if (!s || s === '.') continue
      if (s === '..') out.pop()
      else out.push(s)
    }
    return '/' + out.join('/')
  }
  static split(abs: string): string[] { return abs.split('/').filter(Boolean) }
  static basename(p: string): string { const s = p.replace(/\/+$/, ''); return s.slice(s.lastIndexOf('/') + 1) || '/' }
  static dirname(p: string): string {
    const s = p.replace(/\/+$/, '')
    const i = s.lastIndexOf('/')
    return i < 0 ? '.' : i === 0 ? '/' : s.slice(0, i)
  }

  // ---- queries ----
  get(abs: string): Node | undefined {
    let n: Node = this.root
    for (const s of VFS.split(abs)) {
      if (n.t !== 'd') return undefined
      const k: Node | undefined = n.kids[s]
      if (!k) return undefined
      n = k
    }
    return n
  }
  exists(abs: string): boolean { return this.get(abs) !== undefined || abs === '/dev/null' }
  isDir(abs: string): boolean { return this.get(abs)?.t === 'd' }
  isFile(abs: string): boolean { const n = this.get(abs); return n?.t === 'f' || abs === '/dev/null' }
  stat(abs: string): Node {
    const n = this.get(abs)
    if (!n) throw new FsError('ENOENT', abs)
    return n
  }
  readFile(abs: string): string {
    if (abs === '/dev/null') return ''
    const n = this.stat(abs)
    if (n.t === 'd') throw new FsError('EISDIR', abs)
    return n.data
  }
  /** sorted names in a directory */
  list(abs: string): string[] {
    const n = this.stat(abs)
    if (n.t !== 'd') throw new FsError('ENOTDIR', abs)
    return Object.keys(n.kids).sort()
  }
  /** approximate bytes stored */
  size(n: Node = this.root): number {
    if (n.t === 'f') return n.data.length
    let t = 0
    for (const k of Object.values(n.kids)) t += this.size(k)
    return t
  }

  // ---- mutations ----
  private parentDir(abs: string): DirNode {
    const parent = this.get(VFS.dirname(abs))
    if (!parent) throw new FsError('ENOENT', abs)
    if (parent.t !== 'd') throw new FsError('ENOTDIR', abs)
    return parent
  }
  writeFile(abs: string, data: string, append = false): void {
    if (abs === '/dev/null') return
    const name = VFS.basename(abs)
    if (abs === '/') throw new FsError('EISDIR', abs)
    const dir = this.parentDir(abs)
    const cur = dir.kids[name]
    if (cur?.t === 'd') throw new FsError('EISDIR', abs)
    const next = append && cur ? cur.data + data : data
    if (this.size() - (cur ? cur.data.length : 0) + next.length > MAX_TOTAL_BYTES) throw new FsError('EACCES', abs) // disk full
    if (cur) { cur.data = next; cur.mtime = Date.now() }
    else dir.kids[name] = { t: 'f', data: next, mode: 0o644, mtime: Date.now() }
    dir.mtime = Date.now()
    this.touch()
  }
  mkdir(abs: string, parents = false): void {
    if (parents) {
      let cur = ''
      for (const s of VFS.split(abs)) {
        cur += '/' + s
        const n = this.get(cur)
        if (!n) this.mkdir(cur)
        else if (n.t !== 'd') throw new FsError('ENOTDIR', cur)
      }
      return
    }
    if (this.get(abs)) throw new FsError('EEXIST', abs)
    const dir = this.parentDir(abs)
    dir.kids[VFS.basename(abs)] = { t: 'd', kids: {}, mode: 0o755, mtime: Date.now() }
    dir.mtime = Date.now()
    this.touch()
  }
  /** remove a file or (recursive) directory; rmdir semantics when not recursive on a dir */
  remove(abs: string, recursive = false): void {
    const n = this.stat(abs)
    if (abs === '/') throw new FsError('EACCES', abs)
    if (n.t === 'd' && !recursive && Object.keys(n.kids).length) throw new FsError('ENOTEMPTY', abs)
    const dir = this.parentDir(abs)
    delete dir.kids[VFS.basename(abs)]
    dir.mtime = Date.now()
    this.touch()
  }
  chmod(abs: string, mode: number): void { this.stat(abs).mode = mode; this.touch() }
  utimes(abs: string, mtime = Date.now()): void { this.stat(abs).mtime = mtime; this.touch() }
  /** move/rename (no overwrite of a non-empty dir; overwrites files). Refuses moving a dir into itself. */
  rename(from: string, to: string): void {
    const n = this.stat(from)
    if (to === from) return
    if (n.t === 'd' && (to + '/').startsWith(from + '/')) throw new FsError('EINVAL', to)
    const dest = this.get(to)
    if (dest?.t === 'd' && n.t !== 'd') throw new FsError('EISDIR', to)
    if (dest && dest.t !== 'd' && n.t === 'd') throw new FsError('ENOTDIR', to)
    if (dest?.t === 'd' && Object.keys(dest.kids).length) throw new FsError('ENOTEMPTY', to)
    const toDir = this.parentDir(to)
    const fromDir = this.parentDir(from)
    delete fromDir.kids[VFS.basename(from)]
    toDir.kids[VFS.basename(to)] = n
    fromDir.mtime = toDir.mtime = Date.now()
    this.touch()
  }
  /** deep copy a node to `to` (overwrites files). Caller handles "copy into directory" naming. */
  copy(from: string, to: string, recursive = false): void {
    const n = this.stat(from)
    if (n.t === 'd') {
      if (!recursive) throw new FsError('EISDIR', from)
      if ((to + '/').startsWith(from + '/')) throw new FsError('EINVAL', to)
    }
    const dir = this.parentDir(to)
    const existing = dir.kids[VFS.basename(to)]
    if (existing && existing.t !== n.t) throw new FsError(n.t === 'd' ? 'ENOTDIR' : 'EISDIR', to)
    const clone = (x: Node): Node => x.t === 'f'
      ? { t: 'f', data: x.data, mode: x.mode, mtime: Date.now() }
      : { t: 'd', kids: Object.fromEntries(Object.entries(x.kids).map(([k, v]) => [k, clone(v)])), mode: x.mode, mtime: Date.now() }
    dir.kids[VFS.basename(to)] = clone(n)
    dir.mtime = Date.now()
    this.touch()
  }

  // ---- persistence ----
  toJSON(): DirNode { return this.root }
  static fromJSON(raw: unknown): VFS | null {
    const ok = (n: unknown): n is Node => {
      if (!n || typeof n !== 'object') return false
      const x = n as Record<string, unknown>
      if (typeof x.mode !== 'number' || typeof x.mtime !== 'number') return false
      if (x.t === 'f') return typeof x.data === 'string'
      if (x.t === 'd') return !!x.kids && typeof x.kids === 'object' && Object.values(x.kids as object).every(ok)
      return false
    }
    if (!ok(raw) || raw.t !== 'd') return null
    const v = new VFS()
    v.root = raw
    return v
  }
}
