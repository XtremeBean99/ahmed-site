// DOM-free vim editor entry point.
import type { Editor, EditorHost } from '../types'
import { VimEx } from './vim-ex'

export function createVim(host: EditorHost, path: string, rows: number, cols: number, opts?: { readOnly?: boolean }): Editor {
  const vim = new VimEx(host, path, rows, cols, opts)
  return {
    key: (k) => vim.key(k),
    paste: (text) => vim.paste(text),
    render: () => vim.render(),
    resize: (r, c) => vim.resize(r, c),
    get done() {
      return vim.done
    },
  }
}
