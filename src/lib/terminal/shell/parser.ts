// Recursive-descent parser over the lexer's token stream. Raw word text is kept for later expansion.
import type { Tok } from './lexer'

export interface Redir {
  fd: number
  op: string
  target: string | null
  heredoc?: { delim: string; quoted: boolean; stripTabs: boolean; body: string }
}

export interface Assign {
  name: string
  value: string | null
  append?: boolean
  array?: string[] | null
  index?: string
}

export type CondExpr =
  | { type: 'test'; args: string[] }
  | { type: 'not'; e: CondExpr }
  | { type: 'and'; a: CondExpr; b: CondExpr }
  | { type: 'or'; a: CondExpr; b: CondExpr }
  | { type: 'group'; e: CondExpr }

export type Cmd =
  | { type: 'simple'; assigns: Assign[]; words: string[]; redirs: Redir[] }
  | { type: 'pipeline'; neg: boolean; stages: Cmd[]; stderrPipe: boolean[] }
  | { type: 'andor'; items: Cmd[]; ops: ('&&' | '||')[] }
  | { type: 'list'; items: Cmd[] }
  | { type: 'subshell'; body: Cmd; redirs?: Redir[] }
  | { type: 'group'; body: Cmd; redirs?: Redir[] }
  | { type: 'if'; cond: Cmd; then: Cmd; elifs: { cond: Cmd; then: Cmd }[]; els?: Cmd; redirs?: Redir[] }
  | { type: 'for'; name: string; words: string[] | null; arith: string[] | null; body: Cmd; redirs?: Redir[] }
  | { type: 'while'; cond: Cmd; body: Cmd; until: boolean; redirs?: Redir[] }
  | { type: 'case'; word: string; arms: { pats: string[]; body: Cmd; term: ';;' | ';&' | ';;&' }[]; redirs?: Redir[] }
  | { type: 'func'; name: string; body: Cmd }
  | { type: 'arith'; expr: string; redirs?: Redir[] }
  | { type: 'cond'; expr: CondExpr; redirs?: Redir[] }
  | { type: 'time'; cmd: Cmd; redirs?: Redir[] }

export interface ParseResult { cmd: Cmd | null; incomplete: boolean; error?: string }

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Arithmetic expressions were tokenised with shell operators; re-merge split comparison ops. */
function fixArithText(s: string): string {
  return s.replace(/ > =/g, ' >=').replace(/ < =/g, ' <=').replace(/ = =/g, ' ==').replace(/ ! =/g, ' !=')
}

export function parse(tokens: Tok[]): ParseResult {
  const p = new Parser(tokens)
  const cmd = p.parseProgram(new Set())
  if (!cmd) return { cmd: null, incomplete: p.incomplete, error: p.error }
  return { cmd, incomplete: false }
}

class Parser {
  p = 0
  incomplete = false
  error = ''
  constructor(private toks: Tok[]) {}

  private peek(): Tok { return this.toks[this.p] ?? { kind: 'eof' } }
  private next(): Tok { return this.toks[this.p++] ?? { kind: 'eof' } }
  private atWord(s?: string): boolean {
    const t = this.peek()
    return t.kind === 'word' && (s === undefined || t.text === s)
  }
  private atOp(s?: string): boolean {
    const t = this.peek()
    return t.kind === 'op' && (s === undefined || t.op === s)
  }
  private describe(t: Tok): string {
    if (t.kind === 'word') return t.text
    if (t.kind === 'op') return t.op
    if (t.kind === 'newline') return 'newline'
    return 'end of file'
  }
  private fail(t: Tok, incomplete = false): null {
    if (!this.error) this.error = `bash: syntax error near unexpected token \`${this.describe(t)}'`
    if (incomplete) this.incomplete = true
    return null
  }
  private atStop(stops: Set<string>): boolean {
    const t = this.peek()
    if (t.kind === 'word' && stops.has(t.text)) return true
    if (t.kind === 'op' && stops.has(t.op)) return true
    return false
  }
  private atSeparator(): boolean {
    const t = this.peek()
    return t.kind === 'newline' || t.kind === 'eof' || (t.kind === 'op' && (t.op === ';' || t.op === '&'))
  }
  private skipSeparators(): void {
    for (;;) {
      const t = this.peek()
      if (t.kind === 'newline' || (t.kind === 'op' && (t.op === ';' || t.op === '&'))) this.next()
      else break
    }
  }

