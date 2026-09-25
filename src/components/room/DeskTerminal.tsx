'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSfx } from './RoomSfxProvider'
import { ScreenStrip } from './ScreenStrip'
import { TermEditor, TERM_FONT, TERM_FONT_SIZE, TERM_LINE_H } from './TermEditor'
import { Shell } from '@/lib/terminal/shell/shell'
import { COMMANDS } from '@/lib/terminal/commands'
import { getTerminalFs } from '@/lib/terminal/session'
import { HISTORY_KEY, HOME } from '@/lib/terminal/seed'
import { appendOutput, parseAnsi, stripAnsi } from '@/lib/terminal/ansi'
import { createNano } from '@/lib/terminal/editors/nano'
import { createVim } from '@/lib/terminal/editors/vim'
import { FsError, VFS } from '@/lib/terminal/vfs'
import type { Editor, EditorHost, TerminalIO } from '@/lib/terminal/types'

const FG = '#35e65c'
const BG = '#0a0a0a'

interface DeskTerminalProps {
  time: string
  labels: { title: string }
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
  readmeContent: string
  /** Run this command line once the shell is up (used when a desktop file is opened). */
  bootCommand?: string | null
  onBootHandled?: () => void
}

interface EditorReq { kind: 'nano' | 'vim' | 'less'; path: string; opts?: { readOnly?: boolean; lineNumbers?: boolean }; done: () => void }

const Line = memo(function Line({ s }: { s: string }) {
  const spans = parseAnsi(s)
  if (!spans.length) return <div>&nbsp;</div>
  return (
    <div>
      {spans.map((sp, i) => {
        const fg = sp.inv ? sp.bg ?? BG : sp.fg
        const bg = sp.inv ? sp.fg ?? FG : sp.bg
        return (
          <span key={i} style={{ color: fg, background: bg, fontWeight: sp.bold ? 700 : undefined, opacity: sp.dim ? 0.6 : undefined, textDecoration: sp.ul ? 'underline' : undefined }}>
            {sp.t}
          </span>
        )
      })}
    </div>
  )
})

function columns(items: string[], width: number): string {
  const w = Math.max(...items.map((s) => s.length)) + 2
  const per = Math.max(1, Math.floor(width / w))
  const rows = Math.ceil(items.length / per)
  let out = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < per; c++) {
      const it = items[c * rows + r]
      if (it !== undefined) out += it.padEnd(w)
    }
    out = out.trimEnd() + '\n'
  }
  return out
}

function commonPrefix(a: string[]): string {
  let p = a[0]
  for (const s of a) while (!s.startsWith(p)) p = p.slice(0, -1)
  return p
}

