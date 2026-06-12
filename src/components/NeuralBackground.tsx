"use client";

/**
 * NeuralBackground
 *
 * A real neural network (4-10-8-2 MLP, hand-written backprop, no libraries)
 * that trains live in the visitor's browser. Input: cursor position and
 * velocity. Target: where the cursor actually is ~200ms later. The network
 * graph is the hero background: edge thickness and colour are the live
 * weights (teal positive, amber negative), node glow is activation, and the
 * ring is the network's current prediction chasing the real cursor. Watch
 * the loss fall as it learns you.
 *
 * With no pointer (phones, idle), a slow Lissajous driver stands in so the
 * network always has something to learn.
 */

import { useEffect, useRef, useState } from "react";

const LAYERS: readonly number[] = [4, 10, 8, 2];
const HORIZON = 12; // predict this many samples ahead (~200ms at 60fps)
const BUFFER_SIZE = 240;
const BATCH = 8;
const STEPS_PER_FRAME = 4;
const TEAL = "45, 212, 191";
const AMBER = "245, 158, 11";

interface Sample {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Net {
  w: number[][][];
  b: number[][];
}

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createNet(): Net {
  const w: number[][][] = [];
  const b: number[][] = [];
  for (let l = 1; l < LAYERS.length; l++) {
    const fanIn = LAYERS[l - 1];
    w.push(
      Array.from({ length: LAYERS[l] }, () =>
        Array.from({ length: fanIn }, () => randn() * Math.sqrt(1 / fanIn))
      )
    );
    b.push(Array.from({ length: LAYERS[l] }, () => 0));
  }
  return { w, b };
}

/** Forward pass; returns activations for every layer (for drawing). */
function forward(net: Net, input: number[]): number[][] {
  const acts: number[][] = [input];
  for (let l = 0; l < net.w.length; l++) {
    const prev = acts[l];
    const isLast = l === net.w.length - 1;
    const out: number[] = new Array(net.w[l].length);
    for (let j = 0; j < net.w[l].length; j++) {
      let z = net.b[l][j];
      const row = net.w[l][j];
      for (let i = 0; i < row.length; i++) z += row[i] * prev[i];
      out[j] = isLast ? z : Math.tanh(z);
    }
    acts.push(out);
  }
  return acts;
}

/** One SGD step on a minibatch. Returns mean squared error. */
function trainBatch(
  net: Net,
  batch: { input: number[]; target: number[] }[],
  lr: number
): number {
  const gw = net.w.map((layer) => layer.map((row) => row.map(() => 0)));
  const gb = net.b.map((layer) => layer.map(() => 0));
  let loss = 0;

  for (const { input, target } of batch) {
    const acts = forward(net, input);
    const L = net.w.length;
    // output delta (linear output, 0.5*MSE loss)
    let delta = acts[L].map((a, j) => {
      const d = a - target[j];
      loss += 0.5 * d * d;
      return d;
    });
    for (let l = L - 1; l >= 0; l--) {
      const prev = acts[l];
      for (let j = 0; j < net.w[l].length; j++) {
        gb[l][j] += delta[j];
        for (let i = 0; i < prev.length; i++) {
          gw[l][j][i] += delta[j] * prev[i];
        }
      }
      if (l > 0) {
        const next: number[] = new Array(LAYERS[l]).fill(0);
        for (let i = 0; i < LAYERS[l]; i++) {
          let s = 0;
          for (let j = 0; j < net.w[l].length; j++) {
            s += net.w[l][j][i] * delta[j];
          }
          next[i] = s * (1 - acts[l][i] * acts[l][i]); // tanh'
        }
        delta = next;
      }
    }
  }

  const k = lr / batch.length;
  for (let l = 0; l < net.w.length; l++) {
    for (let j = 0; j < net.w[l].length; j++) {
      net.b[l][j] -= k * gb[l][j];
      for (let i = 0; i < net.w[l][j].length; i++) {
        net.w[l][j][i] -= k * gw[l][j][i];
      }
    }
  }
  return loss / batch.length;
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ loss: 1, steps: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const net = createNet();
    const buffer: Sample[] = [];
    const stats = { loss: 1, steps: 0 };
    const pointer = { x: 0.5, y: 0.5, lastMove: 0 };
    const target = { x: 0.5, y: 0.5, px: 0.5, py: 0.5 };
    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let inView = true;
    let t = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      pointer.y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      pointer.lastMove = performance.now();
    };