  parseProgram(stops: Set<string>): Cmd | null {
    const items: Cmd[] = []
    this.skipSeparators()
    while (!this.atStop(stops) && this.peek().kind !== 'eof') {
      const cmd = this.parseAndOr(stops)
      if (!cmd) return null
      items.push(cmd)
      if (this.atStop(stops) || this.peek().kind === 'eof') break
      if (!this.atSeparator()) return this.fail(this.peek())
      this.skipSeparators()
    }
    return { type: 'list', items }
  }

  private parseAndOr(stops: Set<string>): Cmd | null {
    const items: Cmd[] = []
    const ops: ('&&' | '||')[] = []
    for (;;) {
      const cmd = this.parsePipeline(stops)
      if (!cmd) return null
      items.push(cmd)
      const t = this.peek()
      if (t.kind === 'op' && (t.op === '&&' || t.op === '||')) {
        ops.push(t.op)
        this.next()
        continue
      }
      break
    }
    if (items.length === 1) return items[0]
    return { type: 'andor', items, ops }
  }

  private parsePipeline(stops: Set<string>): Cmd | null {
    let neg = false
    if (this.atWord('!')) { neg = true; this.next() }
    const stages: Cmd[] = []
    const stderrPipe: boolean[] = []
    for (;;) {
      let cmd = this.parseCommand(stops)
      if (!cmd) return null
      if (cmd.type !== 'simple' && cmd.type !== 'pipeline') {
        const rt = this.peek()
        if (rt.kind === 'op' && this.isRedirOp(rt.op)) {
          const redirs: Redir[] = []
          while (this.peek().kind === 'op' && this.isRedirOp((this.peek() as Tok & { kind: 'op' }).op)) {
            const r = this.parseRedir(this.peek())
            if (!r) return null
            redirs.push(r)
          }
          cmd = { ...cmd, redirs } as Cmd
        }
      }
      stages.push(cmd)
      const t = this.peek()
      if (t.kind === 'op' && (t.op === '|' || t.op === '|&')) {
        stderrPipe.push(t.op === '|&')
        this.next()
        if (this.peek().kind === 'newline' || this.peek().kind === 'eof') return this.fail(this.peek(), true)
        continue
      }
      break
    }
    if (stages.length === 1 && !neg) return stages[0]
    return { type: 'pipeline', neg, stages, stderrPipe }
  }

  private parseCommand(stops: Set<string>): Cmd | null {
    const t = this.peek()
    if (t.kind === 'eof' || t.kind === 'newline') return this.fail(t, true)
    if (t.kind === 'op') {
      if (t.op === '(') {
        const nxt = this.toks[this.p + 1]
        if (nxt?.kind === 'op' && nxt.op === '(') return this.parseArithCmd()
        return this.parseSubshell()
      }
      return this.fail(t)
    }
    // word commands / reserved words
    switch (t.text) {
      case 'if': return this.parseIf()
      case 'for': return this.parseFor()
      case 'while': case 'until': return this.parseWhile(t.text === 'until')
      case 'case': return this.parseCase()
      case 'function': return this.parseFunction()
      case 'time': {
        this.next()
        const cmd = this.parsePipeline(stops)
        if (!cmd) return null
        return { type: 'time', cmd }
      }
      case ']]': return this.fail(t)
      case 'fi': case 'then': case 'elif': case 'else': case 'do': case 'done': case 'esac': case 'in':
        if (!stops.has(t.text)) return this.fail(t)
        break
    }
    if (t.text === '[[') return this.parseCondCmd()
    if (t.text === '{') return this.parseGroup()
    // function definition: name () { ...; }
    const nxt = this.toks[this.p + 1]
    const nxt2 = this.toks[this.p + 2]
    if (t.kind === 'word' && NAME_RE.test(t.text) && nxt?.kind === 'op' && nxt.op === '(' && nxt2?.kind === 'op' && nxt2.op === ')') {
      this.next(); this.next(); this.next()
      const body = this.parseFuncBody()
      if (!body) return null
      return { type: 'func', name: t.text, body }
    }
    return this.parseSimple(stops)
  }

