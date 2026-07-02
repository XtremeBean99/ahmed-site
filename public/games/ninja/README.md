# Super Ninja Monk Fighter IV — Web Build

After exporting from Godot (Project → Export → HTML5), copy the following files
into this directory:

- index.html
- index.js (or the generated .js bundle)
- index.audio.worklet.js (if audio worklet is enabled)
- index.pck
- index.wasm
- index.side.wasm (if threads are enabled)
- coi-serviceworker.js (if using SharedArrayBuffer)
- Any .icon.png favicon file

The game will then be playable at https://ahmedyhussain.com/games/ninja/
and embedded on the project page at /projects/ninja.

## Export settings used:
- Canvas resize: Project (Adaptive)
- Head include: dark background CSS
- Threads: disabled (simpler deployment)
- VRAM texture compression: enabled for desktop