export function DeskTerminal({ time, labels, desktopLabel, backLabel, onDesktop, onBack, readmeContent, bootCommand, onBootHandled }: DeskTerminalProps) {
  const sfx = useSfx()
  const [lines, setLines] = useState<string[]>([''])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'boot' | 'idle' | 'busy' | 'reading'>('boot')
  const [editor, setEditor] = useState<EditorReq | null>(null)
  const [promptStr, setPromptStr] = useState('$ ')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)

  const linesRef = useRef<string[]>([''])
  const raf = useRef(0)
  const shellRef = useRef<Shell | null>(null)
  const pending = useRef('') // unfinished multi-line command
  const histRef = useRef<string[]>([])
  const histIdx = useRef(-1)
  const draft = useRef('')
  const tabs = useRef(0)
  const readRes = useRef<((s: string | null) => void) | null>(null)
  const cursorTo = useRef<number | null>(null)
  const stick = useRef(true)
  const sizeRef = useRef({ cols: 80, rows: 20 })
  const booted = useRef(false)
  const gen = useRef(0)
  const alive = useRef(true)
  const props = useRef({ onDesktop, sfx, bootCommand, onBootHandled })
  props.current = { onDesktop, sfx, bootCommand, onBootHandled }
  const modeRef = useRef(mode)
  modeRef.current = mode
  const inputVal = useRef(input)
  inputVal.current = input

  const flush = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => { raf.current = 0; setLines(linesRef.current) })
  }, [])
  const write = useCallback((s: string) => { linesRef.current = appendOutput(linesRef.current, s); flush() }, [flush])

  const refreshPrompt = useCallback(() => { if (shellRef.current) setPromptStr(pending.current ? shellRef.current.ps2 : shellRef.current.prompt()) }, [])

  const measureSize = useCallback(() => {
    const box = scrollRef.current
    const probe = probeRef.current
    if (!box || !probe) return
    const scale = box.offsetWidth ? box.getBoundingClientRect().width / box.offsetWidth : 1
    const w = probe.getBoundingClientRect().width / 40 / (scale || 1)
    if (w > 0) sizeRef.current = { cols: Math.max(20, Math.floor((box.clientWidth - 16) / w)), rows: Math.max(6, Math.floor(box.clientHeight / TERM_LINE_H)) }
  }, [])

  const makeEditor = useCallback((req: EditorReq, rows: number, cols: number): Editor => {
    const fs = getTerminalFs(readmeContent)
    const sh = shellRef.current!
    const host: EditorHost = {
      readFile: (p) => { try { return fs.readFile(p) } catch { return null } },
      writeFile: (p, d) => { try { fs.writeFile(p, d); return null } catch (e) { return e instanceof FsError ? e.reason : String(e) } },
      exists: (p) => fs.exists(p),
      resolve: (p) => VFS.resolve(sh.cwd, p, HOME),
    }
    if (req.kind === 'nano') return createNano(host, req.path, rows, cols, { lineNumbers: req.opts?.lineNumbers })
    return createVim(host, req.path, rows, cols, req.kind === 'less' || req.opts?.readOnly ? { readOnly: true } : undefined)
  }, [readmeContent])

  const io = useRef<TerminalIO | null>(null)
  if (!io.current) {
    io.current = {
      write: (s) => write(s),
      clear: () => { linesRef.current = ['']; flush() },
      readLine: (prompt) => new Promise((res) => { if (prompt) write(prompt); readRes.current = res; setMode('reading'); setInput('') }),
      edit: (kind, path, opts) => new Promise<void>((res) => { setEditor({ kind, path, opts, done: res }) }),
      exit: () => props.current.onDesktop(),
      download: (name, data) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain;charset=utf-8' }))
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      },
      setSfx: (on) => props.current.sfx.setEnabled(on),
      size: () => sizeRef.current,
    }
  }

  const saveHistory = useCallback(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(histRef.current.slice(-500))) } catch { /* storage blocked */ }
  }, [])

  const submit = useCallback(async (text: string) => {
    const sh = shellRef.current
    if (!sh) return
    write((pending.current ? sh.ps2 : sh.prompt()) + text + '\n')
    const buffer = pending.current ? pending.current + '\n' + text : text
    if (!buffer.trim()) { pending.current = ''; refreshPrompt(); return }
    setMode('busy')
    try {
      const r = await sh.run(buffer)
      if (r.incomplete) pending.current = buffer
      else {
        pending.current = ''
        const entry = buffer.includes('<<') ? buffer.split('\n')[0] : buffer.split('\n').join('; ')
        if (histRef.current[histRef.current.length - 1] !== entry) { histRef.current.push(entry); sh.addHistory(entry); saveHistory() }
      }
    } catch (e) {
      write(`bash: internal error: ${e instanceof Error ? e.message : String(e)}\n`)
      pending.current = ''
    }
    if (!alive.current) return
    refreshPrompt()
    setMode('idle')
  }, [write, refreshPrompt, saveHistory])

  // Boot: filesystem, shell, history, ~/.bashrc, banner
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    alive.current = true
    const g = ++gen.current // dev StrictMode mounts twice; only the latest boot may continue
    linesRef.current = ['']
    histRef.current = []
    const fs = getTerminalFs(readmeContent)
    const sh = new Shell({ fs, io: io.current!, commands: COMMANDS })
    shellRef.current = sh
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
      if (Array.isArray(h)) for (const l of h) if (typeof l === 'string') { histRef.current.push(l); sh.addHistory(l) }
    } catch { /* no history yet */ }
    measureSize()
    void (async () => {
      write('\x1b[1mahmed-os 1.0\x1b[0m  (GNU/Linux in your browser)\nType \x1b[1mhelp\x1b[0m for commands. nano, vim, ls, grep, awk and friends all work; ~/Desktop shows on the desktop.\n\n')
      await sh.init()
      if (g !== gen.current) return
      refreshPrompt()
      setMode('idle')
      const boot = props.current.bootCommand
      if (boot) { props.current.onBootHandled?.(); await submit(boot) }
    })()
    return undefined
  }, [readmeContent, write, refreshPrompt, measureSize, submit])

  useEffect(() => () => {
    alive.current = false
    booted.current = false
    shellRef.current?.abort()
    readRes.current?.(null)
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  // Keep measurements current and the view pinned to the bottom
  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    const ro = new ResizeObserver(measureSize)
    ro.observe(box)
    return () => ro.disconnect()
  }, [measureSize, editor])
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (box && stick.current) box.scrollTop = box.scrollHeight
  }, [lines, mode, input, promptStr])
  useLayoutEffect(() => {
    if (cursorTo.current !== null && inputRef.current) { inputRef.current.setSelectionRange(cursorTo.current, cursorTo.current); cursorTo.current = null }
  })
  useEffect(() => { if (!editor) inputRef.current?.focus() }, [editor, mode])

  const setLine = (v: string, at = v.length) => { setInput(v); cursorTo.current = at }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const sh = shellRef.current
    const m = modeRef.current
    if (e.ctrlKey && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase()
      if (k === 'c') {
        e.preventDefault()
        if (m === 'busy' || m === 'reading') { sh?.abort(); readRes.current?.(null); readRes.current = null; write('^C\n') }
        else { write((sh ? (pending.current ? sh.ps2 : sh.prompt()) : '') + input + '^C\n'); pending.current = ''; setLine(''); refreshPrompt() }
        return
      }
      if (k === 'l') { e.preventDefault(); io.current!.clear(); return }
      if (k === 'd') {
        e.preventDefault()
        if (input) return
        if (m === 'reading') { const r = readRes.current; readRes.current = null; write('\n'); r?.(null); setMode('busy'); return }
        if (m === 'idle') { if (pending.current) { pending.current = ''; write('bash: syntax error: unexpected end of file\n'); refreshPrompt() } else { write('exit\n'); props.current.onDesktop() } }
        return
      }
      if (k === 'u') { e.preventDefault(); setLine(input.slice(el.selectionStart ?? 0), 0); return }
      if (k === 'k') { e.preventDefault(); setLine(input.slice(0, el.selectionStart ?? input.length)); return }
      if (k === 'w') {
        e.preventDefault()
        const at = el.selectionStart ?? input.length
        const head = input.slice(0, at).replace(/\S+\s*$/, '')
        setLine(head + input.slice(at), head.length)
        return
      }
      if (k === 'a') { e.preventDefault(); el.setSelectionRange(0, 0); return }
      if (k === 'e') { e.preventDefault(); el.setSelectionRange(input.length, input.length); return }
    }
    if (m === 'busy') { if (e.key.length === 1 || e.key === 'Enter') e.preventDefault(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const text = input
      tabs.current = 0; histIdx.current = -1
      setLine('')
      if (m === 'reading') { const r = readRes.current; readRes.current = null; write(text + '\n'); setMode('busy'); r?.(text) }
      else void submit(text)
      return
    }
    if (m !== 'idle') return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const h = histRef.current
      if (!h.length) return
      if (e.key === 'ArrowUp') {
        if (histIdx.current === -1) { draft.current = input; histIdx.current = h.length - 1 }
        else if (histIdx.current > 0) histIdx.current--
        setLine(h[histIdx.current])
      } else if (histIdx.current !== -1) {
        histIdx.current++
        if (histIdx.current >= h.length) { histIdx.current = -1; setLine(draft.current) }
        else setLine(h[histIdx.current])
      }
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (!sh) return
      const at = el.selectionStart ?? input.length
      const before = input.slice(0, at)
      const { start, candidates } = sh.complete(before)
      if (!candidates.length) return
      const done = (rep: string) => setLine(input.slice(0, start) + rep + input.slice(at), start + rep.length)
      if (candidates.length === 1) { done(candidates[0] + (candidates[0].endsWith('/') ? '' : ' ')); tabs.current = 0; return }
      const p = commonPrefix(candidates)
      if (p.length > before.length - start) { done(p); tabs.current = 0; return }
      tabs.current++
      if (tabs.current >= 2) write(sh.prompt() + input + '\n' + columns(candidates.map((c) => stripAnsi(c)), sizeRef.current.cols))
      return
    }
    tabs.current = 0
    if (e.key === 'Escape') return // bubbles: the desk steps back to the desktop
    if (e.key.length === 1 || e.key === 'Backspace') histIdx.current = -1
  }

  const last = lines[lines.length - 1] ?? ''
  const head = lines.slice(0, -1)
  const showPrompt = mode === 'idle'

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: BG }}>
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />

      {editor && (
        <TermEditor
          make={(rows, cols) => makeEditor(editor, rows, cols)}
          onDone={() => { const e = editor; setEditor(null); e.done() }}
        />
      )}

      <div
        ref={scrollRef}
        onScroll={(e) => { const b = e.currentTarget; stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 24 }}
        onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus() }}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-1"
        style={{ display: editor ? 'none' : undefined, fontFamily: TERM_FONT, fontSize: TERM_FONT_SIZE, lineHeight: TERM_LINE_H + 'px', color: FG, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        <span ref={probeRef} aria-hidden style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }}>{'M'.repeat(40)}</span>
        <div role="log" aria-live="off">
          {head.map((s, i) => <Line key={i} s={s} />)}
        </div>
        <div className="flex items-start">
          <div className="flex-shrink-0" style={{ whiteSpace: 'pre-wrap' }}>
            <Line s={last + (showPrompt ? promptStr : '')} />
          </div>
          <input
            ref={inputRef}
            value={mode === 'busy' || mode === 'boot' ? '' : input}
            onChange={(e) => { if (modeRef.current === 'idle' || modeRef.current === 'reading') setInput(e.target.value) }}
            onKeyDown={onKeyDown}
            readOnly={mode === 'busy' || mode === 'boot'}
            className="flex-1 min-w-0 outline-none"
            style={{ font: 'inherit', color: FG, background: 'transparent', caretColor: FG, padding: 0, border: 0, opacity: mode === 'busy' ? 0 : 1 }}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  )
}