  private parseFuncBody(): Cmd | null {
    if (this.atWord('{')) {
      this.next()
      const body = this.parseProgram(new Set(['}']))
      if (!body) return null
      if (!this.atWord('}')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      this.next()
      return body
    }
    if (this.atOp('(')) {
      // bash also allows name () ( list ); keep it forgiving
      this.next()
      const body = this.parseProgram(new Set([')']))
      if (!body) return null
      if (!this.atOp(')')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      this.next()
      return body
    }
    return this.fail(this.peek(), true)
  }

  private parseIf(): Cmd | null {
    this.next() // if
    const cond = this.parseProgram(new Set(['then']))
    if (!cond) return null
    if (!this.atWord('then')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    const then = this.parseProgram(new Set(['fi', 'elif', 'else']))
    if (!then) return null
    const elifs: { cond: Cmd; then: Cmd }[] = []
    let els: Cmd | undefined
    while (this.atWord('elif')) {
      this.next()
      const c = this.parseProgram(new Set(['then']))
      if (!c) return null
      if (!this.atWord('then')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      this.next()
      const b = this.parseProgram(new Set(['fi', 'elif', 'else']))
      if (!b) return null
      elifs.push({ cond: c, then: b })
    }
    if (this.atWord('else')) {
      this.next()
      els = this.parseProgram(new Set(['fi'])) ?? undefined
      if (!els) return null
    }
    if (!this.atWord('fi')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'if', cond, then, elifs, els }
  }

  private parseFor(): Cmd | null {
    this.next() // for
    const forNxt = this.toks[this.p + 1]
    if (this.atOp('(') && forNxt?.kind === 'op' && forNxt.op === '(') {
      // for (( init; cond; update ))
      const name = 'for'
      this.next(); this.next()
      const exprs: string[] = []
      let cur: string[] = []
      let depth = 2
      for (;;) {
        const t = this.peek()
        if (t.kind === 'eof') return this.fail(t, true)
        if (t.kind === 'op') {
          if (t.op === '(') { depth++; cur.push('('); this.next(); continue }
          if (t.op === ')') {
            depth--
            this.next()
            if (depth === 0) {
              exprs.push(fixArithText(cur.join(' ')))
              cur = []
              break
            }
            continue
          }
          if (t.op === ';' && depth === 2) { exprs.push(fixArithText(cur.join(' '))); cur = []; this.next(); continue }
        }
        cur.push(this.tokenText(t))
        this.next()
      }
      while (exprs.length < 3) exprs.push('')
      return this.finishCompoundBody({ type: 'for', name, words: null, arith: exprs.slice(0, 3), body: { type: 'list', items: [] } }, ['do'])
    }
    const nameTok = this.next()
    if (nameTok.kind !== 'word' || !NAME_RE.test(nameTok.text)) return this.fail(nameTok)
    const name = nameTok.text
    let words: string[] | null = null
    if (this.atWord('in')) {
      this.next()
      words = []
      while (!this.atSeparator() && !this.atWord('do') && this.peek().kind !== 'eof') {
        const w = this.next()
        if (w.kind !== 'word') return this.fail(w)
        words.push(w.text)
      }
      this.skipSeparators()
    } else if (this.atWord('do')) {
      words = null
    } else if (this.atSeparator()) {
      words = null
      this.skipSeparators()
    } else {
      return this.fail(this.peek())
    }
    if (!this.atWord('do')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    const body = this.parseProgram(new Set(['done']))
    if (!body) return null
    if (!this.atWord('done')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'for', name, words, arith: null, body }
  }

  private finishCompoundBody(cmd: Cmd, stopWords: string[]): Cmd | null {
    // used by arith for: parse `; do body done`
    void stopWords
    if (this.atOp(';')) this.next()
    this.skipSeparators()
    if (this.atWord('do')) {
      this.next()
      const body = this.parseProgram(new Set(['done']))
      if (!body) return null
      if (!this.atWord('done')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      this.next()
      if (cmd.type === 'for') return { ...cmd, body }
      return cmd
    }
    if (this.atWord('done')) return this.fail(this.peek())
    return this.fail(this.peek(), true)
  }

  private tokenText(t: Tok): string {
    if (t.kind === 'word') return t.text
    if (t.kind === 'op') return t.op
    return ''
  }

  private parseWhile(until: boolean): Cmd | null {
    this.next()
    const cond = this.parseProgram(new Set(['do']))
    if (!cond) return null
    if (!this.atWord('do')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    const body = this.parseProgram(new Set(['done']))
    if (!body) return null
    if (!this.atWord('done')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'while', cond, body, until }
  }

  private parseCase(): Cmd | null {
    this.next() // case
    const w = this.next()
    if (w.kind !== 'word') return this.fail(w)
    if (!this.atWord('in')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    this.skipSeparators()
    const arms: { pats: string[]; body: Cmd; term: ';;' | ';&' | ';;&' }[] = []
    while (!this.atWord('esac') && this.peek().kind !== 'eof') {
      const pats: string[] = []
      for (;;) {
        const p = this.next()
        if (p.kind === 'op' && p.op === '(') continue
        if (p.kind !== 'word') return this.fail(p)
        pats.push(p.text)
        if (this.atOp('|')) { this.next(); continue }
        break
      }
      if (!this.atOp(')')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      this.next()
      const body = this.parseProgram(new Set([';;', ';&', ';;&', 'esac']))
      if (!body) return null
      let term: ';;' | ';&' | ';;&' = ';;'
      if (this.atOp(';;')) { this.next() }
      else if (this.atOp(';&')) { term = ';&'; this.next() }
      else if (this.atOp(';;&')) { term = ';;&'; this.next() }
      else if (!this.atWord('esac')) {
        if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
        return this.fail(this.peek())
      }
      arms.push({ pats, body, term })
      this.skipSeparators()
    }
    if (!this.atWord('esac')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'case', word: w.text, arms }
  }

  private parseFunction(): Cmd | null {
    this.next() // function
    const nameTok = this.next()
    if (nameTok.kind !== 'word' || !NAME_RE.test(nameTok.text)) return this.fail(nameTok)
    if (this.atOp('(')) {
      this.next()
      if (!this.atOp(')')) return this.fail(this.peek())
      this.next()
    }
    const body = this.parseFuncBody()
    if (!body) return null
    return { type: 'func', name: nameTok.text, body }
  }

  private parseSubshell(): Cmd | null {
    this.next() // (
    const body = this.parseProgram(new Set([')']))
    if (!body) return null
    if (!this.atOp(')')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'subshell', body }
  }

  private parseGroup(): Cmd | null {
    this.next() // {
    const body = this.parseProgram(new Set(['}']))
    if (!body) return null
    if (!this.atWord('}')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'group', body }
  }

  private parseArithCmd(): Cmd | null {
    this.next(); this.next() // (( 
    const expr = this.collectArith()
    if (expr === null) return null
    return { type: 'arith', expr }
  }

  private collectArith(): string | null {
    const parts: string[] = []
    let depth = 2
    for (;;) {
      const t = this.peek()
      if (t.kind === 'eof') return this.fail(t, true)
      if (t.kind === 'op') {
        if (t.op === '(') { depth++; parts.push('('); this.next(); continue }
        else if (t.op === ')') {
          depth--
          this.next()
          if (depth === 0) return fixArithText(parts.join(' '))
          continue
        }
      }
      parts.push(this.tokenText(t))
      this.next()
    }
  }

  private parseCondCmd(): Cmd | null {
    this.next() // [[
    const expr = this.parseCondExpr()
    if (!expr) return null
    if (!this.atWord(']]')) {
      if (this.peek().kind === 'eof') return this.fail(this.peek(), true)
      return this.fail(this.peek())
    }
    this.next()
    return { type: 'cond', expr }
  }

  private parseCondExpr(): CondExpr | null {
    const t = this.peek()
    if (t.kind === 'word' && t.text === '!') {
      this.next()
      const e = this.parseCondExpr()
      if (!e) return null
      return { type: 'not', e }
    }
    if (t.kind === 'op' && t.op === '(') {
      this.next()
      const e = this.parseCondExpr()
      if (!e) return null
      if (!this.atOp(')')) return this.fail(this.peek())
      this.next()
      if (this.atOp('&&')) { this.next(); const r = this.parseCondExpr(); if (!r) return null; return { type: 'and', a: { type: 'group', e }, b: r } }
      if (this.atOp('||')) { this.next(); const r = this.parseCondExpr(); if (!r) return null; return { type: 'or', a: { type: 'group', e }, b: r } }
      return { type: 'group', e }
    }
    const args: string[] = []
    for (;;) {
      const u = this.peek()
      if (u.kind === 'eof') return this.fail(u, true)
      if (u.kind === 'word' && u.text === ']]') break
      if (u.kind === 'op' && (u.op === '&&' || u.op === '||')) break
      if (u.kind === 'op' && u.op === ')') break
      if (u.kind === 'newline') break
      args.push(this.tokenText(u))
      this.next()
    }
    if (args.length === 0) return this.fail(this.peek())
    const left: CondExpr = { type: 'test', args }
    if (this.atOp('&&')) {
      this.next()
      const r = this.parseCondExpr()
      if (!r) return null
      return { type: 'and', a: left, b: r }
    }
    if (this.atOp('||')) {
      this.next()
      const r = this.parseCondExpr()
      if (!r) return null
      return { type: 'or', a: left, b: r }
    }
    return left
  }

  private parseSimple(stops: Set<string>): Cmd | null {
    const assigns: Assign[] = []
    const words: string[] = []
    const redirs: Redir[] = []
    let seenCmd = false
    for (;;) {
      const t = this.peek()
      if (t.kind === 'eof' || t.kind === 'newline') break
      if (t.kind === 'op') {
        if (t.op === ';' || t.op === '&' || t.op === ';;' || t.op === ';&' || t.op === ';;&' || t.op === '|' || t.op === '|&' || t.op === '&&' || t.op === '||') break
        if (this.isRedirOp(t.op)) {
          const r = this.parseRedir(t)
          if (!r) return null
          redirs.push(r)
          continue
        }
        if (t.op === '(' || t.op === ')') break
        return this.fail(t)
      }
      if (this.atStop(stops) && !seenCmd && words.length === 0 && assigns.length === 0 && redirs.length === 0) break
      const text = t.text
      // indexed assignment: NAME[IDX]=VALUE
      const idxM = /^([A-Za-z_][A-Za-z0-9_]*)\[([^\]]*)\]=(.*)$/.exec(text)
      if (idxM && !seenCmd && words.length === 0) {
        this.next()
        assigns.push({ name: idxM[1], value: idxM[3], index: idxM[2] })
        continue
      }
      // array literal: NAME=(...) or NAME+=(...)
      const arrNxt = this.toks[this.p + 1]
      if (/^[A-Za-z_][A-Za-z0-9_]*\+?=$/.test(text) && arrNxt?.kind === 'op' && arrNxt.op === '(') {
        const append = text.endsWith('+=')
        const name = append ? text.slice(0, -2) : text.slice(0, -1)
        this.next() // name=
        this.next() // (
        const parts: string[] = []
        for (;;) {
          const u = this.peek()
          if (u.kind === 'eof') return this.fail(u, true)
          if (u.kind === 'op' && u.op === ')') { this.next(); break }
          if (u.kind === 'newline') { this.next(); continue }
          if (u.kind !== 'word') return this.fail(u)
          parts.push(u.text)
          this.next()
        }
        if (!seenCmd) {
          assigns.push({ name, value: null, append, array: parts })
        } else {
          words.push(`${name}${append ? '+=' : '='}(${parts.join(' ')})`)
        }
        continue
      }
      this.next()
      if (!seenCmd && words.length === 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(text)) {
        const eq = text.indexOf('=')
        const name = text.slice(0, eq)
        const value = text.slice(eq + 1)
        const nxtTok = this.toks[this.p]
        if (value === '' && nxtTok?.kind === 'op' && nxtTok.op === '(') {
          // shouldn't happen (handled above) but keep safe
          words.push(text)
          continue
        }
        assigns.push({ name, value })
        continue
      }
      if (!seenCmd) seenCmd = true
      words.push(text)
    }
    return { type: 'simple', assigns, words, redirs }
  }

  private isRedirOp(op: string): boolean {
    return /^(\d+)?(>>|<<-|<<<|<<|>&|<&|<>|>|<|&>>|&>|>\|)$/.test(op)
  }

  private parseRedir(t: Tok): Redir | null {
    const opTok = this.next() as Tok & { kind: 'op' }
    const op = opTok.op
    let fd = op === '<' || op === '<<' || op === '<<-' || op === '<<<' || op === '<&' || op === '<>' ? 0 : 1
    let base = op
    const m = /^(\d+)(.+)$/.exec(op)
    if (m) {
      fd = Number(m[1])
      base = m[2]
    }
    const r: Redir = { fd, op: base, target: null }
    if (base === '<<' || base === '<<-') {
      r.heredoc = opTok.heredoc
      return r
    }
    const target = this.next()
    if (target.kind !== 'word') {
      if (target.kind === 'eof' || target.kind === 'newline') return this.fail(target, true)
      return this.fail(target)
    }
    r.target = target.text
    return r
  }
}
