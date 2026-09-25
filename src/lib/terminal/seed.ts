import { VFS } from './vfs'

export const HOME = '/home/guest'
export const DESKTOP = HOME + '/Desktop'
const STORAGE_KEY = 'room-terminal-fs-v1'

const BASHRC = `# ~/.bashrc: runs at the start of every terminal session.
# Add aliases and exports here, they persist.
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
export EDITOR=nano
`

const HELLO = `#!/bin/bash
# chmod +x hello.sh && ./hello.sh
name=\${1:-world}
for i in 1 2 3; do
  echo "hello, $name ($i)"
done
`

const MOTD = `Welcome to ahmed-os 1.0 (GNU/Linux, in your browser)

 * Everything here is real bash, on a virtual disk saved in this browser.
 * Type 'help' to get started. Try nano, vim, ls, grep, find, sed, awk.
 * Files in ~/Desktop show up on the desktop of this screen.
`

/** Build a fresh filesystem image. `readme`/`changelog` are the site's own texts. */
export function seedFs(readme: string, changelog: string): VFS {
  const fs = new VFS()
  fs.batch(() => {
    for (const d of ['/bin', '/etc', '/tmp', '/usr/bin', '/var/log', '/dev', HOME, DESKTOP, HOME + '/Documents', HOME + '/projects']) fs.mkdir(d, true)
    fs.writeFile('/etc/hostname', 'ahmed\n')
    fs.writeFile('/etc/motd', MOTD)
    fs.writeFile('/etc/os-release', 'NAME="ahmed-os"\nVERSION="1.0"\nID=ahmedos\nPRETTY_NAME="ahmed-os 1.0 (in your browser)"\n')
    fs.writeFile('/etc/passwd', 'root:x:0:0:root:/root:/bin/bash\nguest:x:1000:1000:Guest:/home/guest:/bin/bash\n')
    fs.writeFile('/dev/null', '')
    fs.writeFile(HOME + '/readme.txt', readme.endsWith('\n') ? readme : readme + '\n')
    fs.writeFile(HOME + '/changelog.txt', changelog)
    fs.writeFile(HOME + '/secrets.txt', 'Nothing to see here. Move along.\n')
    fs.writeFile(HOME + '/.bashrc', BASHRC)
    fs.writeFile(HOME + '/hello.sh', HELLO)
    fs.chmod(HOME + '/hello.sh', 0o755)
    fs.writeFile(HOME + '/Documents/notes.txt', 'Edit me with nano or vim.\n')
  })
  return fs
}

/** Load the saved disk (or seed a new one). Never throws. */
export function loadFs(readme: string, changelog: string): VFS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const fs = VFS.fromJSON(JSON.parse(raw))
      if (fs && fs.isDir(HOME)) return fs
    }
  } catch { /* corrupt or blocked storage: start fresh */ }
  return seedFs(readme, changelog)
}

/** Persist on change (debounced). Returns an unsubscribe. */
export function autosaveFs(fs: VFS): () => void {
  let t: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fs.toJSON())) } catch { /* quota or blocked: session-only */ }
  }
  const off = fs.onChange(() => { if (t) clearTimeout(t); t = setTimeout(save, 400) })
  return () => { off(); if (t) { clearTimeout(t); save() } }
}

export const HISTORY_KEY = 'room-terminal-history-v1'
