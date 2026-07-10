'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSfx } from './RoomSfxProvider'
import { ScreenStrip, StripButton } from './ScreenStrip'

interface TerminalLabels {
  title: string
}

interface DeskTerminalProps {
  labels: TerminalLabels
  desktopLabel: string
  onDesktop: () => void
  readmeContent: string
}

export function DeskTerminal({ labels, desktopLabel, onDesktop, readmeContent }: DeskTerminalProps) {
  const sfx = useSfx()
  const [lines, setLines] = useState<string[]>([
    'Type help for a list of commands.',
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addLines = useCallback((...newLines: string[]) => {
    setLines((prev) => [...prev, ...newLines])
  }, [])

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    addLines('guest@ahmed:~$ ' + trimmed)

    const command = trimmed.toLowerCase()

    if (command === 'help') {
      addLines(
        'Available commands:',
        '  help          Show this help',
        '  whoami        Who am I?',
        '  ls            List files',
        '  cat <file>    Read a file',
        '  clock         Show current time',
        '  sfx on|off    Toggle sound effects',
        '  clear         Clear the screen',
        '  exit          Return to desktop',
      )
    } else if (command === 'whoami') {
      addLines('guest')
    } else if (command === 'ls') {
      addLines('readme.txt   secrets.txt')
    } else if (command === 'cat readme.txt') {
      for (const line of readmeContent.split('\n')) {
        addLines(line)
      }
    } else if (command === 'cat secrets.txt') {
      addLines('Nothing to see here. Move along.')
    } else if (command === 'clock') {
      addLines(new Date().toLocaleString())
    } else if (command === 'sfx on') {
      sfx.setEnabled(true)
      addLines('SFX: on')
    } else if (command === 'sfx off') {
      sfx.setEnabled(false)
      addLines('SFX: off')
    } else if (command === 'clear') {
      setLines([])
    } else if (command === 'exit') {
      onDesktop()
    } else {
      addLines('command not found: ' + trimmed)
    }
  }, [addLines, readmeContent, sfx, onDesktop])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(input)
      setInput('')
    }
  }, [input, handleCommand])

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#0a0a0a' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>
          {desktopLabel}
        </StripButton>
      </ScreenStrip>

      {/* Scrollback area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2"
        style={{
          fontFamily: 'var(--font-pixel), "Courier New", monospace',
          fontSize: '10px',
          lineHeight: '1.5',
          color: '#35e65c',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ wordBreak: 'break-all' }}>{line}</div>
        ))}
      </div>

      {/* Input line with prompt and blinking cursor */}
      <div
        className="flex items-center px-2 py-1 border-t flex-shrink-0"
        style={{ borderColor: '#1a3a1a' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            fontSize: '10px',
            color: '#35e65c',
            whiteSpace: 'nowrap',
          }}
        >
          guest@ahmed:~$&nbsp;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 outline-none"
          style={{
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            fontSize: '10px',
            color: '#35e65c',
            backgroundColor: 'transparent',
            caretColor: '#35e65c',
          }}
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminal input"
        />
      </div>
    </div>
  )
}