    const nodePos = (l: number, j: number): [number, number] => {
      const colX = [0.14, 0.38, 0.62, 0.86][l] * width;
      const n = LAYERS[l];
      const spread = Math.min(height * 0.62, n * 54);
      const y = height / 2 + (n === 1 ? 0 : (j / (n - 1) - 0.5) * spread);
      return [colX, y];
    };

    const draw = (acts: number[][], pred: [number, number]) => {
      ctx.clearRect(0, 0, width, height);

      // edges = live weights
      for (let l = 0; l < net.w.length; l++) {
        for (let j = 0; j < net.w[l].length; j++) {
          const [x2, y2] = nodePos(l + 1, j);
          for (let i = 0; i < net.w[l][j].length; i++) {
            const wgt = net.w[l][j][i];
            const mag = Math.min(Math.abs(wgt), 2.5);
            if (mag < 0.04) continue;
            const [x1, y1] = nodePos(l, i);
            const flow = Math.abs(acts[l][i]); // signal actually flowing
            ctx.strokeStyle = `rgba(${wgt > 0 ? TEAL : AMBER}, ${
              0.05 + mag * 0.1 + flow * 0.08
            })`;
            ctx.lineWidth = 0.4 + mag * 0.9;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      }

      // nodes = live activations
      for (let l = 0; l < LAYERS.length; l++) {
        for (let j = 0; j < LAYERS[l]; j++) {
          const [x, y] = nodePos(l, j);
          const a = Math.min(Math.abs(acts[l][j] ?? 0), 1);
          ctx.beginPath();
          ctx.arc(x, y, 2.5 + a * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${TEAL}, ${0.25 + a * 0.6})`;
          ctx.fill();
        }
      }

      // actual target (small dot) and the network's prediction (ring)
      const tx = target.x * width;
      const ty = target.y * height;
      const px = Math.min(1, Math.max(0, pred[0])) * width;
      const py = Math.min(1, Math.max(0, pred[1])) * height;

      ctx.strokeStyle = `rgba(${TEAL}, 0.35)`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL}, 0.8)`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${AMBER}, 0.85)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const frame = () => {
      if (!running || !inView) return;
      t += 1 / 60;

      // target: real pointer, or a slow Lissajous when idle (phones)
      const idle = performance.now() - pointer.lastMove > 2000;
      if (idle) {
        target.x = 0.5 + 0.35 * Math.sin(t * 0.55);
        target.y = 0.5 + 0.3 * Math.sin(t * 0.4 + 1.3);
      } else {
        target.x = pointer.x;
        target.y = pointer.y;
      }
      const vx = Math.max(-1, Math.min(1, (target.x - target.px) * 30));
      const vy = Math.max(-1, Math.min(1, (target.y - target.py) * 30));
      target.px = target.x;
      target.py = target.y;

      buffer.push({ x: target.x, y: target.y, vx, vy });
      if (buffer.length > BUFFER_SIZE) buffer.shift();

      // train: predict where the target will be HORIZON samples later
      if (buffer.length > HORIZON + BATCH) {
        const lr = Math.max(0.012, 0.09 * (600 / (600 + stats.steps)));
        for (let s = 0; s < STEPS_PER_FRAME; s++) {
          const batch = Array.from({ length: BATCH }, () => {
            const i = Math.floor(
              Math.random() * (buffer.length - HORIZON - 1)
            );
            const a = buffer[i];
            const b = buffer[i + HORIZON];
            return { input: [a.x, a.y, a.vx, a.vy], target: [b.x, b.y] };
          });
          const loss = trainBatch(net, batch, lr);
          stats.loss = stats.loss * 0.97 + loss * 0.03;
          stats.steps += 1;
        }
      }

      // visualise on the live input
      const acts = forward(net, [target.x, target.y, vx, vy]);
      draw(acts, [acts[acts.length - 1][0], acts[acts.length - 1][1]]);

      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // static render, no training loop, no listeners that matter
      const acts = forward(net, [0.5, 0.5, 0, 0]);
      draw(acts, [0.5, 0.5]);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const hudTimer = window.setInterval(() => {
      setHud({ loss: stats.loss, steps: stats.steps });
    }, 300);

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && running && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    });
    observer.observe(canvas);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running && inView && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(hudTimer);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full opacity-70" />
      <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-wider text-foreground/40 select-none">
        <span className="text-accent/70">live</span> · a neural network is
        training on your cursor right now · loss{" "}
        {hud.loss.toFixed(4)} · {hud.steps.toLocaleString()} steps
      </div>
    </div>
  );
}
